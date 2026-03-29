const isSandbox = process.env.NODE_ENV !== 'production';

export const PAYPAL_BASE_URL = isSandbox
  ? 'https://api-m.sandbox.paypal.com'
  : 'https://api-m.paypal.com';

export async function getPayPalAccessToken(): Promise<string> {
  const clientId = isSandbox
    ? process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID_SANDBOX!
    : process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID!;
  const clientSecret = isSandbox
    ? process.env.PAYPAL_CLIENT_SECRET_SANDBOX!
    : process.env.PAYPAL_CLIENT_SECRET!;
  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const response = await fetch(`${PAYPAL_BASE_URL}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await response.json();
  if (!data.access_token) throw new Error('Failed to get PayPal access token');
  return data.access_token;
}
