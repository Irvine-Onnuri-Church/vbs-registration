# VBS 2026 — Kingdom Quest Registration

Online registration site for Irvine Onnuri Church's Vacation Bible School 2026.

**Live site:** [iocvbs.life](https://iocvbs.life)

---

## Tech Stack

| Layer | Service |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| Styling | Tailwind CSS v4 |
| Database | Supabase (PostgreSQL) |
| Payments | PayPal REST API |
| Email | Resend |
| Hosting | Vercel |

---

## Connected Services

### 1. Vercel (Hosting)
- The site is deployed automatically from the `master` branch on GitHub
- Every push to `master` triggers a new production deployment
- **Dashboard:** [vercel.com](https://vercel.com) → project `vbs-registration`
- Environment variables must be set in Vercel's project settings (not in `.env.local`)

### 2. Supabase (Database)
- Stores all registration data and magic link tokens
- **Dashboard:** [supabase.com](https://supabase.com) → find the project for this app
- Two clients are used:
  - **Anon client** (`NEXT_PUBLIC_SUPABASE_ANON_KEY`) — public, used client-side
  - **Service role client** (`SUPABASE_SERVICE_ROLE_KEY`) — server-side only, bypasses Row Level Security (admin routes only)

#### Database Tables

| Table | Description |
|---|---|
| `registrations` | One row per registration — parent info, payment status, total amount |
| `children` | One row per child, linked to a registration by `registration_id` |
| `magic_links` | Temporary login tokens for "My Registration" page, expire after 1 hour |

### 3. PayPal (Payments)
- Uses the **PayPal REST API** — not the old PayPal button/donate link
- Mode is controlled by `NEXT_PUBLIC_PAYPAL_MODE`:
  - `sandbox` — for testing (uses sandbox credentials, no real money)
  - `live` — for real payments
- Payment flow: Create Order → User approves in PayPal popup → Capture Order → Save to Supabase → Send confirmation email
- **Dashboard:** [developer.paypal.com](https://developer.paypal.com)

> **Important:** There is an old separate PayPal payment button (dropdown with fee options) that was created before this app existed. It has wrong prices and should be **deactivated** in the PayPal dashboard so registrants only use this site.

### 4. Resend (Email)
- Sends two types of emails automatically:
  1. **Registration confirmation** — sent after successful PayPal payment, includes child details and total paid
  2. **Magic link** — sent when a parent requests to view their registration on `/mypage`
- Sender address: `VBS 2026 <noreply@iocvbs.life>`
- **Dashboard:** [resend.com](https://resend.com)
- The domain `iocvbs.life` must be verified in Resend for emails to deliver

---

## Environment Variables

For **local development**, create a `.env.local` file in the project root.
For **production**, set these in Vercel project settings under "Environment Variables".

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# PayPal — Sandbox (testing)
NEXT_PUBLIC_PAYPAL_MODE=sandbox
NEXT_PUBLIC_PAYPAL_CLIENT_ID_SANDBOX=your_sandbox_client_id
PAYPAL_CLIENT_SECRET_SANDBOX=your_sandbox_secret

# PayPal — Live (production, uncomment and fill in when going live)
# NEXT_PUBLIC_PAYPAL_MODE=live
# NEXT_PUBLIC_PAYPAL_CLIENT_ID=your_live_client_id
# PAYPAL_CLIENT_SECRET=your_live_secret

# Resend
RESEND_API_KEY=your_resend_api_key

# Admin dashboard password (for /admin page)
ADMIN_PASSWORD=choose_a_strong_password

# App base URL (used in magic link emails)
NEXT_PUBLIC_APP_URL=https://iocvbs.life
```

---

## Local Development

```bash
# 1. Install dependencies
npm install

# 2. Create .env.local with the variables above

# 3. Start dev server
npm run dev
# → http://localhost:3000

# Build for production (optional check)
npm run build
```

---

## Project Structure

```
src/
├── app/
│   ├── page.tsx                    # Home page
│   ├── register/
│   │   ├── page.tsx                # Program selection (Beginner / Regular)
│   │   ├── prek/page.tsx           # Beginner program form
│   │   ├── k6/page.tsx             # Regular (K–6) program form
│   │   └── success/page.tsx        # Post-payment success page
│   ├── mypage/                     # Parent registration lookup (via magic link)
│   ├── admin/page.tsx              # Admin dashboard (password protected)
│   └── api/
│       ├── paypal/                 # create-order & capture-order endpoints
│       ├── register/               # Save registration to DB + send confirmation email
│       ├── magic-link/             # Request & verify magic link tokens
│       └── admin/                  # Admin auth & registration data fetch
├── components/
│   ├── RegistrationFormClient.tsx  # Main registration form logic
│   ├── ChildInfoCard.tsx           # Per-child input fields
│   ├── PayPalButton.tsx            # PayPal SDK button component
│   └── RegistrationSummary.tsx     # Price summary sidebar
└── lib/
    ├── constants.ts                # All event info, pricing, DOB ranges — edit here each year
    ├── utils.ts                    # Price calculation, date/currency formatting
    ├── paypal.ts                   # PayPal API access token helper
    └── supabase.ts                 # Supabase client instances
```

---

## Updating for Next Year

**All event details and pricing live in one file: `src/lib/constants.ts`.**
Only this file needs to change for a new VBS year.

```ts
// Dates
dates: 'June 10–13, 2026',
datesBeginner: 'June 12–13, 2026',

// Times
times: 'Wed–Fri 3:00–7:00 PM · Sat 9:00 AM–1:00 PM',
timesBeginner: 'Fri 3:30–6:30 PM · Sat 9:30 AM–12:30 PM',

// Registration windows
earlyRegistrationStart: '2026-04-05',
earlyRegistrationDeadline: '2026-05-03',
registrationDeadline: '2026-05-31',

// Pricing
REGISTRATION_PRICING = {
  early:   { beginner: 40, standard: 70 },
  regular: { beginner: 50, standard: 90 },
}

// Beginner program — eligible birth date range
BEGINNER_DOB = {
  min: '2022-06-11',
  max: '2023-12-31',
}
```

---

## Programs

| Program | Who | Dates | Early Price | Regular Price |
|---|---|---|---|---|
| Beginner | 30–48 months (born 6/11/22–12/31/23) | June 12–13 (Fri–Sat) | $40 | $50 |
| Regular | Kinder – 6th Grade | June 10–13 (Wed–Sat) | $70 | $90 |

---

## Admin Dashboard

- **URL:** `/admin`
- Password set via `ADMIN_PASSWORD` environment variable
- Features:
  - View all registrations with expandable detail rows
  - Download full CSV export of all registrations and children
  - Session lasts 8 hours (cookie-based)

---

## Deployment

Deployments happen automatically — push to `master` and Vercel deploys within ~1 minute.

```bash
git add .
git commit -m "your message"
git push origin master
```

To check deployment status, go to the Vercel dashboard.
