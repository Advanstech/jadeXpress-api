import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InitializePaystackDto } from './dto/initialize-paystack.dto';
import { RequestMomoDto } from './dto/request-momo.dto';

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
}
