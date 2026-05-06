import { NextResponse } from 'next/server';

import { getPayPalAccessToken, PAYPAL_BASE_URL } from '@/lib/paypal';
import { calculateChildPrice } from '@/lib/utils';

export async function POST(request: Request) {
  try {
    const { children, earlyRegistration, parentName, parentEmail, parentPhone } = await request.json();

    // Calculate total server-side to prevent tampering
    const childNames: string = children
      .map((child: { firstName: string; lastName: string }) => `${child.firstName} ${child.lastName}`)
      .join(', ');

    const total: number = children.reduce((sum: number, child: { grade: string }) => {
      return sum + calculateChildPrice(child.grade, earlyRegistration);
    }, 0);

    if (total <= 0) {
      return NextResponse.json({ error: 'Invalid total amount — make sure all children have a grade selected.' }, { status: 400 });
    }

    const accessToken = await getPayPalAccessToken();

    const itemName = `VBS 2026 Registration Fee — Parent: ${parentName} | Children: ${childNames} | ${parentEmail} | ${parentPhone}`;

    const response = await fetch(`${PAYPAL_BASE_URL}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        payer: {
          name: {
            given_name: parentName?.split(' ')[0] ?? '',
            surname: parentName?.split(' ').slice(1).join(' ') || '',
          },
          email_address: parentEmail ?? '',
          phone: {
            phone_type: 'MOBILE',
            phone_number: {
              national_number: parentPhone ?? '',
            },
          },
        },
        purchase_units: [
          {
            custom_id: parentEmail ?? '',
            description: `${childNames} — ${parentEmail ?? ''}`,
            amount: {
              currency_code: 'USD',
              value: total.toFixed(2),
              breakdown: {
                item_total: {
                  currency_code: 'USD',
                  value: total.toFixed(2),
                },
              },
            },
            items: [
              {
                name: itemName.substring(0, 127),
                quantity: '1',
                unit_amount: {
                  currency_code: 'USD',
                  value: total.toFixed(2),
                },
                sku: 'VBS2026',
              },
            ],
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
