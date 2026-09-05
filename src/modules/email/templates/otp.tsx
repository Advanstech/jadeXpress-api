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

interface OtpEmailProps {
  firstName: string;
  otpCode: string;
  type: 'pin' | 'password';
}

export const OtpEmail: React.FC<OtpEmailProps> = ({
  firstName,
  otpCode,
  type,
}) => {
  return (
    <Html>
      <Head />
      <Tailwind>
        <Body className="bg-gray-100 font-sans">
          <Container className="bg-white border border-gray-200 rounded-lg shadow-sm mx-auto my-10 max-w-[600px] overflow-hidden">
            {/* Header */}
            <Section className="bg-[#121212] p-8 text-center">
              <Heading className="text-[#C9A24B] m-0 text-3xl font-bold tracking-tight">JadeXpress</Heading>
              <Text className="text-white m-0 mt-2">Security Verification</Text>
            </Section>

            {/* Content */}
            <Section className="p-8 text-center">
              <Heading className="text-2xl text-gray-900 mb-6">Reset your {type === 'pin' ? 'PIN' : 'Password'}</Heading>
              
              <Text className="text-gray-700 text-base mb-6 leading-relaxed">
                Hi {firstName},<br/><br/>
                We received a request to reset your {type === 'pin' ? 'Point of Sale PIN' : 'dashboard password'}. 
                Use the security code below to complete the process.
              </Text>

              <Section className="bg-gray-50 border border-gray-200 rounded-2xl p-8 mb-6 mx-auto text-center" style={{ maxWidth: '400px', width: '100%' }}>
                <Text className="text-xs font-bold text-gray-400 uppercase tracking-widest m-0 mb-3">
                  Your Security Code
                </Text>
                <Text 
                  className="text-4xl sm:text-5xl font-mono font-black text-[#121212] m-0" 
                  style={{ letterSpacing: '0.3em', paddingLeft: '0.3em' }}
                >
                  {otpCode}
                </Text>
                <Text className="text-[11px] text-gray-400 mt-4 m-0 font-medium">
                  (Double-click or tap & hold to copy)
                </Text>
              </Section>

              <Text className="text-gray-500 text-sm mb-6">
                This code will expire in 15 minutes. If you did not request this reset, please ignore this email or contact your manager.
              </Text>
            </Section>

            <Hr className="border-gray-200 m-0" />

            {/* Footer */}
            <Section className="p-8 text-center bg-gray-50">
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

export default OtpEmail;
