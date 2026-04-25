'use client';

import { PayPalButtons, PayPalScriptProvider } from '@paypal/react-paypal-js';

import type { ChildInfo } from '@/components/ChildInfoCard';
import type { ParentInfo } from '@/components/ParentInfoSection';

type PayPalButtonProps = {
  children: ChildInfo[];
  parentInfo: ParentInfo;
  photoConsent: boolean;
  liabilityAcknowledgment: boolean;
  earlyRegistration: boolean;
  registrationPhase: string;
  onSuccess: (registrationId: string) => void;
  onError: (message: string) => void;
};

const clientId = process.env.NEXT_PUBLIC_PAYPAL_MODE !== 'live'
  ? process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_SANDBOX!
  : process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!;

const paypalOptions = {
  clientId,
  currency: 'USD',
};

export default function PayPalButton({
  children,
  parentInfo,
  photoConsent,
  liabilityAcknowledgment,
  earlyRegistration,
  registrationPhase,
  onSuccess,
  onError,
}: PayPalButtonProps) {
  return (
    <PayPalScriptProvider options={paypalOptions}>
      <PayPalButtons
        style={{ layout: 'vertical', shape: 'pill', label: 'pay' }}
        createOrder={async () => {
          const response = await fetch('/api/paypal/create-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ children, earlyRegistration }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error);
          return data.orderId;
        }}
        onApprove={async (data) => {
          try {
            const captureRes = await fetch('/api/paypal/capture-order', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ orderId: data.orderID }),
            });
            const captureData = await captureRes.json();
            if (!captureRes.ok) throw new Error(captureData.error);

            const registerRes = await fetch('/api/register', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                parentInfo,
                children,
                photoConsent,
                liabilityAcknowledgment,
                paypalOrderId: data.orderID,
                earlyRegistration,
                registrationPhase,
              }),
            });
            const registerData = await registerRes.json();
            if (!registerRes.ok) throw new Error(registerData.error);

            onSuccess(registerData.registrationId);
          } catch (err) {
            onError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
          }
        }}
        onError={() => {
          onError('Something went wrong with PayPal. Please try again.');
        }}
      />
    </PayPalScriptProvider>
  );
}
