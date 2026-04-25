import { NextResponse } from 'next/server';

import { EVENT_INFO } from '@/lib/constants';
import { getPayPalAccessToken, PAYPAL_BASE_URL } from '@/lib/paypal';
import { calculateChildPrice } from '@/lib/utils';

export async function POST(request: Request) {
  try {
    const { children, earlyRegistration } = await request.json();

    // Calculate total server-side to prevent tampering
    const total: number = children.reduce((sum: number, child: { grade: string }) => {
      return sum + calculateChildPrice(child.grade, earlyRegistration);
    }, 0);

    if (total <= 0) {
      return NextResponse.json({ error: 'Invalid total amount — make sure all children have a grade selected.' }, { status: 400 });
    }

    const accessToken = await getPayPalAccessToken();

    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: {
              currency_code: 'USD',
              value: total.toFixed(2),
            },
            description: `VBS ${EVENT_INFO.year} Registration – ${children.length} child(ren)`,
          },
        ],
      }),
    });

    const order = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to create PayPal order.' }, { status: 500 });
    }

    return NextResponse.json({ orderId: order.id, amount: total });
  } catch {
    return NextResponse.json({ error: 'Internal server error.' }, { status: 500 });
  }
}
