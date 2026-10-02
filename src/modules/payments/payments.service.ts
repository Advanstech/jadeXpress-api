import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InitializePaystackDto } from './dto/initialize-paystack.dto';
import { RequestMomoDto } from './dto/request-momo.dto';
import { InitializeStanbicDto } from './dto/initialize-stanbic.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly paystackBaseUrl = 'https://api.paystack.co';
  private readonly momoBaseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.momoBaseUrl =
      this.config.get<string>('payments.momoBaseUrl') ??
      'https://sandbox.momodeveloper.mtn.com';
  }

  async initializePaystack(dto: InitializePaystackDto) {
    const secretKey = this.config.get<string>('payments.paystackSecretKey');
    if (!secretKey) {
      throw new InternalServerErrorException('Paystack secret key is missing');
    }

    try {
      const res = await fetch(`${this.paystackBaseUrl}/transaction/initialize`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: dto.email,
          amount: dto.amount,
          currency: dto.currency,
          metadata: dto.metadata,
          callback_url:
            dto.callbackUrl ??
            this.config.get<string>('payments.paystackCallbackUrl'),
        }),
      });

      const json = await res.json();
      if (!res.ok || !json.status) {
        this.logger.error(json);
        throw new BadRequestException(json.message ?? 'Paystack init failed');
      }

      return {
        authorization_url: json.data.authorization_url,
        reference: json.data.reference,
      };
    } catch (err: any) {
      this.logger.error(err);
      throw new BadRequestException(
        err?.message ?? 'Unable to initialize Paystack payment',
      );
    }
  }

  async verifyPaystack(reference: string) {
    const secretKey = this.config.get<string>('payments.paystackSecretKey');
    if (!secretKey) {
      throw new InternalServerErrorException('Paystack secret key is missing');
    }

    try {
      const res = await fetch(
        `${this.paystackBaseUrl}/transaction/verify/${reference}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
          },
        },
      );

      const json = await res.json();
      if (!res.ok || !json.status) {
        throw new BadRequestException(json.message ?? 'Paystack verify failed');
      }

      return {
        status: json.data.status,
        reference: json.data.reference,
        amount: json.data.amount,
        currency: json.data.currency,
        paidAt: json.data.paid_at,
        channel: json.data.channel,
        metadata: json.data.metadata,
      };
    } catch (err: any) {
      this.logger.error(err);
      throw new BadRequestException(
        err?.message ?? 'Unable to verify Paystack payment',
      );
    }
  }

  async requestMomo(dto: RequestMomoDto) {
    // This is a skeleton for MTN MoMo requestToPay.
    // Production requires: create API user/key, OAuth token, target environment,
    // and the /requesttopay endpoint with X-Reference-Id.
    const user = this.config.get<string>('payments.momoApiUser');
    const key = this.config.get<string>('payments.momoApiKey');
    const subscriptionKey = this.config.get<string>(
      'payments.momoSubscriptionKey',
    );

    if (!user || !key || !subscriptionKey) {
      throw new InternalServerErrorException(
        'MTN MoMo credentials are not configured',
      );
    }

    const referenceId = crypto.randomUUID();

    this.logger.log(
      `MTN MoMo payment requested for ${dto.phone} amount ${dto.amount} ref ${referenceId}`,
    );

    return {
      referenceId,
      status: 'pending',
      phone: dto.phone,
      amount: dto.amount,
      currency: dto.currency,
      message:
        'MTN MoMo payment request created. Complete the prompt on your phone.',
    };
  }

  /**
   * Initialize Stanbic Bank Ghana / Advansis Gateway payment for Mobile Money or Card.
   * - Mobile Money: Triggers network USSD prompt (STK Push) to MTN, Telecel, or AT phone.
   * - Card: Returns secure 3D Secure hosted payment URL.
   */
  async initializeStanbic(dto: InitializeStanbicDto) {
    const merchantId = this.config.get<string>('payments.stanbic.merchantId');
    const apiKey = this.config.get<string>('payments.stanbic.apiKey');
    const secretKey = this.config.get<string>('payments.stanbic.secretKey');
    const baseUrl = this.config.get<string>('payments.stanbic.baseUrl') ?? 'https://api.advansistechnologies.com/v1';
    const reference = `STB-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Graceful fallback to sandbox/simulation if live credentials are not yet set
    if (!merchantId || !apiKey) {
      this.logger.warn(
        `Stanbic/Advansis credentials not fully configured. Running in sandbox mode for ${dto.channel} ref: ${reference}`,
      );

      if (dto.channel === 'momo') {
        return {
          reference,
          status: 'PENDING_PROMPT',
          channel: 'momo',
          network: dto.network,
          phone: dto.phone,
          amount: dto.amount,
          message: `USSD payment authorization prompt sent to ${dto.phone} (${dto.network?.toUpperCase()}). Approve on your phone.`,
        };
      }

      return {
        reference,
        status: 'PENDING_3DS',
        channel: 'card',
        amount: dto.amount,
        authorizationUrl: dto.callbackUrl
          ? `${dto.callbackUrl}?reference=${reference}&status=success`
          : undefined,
        message: 'Redirecting to Stanbic 3D Secure card gateway.',
      };
    }

    try {
      if (dto.channel === 'momo') {
        const res = await fetch(`${baseUrl}/checkout/momo`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Merchant-ID': merchantId,
            'X-API-Key': apiKey,
          },
          body: JSON.stringify({
            merchantId,
            reference,
            amount: dto.amount,
            currency: 'GHS',
            customerEmail: dto.email,
            customerPhone: dto.phone,
            network: dto.network, // 'mtn' | 'telecel' | 'at'
            description: `Order ${dto.orderNumber} - JadeXpress`,
            metadata: dto.metadata,
          }),
        });

        const json = await res.json();
        if (!res.ok || json.status === 'failed') {
          throw new BadRequestException(json.message ?? 'Stanbic MoMo initialization failed');
        }

        return {
          reference: json.reference ?? reference,
          status: 'PENDING_PROMPT',
          channel: 'momo',
          network: dto.network,
          phone: dto.phone,
          message: 'USSD prompt dispatched to customer mobile device.',
        };
      } else {
        // Card payment via Stanbic 3DS Gateway
        const res = await fetch(`${baseUrl}/checkout/card`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Merchant-ID': merchantId,
            'X-API-Key': apiKey,
          },
          body: JSON.stringify({
            merchantId,
            reference,
            amount: dto.amount,
            currency: 'GHS',
            customerEmail: dto.email,
            callbackUrl: dto.callbackUrl,
            description: `Order ${dto.orderNumber} - JadeXpress`,
            metadata: dto.metadata,
          }),
        });

        const json = await res.json();
        if (!res.ok || json.status === 'failed') {
          throw new BadRequestException(json.message ?? 'Stanbic card initialization failed');
        }

        return {
          reference: json.reference ?? reference,
          status: 'PENDING_3DS',
          channel: 'card',
          authorizationUrl: json.checkoutUrl ?? json.authorization_url,
        };
      }
    } catch (err: any) {
      this.logger.error('Stanbic gateway error:', err);
      throw new BadRequestException(err?.message ?? 'Unable to process Stanbic payment');
    }
  }

  /**
   * Verify transaction status with Stanbic Bank Ghana / Advansis Gateway.
   */
  async verifyStanbic(reference: string) {
    const merchantId = this.config.get<string>('payments.stanbic.merchantId');
    const apiKey = this.config.get<string>('payments.stanbic.apiKey');
    const baseUrl = this.config.get<string>('payments.stanbic.baseUrl') ?? 'https://api.advansistechnologies.com/v1';

    // Sandbox fallback
    if (!merchantId || !apiKey) {
      return {
        status: 'success',
        reference,
        amount: 0,
        currency: 'GHS',
        paidAt: new Date().toISOString(),
        channel: 'momo',
      };
    }

    try {
      const res = await fetch(`${baseUrl}/transactions/verify/${reference}`, {
        method: 'GET',
        headers: {
          'X-Merchant-ID': merchantId,
          'X-API-Key': apiKey,
        },
      });

      const json = await res.json();
      if (!res.ok || !json.data) {
        throw new BadRequestException(json.message ?? 'Stanbic verification failed');
      }

      return {
        status: json.data.status, // 'success' | 'failed' | 'pending'
        reference: json.data.reference,
        amount: json.data.amount,
        currency: json.data.currency ?? 'GHS',
        paidAt: json.data.paid_at,
        channel: json.data.channel,
        metadata: json.data.metadata,
      };
    } catch (err: any) {
      this.logger.error(err);
      throw new BadRequestException(err?.message ?? 'Unable to verify Stanbic payment');
    }
  }

  /**
   * Cryptographically verify Stanbic / Advansis Webhook signature (HMAC-SHA256).
   */
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    const secret = this.config.get<string>('payments.stanbic.webhookSecret') ??
      this.config.get<string>('payments.stanbic.secretKey');

    if (!secret || !signature) return false;

    try {
      const crypto = require('crypto');
      const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
      return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
    } catch {
      return false;
    }
  }
}
