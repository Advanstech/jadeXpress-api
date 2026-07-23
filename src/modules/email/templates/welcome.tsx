import React from 'react';
import {
  Html,
  Head,
  Body,
  Container,
  Section,
  Text,
  Heading,
  Hr,
  Img,
  Tailwind,
} from '@react-email/components';

interface WelcomeEmailProps {
  firstName: string;
  email: string;
  temporaryPin: string;
  temporaryPassword?: string;
  loginUrl: string;
}

export const WelcomeEmail: React.FC<WelcomeEmailProps> = ({
  firstName,
  email,
  temporaryPin,
  temporaryPassword,
  loginUrl,
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
              <Text className="text-white m-0 mt-2">Point of Sale System</Text>
            </Section>

            {/* Content */}
            <Section className="p-8">
              <Heading className="text-2xl text-gray-900 mb-6">Welcome aboard, {firstName}!</Heading>
              <Text className="text-gray-700 text-base mb-6 leading-relaxed">
                Your JadeXpress staff profile has been created successfully. Below are your temporary credentials to access the system. 
                For your security, you will be required to change these upon your first login.
              </Text>

              <Section className="bg-gray-50 border border-gray-200 rounded p-6 mb-6">
                <Text className="text-sm text-gray-500 uppercase tracking-wider font-semibold m-0 mb-2">Your Credentials</Text>
                
                <Text className="m-0 mb-3">
                  <span className="font-semibold text-gray-700">Email:</span> {email}
                </Text>
                
                {temporaryPassword && (
                  <Text className="m-0 mb-3">
                    <span className="font-semibold text-gray-700">Temporary Password:</span>{' '}
                    <span className="bg-gray-200 px-2 py-1 rounded font-mono text-[#121212]">{temporaryPassword}</span>
                  </Text>
                )}

                <Text className="m-0">
                  <span className="font-semibold text-gray-700">Temporary PIN:</span>{' '}
                  <span className="bg-gray-200 px-2 py-1 rounded font-mono text-[#121212] text-xl tracking-widest">{temporaryPin}</span>
                </Text>
              </Section>

              <Text className="text-gray-700 text-base mb-6">
                Please visit the link below to access your portal.
              </Text>
              
              <Section className="text-center">
                <a 
                  href={loginUrl} 
                  style={{
                    backgroundColor: '#121212',
                    color: '#ffffff',
                    padding: '12px 32px',
                    borderRadius: '8px',
                    textDecoration: 'none',
                    fontWeight: 'bold',
                    display: 'inline-block'
                  }}
                >
                  Go to Login
                </a>
              </Section>
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

export default WelcomeEmail;
