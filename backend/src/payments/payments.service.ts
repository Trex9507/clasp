import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface InitiatePaymentResult {
  paymentId: string;
  paymentUrl: string;
}

export interface PaymentStatusResult {
  paymentId: string;
  status: 'pending' | 'paid' | 'failed';
  transactionId?: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly isConfigured: boolean;

  constructor(private config: ConfigService) {
    this.apiKey = this.config.get<string>('MYFATOORAH_API_KEY') || '';
    const isTest = this.config.get<string>('MYFATOORAH_MODE') !== 'live';
    this.baseUrl = isTest
      ? 'https://apitest.myfatoorah.com'
      : 'https://api.myfatoorah.com';
    this.isConfigured = !!this.apiKey;
    if (!this.isConfigured) {
      this.logger.warn('MyFatoorah not configured — payments will use placeholder mode');
    }
  }

  async initiatePayment(
    orderId: string,
    amount: number,
    customerName: string,
    customerEmail: string,
    callbackUrl: string,
  ): Promise<InitiatePaymentResult> {
    if (!this.isConfigured) {
      const placeholderId = `MF-PLACEHOLDER-${Date.now()}`;
      this.logger.debug(`Placeholder payment initiated: ${placeholderId} for AED ${amount}`);
      return { paymentId: placeholderId, paymentUrl: `${callbackUrl}?paymentId=${placeholderId}` };
    }

    const body = {
      NotificationOption: 'LNK',
      InvoiceValue: amount,
      CustomerName: customerName,
      CustomerEmail: customerEmail,
      DisplayCurrencyIso: 'AED',
      CallBackUrl: callbackUrl,
      ErrorUrl: callbackUrl,
      Language: 'EN',
      UserDefinedField: orderId,
    };

    const res = await fetch(`${this.baseUrl}/v2/SendPayment`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json() as any;
    if (!data.IsSuccess) {
      this.logger.error(`MyFatoorah SendPayment failed: ${JSON.stringify(data)}`);
      throw new Error(`Payment initiation failed: ${data.Message || 'Unknown error'}`);
    }

    return {
      paymentId: String(data.Data.InvoiceId),
      paymentUrl: data.Data.InvoiceURL,
    };
  }

  async getPaymentStatus(paymentId: string): Promise<PaymentStatusResult> {
    if (!this.isConfigured) {
      return { paymentId, status: 'paid', transactionId: paymentId };
    }

    const res = await fetch(`${this.baseUrl}/v2/GetPaymentStatus`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ Key: paymentId, KeyType: 'InvoiceId' }),
    });

    const data = await res.json() as any;
    if (!data.IsSuccess) {
      this.logger.error(`MyFatoorah GetPaymentStatus failed: ${JSON.stringify(data)}`);
      throw new Error(`Payment status check failed`);
    }

    const invoiceStatus = data.Data.InvoiceStatus;
    const status = invoiceStatus === 'Paid' ? 'paid' : invoiceStatus === 'Pending' ? 'pending' : 'failed';
    const txn = data.Data.InvoiceTransactions?.find((t: any) => t.TransactionStatus === 'Succss');

    return { paymentId, status, transactionId: txn?.TransactionId };
  }

  async executeRefund(paymentId: string, amount: number): Promise<{ refundId: string }> {
    if (!this.isConfigured) {
      const refundId = `MF-REFUND-${Date.now()}`;
      this.logger.debug(`Placeholder refund: ${refundId} for AED ${amount}`);
      return { refundId };
    }

    const res = await fetch(`${this.baseUrl}/v2/MakeRefund`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        Key: paymentId,
        KeyType: 'InvoiceId',
        RefundChargeOnCustomer: false,
        ServiceChargeOnCustomer: false,
        Amount: amount,
        Comment: 'Dispute refund',
      }),
    });

    const data = await res.json() as any;
    if (!data.IsSuccess) {
      this.logger.error(`MyFatoorah MakeRefund failed: ${JSON.stringify(data)}`);
      throw new Error(`Refund failed: ${data.Message || 'Unknown error'}`);
    }

    return { refundId: String(data.Data.RefundId) };
  }
}
