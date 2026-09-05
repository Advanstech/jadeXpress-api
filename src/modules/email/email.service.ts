import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { render } from '@react-email/render';
import * as React from 'react';
import { WelcomeEmail } from './templates/welcome';
import { OtpEmail } from './templates/otp';
import { ReceiptEmail } from './templates/receipt';

@Injectable()
export class EmailService {
  private resend: Resend | null = null;
  private readonly logger = new Logger(EmailService.name);
  private isDevelopment = true;
  private readonly fromEmail: string;

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.isDevelopment = this.config.get<string>('NODE_ENV') !== 'production';
    const from = this.config.get<string>('RESEND_FROM_EMAIL');
    this.fromEmail =
      (from && from.trim()) ||
      (this.isDevelopment ? 'onboarding@resend.dev' : 'noreply@jadexpress.com');

    if (apiKey) {
      this.resend = new Resend(apiKey);
    } else {
      this.logger.warn(
        'RESEND_API_KEY is not set. Emails will be logged to the console instead of sent.',
      );
    }
  }

  async sendWelcomeEmail(data: {
    to: string;
    firstName: string;
    temporaryPin: string;
    temporaryPassword?: string;
  }) {
    // For development, assuming frontend is running locally, we can construct the login URL
    const loginUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000/login';

    const html = await render(
      React.createElement(WelcomeEmail, {
        firstName: data.firstName,
        email: data.to,
        temporaryPin: data.temporaryPin,
        temporaryPassword: data.temporaryPassword,
        loginUrl,
      })
    );

    return this.sendEmail({
      to: data.to,
      subject: 'Welcome to JadeXpress - Your Access Credentials',
      html,
    });
  }

  async sendOtpEmail(data: {
    to: string;
    firstName: string;
    otpCode: string;
    type: 'pin' | 'password';
  }) {
    const html = await render(
      React.createElement(OtpEmail, {
        firstName: data.firstName,
        otpCode: data.otpCode,
        type: data.type,
      })
    );

    return this.sendEmail({
      to: data.to,
      subject: `JadeXpress - Reset your ${data.type === 'pin' ? 'PIN' : 'Password'}`,
      html,
    });
  }

  async sendReceiptEmail(data: {
    to: string;
    customerName: string;
    receiptNumber: string;
    date: string;
    items: Array<{ name: string; quantity: number; unitPrice: string; totalPrice: string }>;
    subtotal: string;
    tax: string;
    total: string;
    tenderType: string;
  }) {
    const html = await render(
      React.createElement(ReceiptEmail, {
        customerName: data.customerName,
        receiptNumber: data.receiptNumber,
        date: data.date,
        items: data.items,
        subtotal: data.subtotal,
        tax: data.tax,
        total: data.total,
        tenderType: data.tenderType,
      })
    );

    return this.sendEmail({
      to: data.to,
      subject: `JadeXpress POS Receipt #${data.receiptNumber}`,
      html,
    });
  }

  async sendOrderConfirmation(data: {
    to: string;
    orderNumber: string;
    items: Array<{ name: string; quantity: number; pricePesewas: number }>;
    subtotalPesewas: number;
    shippingFeePesewas: number;
    totalPesewas: number;
    shippingAddress: { recipientName?: string; city?: string; region?: string; country?: string; street?: string };
  }) {
    const format = (p: number) => `₵${(p / 100).toFixed(2)}`;
    const itemsHtml = data.items
      .map((i) => `<tr><td>${i.name}</td><td>${i.quantity}</td><td>${format(i.pricePesewas)}</td></tr>`)
      .join('');
    const html = `
      <h1>JadeXpress Order Confirmation</h1>
      <p>Hi ${data.shippingAddress.recipientName ?? 'Customer'},</p>
      <p>Thank you for your order <strong>#${data.orderNumber}</strong>.</p>
      <table border="1" cellpadding="8" style="border-collapse:collapse;">
        <tr><th>Item</th><th>Qty</th><th>Price</th></tr>
        ${itemsHtml}
      </table>
      <p>Subtotal: ${format(data.subtotalPesewas)}</p>
      <p>Shipping: ${format(data.shippingFeePesewas)}</p>
      <p><strong>Total: ${format(data.totalPesewas)}</strong></p>
      <p>Delivering to:<br/>${data.shippingAddress.street ?? ''}<br/>${data.shippingAddress.city ?? ''}, ${data.shippingAddress.region ?? ''}<br/>${data.shippingAddress.country ?? ''}</p>
    `;
    return this.sendEmail({ to: data.to, subject: `JadeXpress Order ${data.orderNumber} Confirmed`, html });
  }

  private async sendEmail(params: { to: string; subject: string; html: string }) {
    if (this.resend) {
      try {
        const result = await this.resend.emails.send({
          from: `JadeXpress <${this.fromEmail}>`, // MUST BE verified domain in Resend
          to: params.to,
          subject: params.subject,
          html: params.html,
        });
        
        if (result.error) {
          throw result.error;
        }
        
        this.logger.log(`Email sent to ${params.to}. Resend ID: ${result.data?.id}`);
        return result;
      } catch (error) {
        this.logger.error(`Failed to send email to ${params.to}`, error);
        // Fallback to console in development
        if (this.isDevelopment) {
          this.mockSend(params);
        }
      }
    } else {
      this.mockSend(params);
    }
  }

  private mockSend(params: { to: string; subject: string; html: string }) {
    this.logger.log('-------------------------------------------------------');
    this.logger.log(`📧 MOCK EMAIL SENT`);
    this.logger.log(`To:      ${params.to}`);
    this.logger.log(`Subject: ${params.subject}`);
    this.logger.log('-------------------------------------------------------');
    // If you want to see the HTML output, uncomment below
    // this.logger.debug(params.html);
  }
}
