import { NextResponse } from 'next/server';

import { getPayPalAccessToken, PAYPAL_BASE_URL } from '@/lib/paypal';

export async function POST(request: Request) {
  try {
    const { orderId } = await request.json();

    const accessToken = await getPayPalAccessToken();

    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await response.json();

    if (!response.ok || data.status !== 'COMPLETED') {
      return NextResponse.json({ error: 'Payment capture failed.' }, { status: 400 });
    }

    const capture = data.purchase_units?.[0]?.payments?.captures?.[0];
    const captureId = capture?.id ?? null;
    const captureTime = capture?.create_time ?? null;

    return NextResponse.json({ status: data.status, orderId: data.id, captureId, captureTime });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
