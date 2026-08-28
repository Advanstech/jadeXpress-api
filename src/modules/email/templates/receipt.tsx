import * as React from 'react';
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Heading,
  Hr,
  Tailwind,
} from '@react-email/components';

interface ReceiptItem {
  name: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
}

interface ReceiptEmailProps {
  customerName: string;
  receiptNumber: string;
  date: string;
  items: ReceiptItem[];
  subtotal: string;
  tax: string;
  total: string;
  tenderType: string;
}

export const ReceiptEmail: React.FC<ReceiptEmailProps> = ({
  customerName,
  receiptNumber,
  date,
  items,
  subtotal,
  tax,
  total,
  tenderType,
}) => {
  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="bg-gray-100 font-sans">
          <Container className="bg-white border border-gray-200 rounded-lg shadow-sm mx-auto my-10 max-w-[600px] overflow-hidden">
            {/* Header */}
            <Section className="bg-[#121212] p-8 text-center">
              <Heading className="text-[#C9A24B] m-0 text-3xl font-bold tracking-tight">JadeXpress POS</Heading>
              <Text className="text-white m-0 mt-2">The Vitamin Shop & Beauty Care</Text>
            </Section>

            {/* Receipt Summary */}
            <Section className="p-8">
              <Heading className="text-2xl text-gray-900 mb-2">Purchase Receipt</Heading>
              <Text className="text-gray-500 text-sm mb-6">
                Receipt #{receiptNumber} &bull; {date}
              </Text>
              
              <Text className="text-gray-700 text-base mb-6">
                Thank you for your purchase, {customerName}! Below are the details of your transaction.
              </Text>

              {/* Items Table */}
              <Section className="border border-gray-200 rounded-lg overflow-hidden mb-6">
                <div className="bg-gray-50 p-3 font-semibold text-xs text-gray-500 uppercase tracking-wider flex justify-between border-b border-gray-200">
                  <span>Item</span>
                  <span className="text-right">Amount</span>
                </div>
                {items.map((item, idx) => (
                  <div key={idx} className="p-3 border-b border-gray-100 flex justify-between text-sm">
                    <div>
                      <p className="font-medium text-gray-900 m-0">{item.name}</p>
                      <p className="text-xs text-gray-500 m-0">{item.quantity} x GHS {item.unitPrice}</p>
                    </div>
                    <p className="font-semibold text-gray-900 m-0 self-center">GHS {item.totalPrice}</p>
                  </div>
                ))}
              </Section>

              {/* Totals Breakdown */}
              <Section className="bg-gray-50 p-4 rounded-lg space-y-2 mb-6">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal</span>
                  <span>GHS {subtotal}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Tax (VAT/NHIL)</span>
                  <span>GHS {tax}</span>
                </div>
                <Hr className="border-gray-200 my-2" />
                <div className="flex justify-between text-base font-bold text-gray-900">
                  <span>Total Paid ({tenderType.toUpperCase()})</span>
                  <span className="text-[#C9A24B]">GHS {total}</span>
                </div>
              </Section>

              <Text className="text-center text-xs text-gray-400">
                If you have any questions regarding this purchase, please visit us in-store or reach out to support.
              </Text>
            </Section>

            <Hr className="border-gray-200 m-0" />

            {/* Footer */}
            <Section className="p-6 text-center bg-gray-50">
              <Text className="text-gray-400 text-sm m-0">
                © {new Date().getFullYear()} The Vitamin Shop & Beauty Care. All rights reserved.
              </Text>
            </Section>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  );
};

export default ReceiptEmail;
