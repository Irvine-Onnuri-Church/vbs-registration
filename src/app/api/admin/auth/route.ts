import { NextRequest, NextResponse } from 'next/server';

// Never cache: the browser must not serve a stale (e.g. logged-out 401) auth
// response after the user signs in, or the Navbar keeps showing public links.
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, max-age=0' } as const;

export async function GET(request: NextRequest) {
  const session = request.cookies.get('admin_session');
  if (session?.value === 'authenticated') {
    return NextResponse.json({ authenticated: true }, { headers: NO_STORE });
  }
  return NextResponse.json({ authenticated: false }, { status: 401, headers: NO_STORE });
}

export async function POST(request: Request) {
  const { password } = await request.json();

  if (password !== process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Incorrect password.' }, { status: 401 });
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set('admin_session', 'authenticated', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 8, // 8 hours
    path: '/',
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.delete('admin_session');
  return response;
}
