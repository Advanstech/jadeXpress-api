import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InitializeNgeniusDto } from './dto/initialize-ngenius.dto';

/**
 * Network International N-Genius — Hosted Payment Page.
 * Flow: POST /identity/auth/access-token → POST /transactions/outlets/{ref}/orders
 * → redirect customer to payment.href → redirectUrl callback → GET order status.
 */
@Injectable()
export class NgeniusService {
  private readonly logger = new Logger(NgeniusService.name);

  constructor(private readonly config: ConfigService) {}

  private get cfg() {
    return {
      apiKey: this.config.get<string>('payments.ngenius.apiKey'),
      outletRef: this.config.get<string>('payments.ngenius.outletReference'),
      baseUrl:
        this.config.get<string>('payments.ngenius.baseUrl') ??
        'https://api-gateway.ngenius-payments.com',
      realmName: this.config.get<string>('payments.ngenius.realmName') ?? 'ni',
      redirectUrl: this.config.get<string>('payments.ngenius.redirectUrl'),
      trackId: this.config.get<string>('payments.ngenius.trackId') ?? 'jadexpress-pos',
    };
  }

  private async getAccessToken(): Promise<string> {
    const { apiKey, baseUrl, realmName } = this.cfg;
    if (!apiKey) {
      throw new InternalServerErrorException(
        'N-Genius API key is not configured — set NGENIUS_API_KEY',
      );
    }
    // N-Genius identity v1: the API key itself goes in the Basic header —
    // it is NOT double-base64-encoded.
    const res = await fetch(`${baseUrl}/identity/auth/access-token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${apiKey}`,
        'Content-Type': 'application/vnd.ni-identity.v1+json',
        Accept: 'application/vnd.ni-identity.v1+json',
      },
      body: JSON.stringify({ realmName }),
    });
    if (!res.ok) {
      const body = await res.text();
      this.logger.error(`N-Genius token request failed: ${res.status} ${body}`);
      throw new BadRequestException('Could not authenticate with N-Genius');
    }
    const json = await res.json();
    if (!json.access_token) throw new BadRequestException('N-Genius returned no access token');
    return json.access_token;
  }

  /** Create a hosted-payment order and return the paypage link. */
  async initializePayment(dto: InitializeNgeniusDto) {
    const { outletRef, baseUrl, redirectUrl, trackId } = this.cfg;
    if (!outletRef) {
      throw new InternalServerErrorException(
        'N-Genius outlet reference is not configured — set NGENIUS_OUTLET_REFERENCE',
      );
    }
    const token = await this.getAccessToken();

    const res = await fetch(`${baseUrl}/transactions/outlets/${outletRef}/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/vnd.ni-payment.v2+json',
        Accept: 'application/vnd.ni-payment.v2+json',
        'X-NI-Track-Id': trackId,
      },
      body: JSON.stringify({
        action: 'PURCHASE',
        amount: {
          currencyCode: dto.currency ?? 'GHS',
          value: dto.amount, // minor units (pesewas)
        },
        merchantAttributes: {
          redirectUrl: dto.redirectUrl ?? redirectUrl,
        },
        ...(dto.email ? { emailAddress: dto.email } : {}),
      }),
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
      this.logger.error(`N-Genius order create failed: ${res.status} ${JSON.stringify(json)}`);
      throw new BadRequestException('N-Genius could not create the payment order');
    }

    const paymentLink =
      json?._links?.payment?.href ?? json?._links?.['cnp:payment-link']?.href;
    const orderRef = json?._links?.self?.href ?? json?.reference;
    if (!paymentLink) {
      this.logger.error(`N-Genius response missing payment link: ${JSON.stringify(json)}`);
      throw new BadRequestException('N-Genius did not return a payment page link');
    }

    return {
      reference: json?.reference ?? dto.reference,
      orderReference: orderRef,
      paymentUrl: paymentLink,
      status: 'PENDING',
    };
  }

  /** Fetch the latest state of an N-Genius order (for callback/reconciliation). */
  async getOrderStatus(orderReference: string) {
    if (!orderReference?.startsWith('http')) {
      throw new BadRequestException('orderReference must be the order self-link URL');
    }
    const token = await this.getAccessToken();
    const res = await fetch(orderReference, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.ni-payment.v2+json',
      },
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      this.logger.error(`N-Genius order status failed: ${res.status} ${JSON.stringify(json)}`);
      throw new BadRequestException('Could not retrieve N-Genius order status');
    }
    const payment = json?._embedded?.payment?.[0];
    return {
      reference: json?.reference,
      orderReference,
      state: payment?.state ?? 'UNKNOWN', // STARTED | AUTHORIZED | PURCHASED | CAPTURED | DECLINED | CANCELLED | FAILED
      amount: payment?.amount?.value,
      currency: payment?.amount?.currencyCode,
      transactionId: payment?._links?.self?.href ?? null,
    };
  }

  /**
   * Webhook entrypoint. N-Genius posts the order event; callers must verify
   * status server-side via getOrderStatus — never trust the body alone.
   */
  async handleWebhook(payload: any) {
    const orderRef =
      payload?.orderReference ??
      payload?._links?.self?.href ??
      payload?.event?._links?.order?.href;
    if (!orderRef) {
      this.logger.warn('N-Genius webhook missing order reference');
      return { received: false };
    }
    this.logger.log(`N-Genius webhook received for order ${orderRef}`);
    return { received: true, orderReference: orderRef };
  }
}
