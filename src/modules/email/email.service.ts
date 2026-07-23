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

  constructor(private config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.isDevelopment = this.config.get<string>('NODE_ENV') !== 'production';

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

  private async sendEmail(params: { to: string; subject: string; html: string }) {
    if (this.resend) {
      try {
        const result = await this.resend.emails.send({
          from: 'JadeXpress <noreply@jadexpress.com>', // MUST BE verified domain in Resend
          to: params.to,
          subject: params.subject,
          html: params.html,
        });
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
