This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Firebase Admin access

Server-side operations such as deleting a customer account require Firebase
Admin credentials. Configure one of these in the local or hosting environment:

- `FIREBASE_SERVICE_ACCOUNT_JSON` containing the service-account JSON as a
  single environment-variable value.
- `GOOGLE_APPLICATION_CREDENTIALS` containing the absolute path to a local
  service-account JSON file.

Never commit a service-account key. The existing `.gitignore` excludes common
Firebase service-account filenames.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Payments, documents, and notifications

The application uses PayMongo Hosted Checkout v2. Customers can pay only after
verification and approval. A signed, replay-protected
`checkout_session.payment.paid` webhook is the source of truth. The system
privately generates invoices, official receipts, verified payment proof, and a
two-page final rental agreement.

Configure `.env.example`, then register
`https://your-domain/api/paymongo/webhook` in the PayMongo dashboard and
subscribe to `checkout_session.payment.paid`.

Firebase Cloud Messaging is available from the customer profile after the web
push VAPID key and Cloud Messaging APIs are configured.

## Gmail signup verification

New customer accounts complete a six-digit email OTP step. Configure
`GMAIL_SMTP_USER`, `GMAIL_SMTP_APP_PASSWORD`, and a long random
`EMAIL_OTP_HMAC_SECRET` to send the code through Gmail. Use a Google App
Password, not the Gmail account's normal password.

In local development, when Gmail credentials are absent, the verification
screen displays a clearly marked preview code so the full signup and booking
flow remains testable. Preview codes are never returned in production.

## Verification

Run `npm run verify` to lint, type-check, test payment security and PDF
generation, and build the production application.

## GoDaddy production deployment

The project builds as a standalone Node.js service for a GoDaddy VPS. It cannot
run on static shared hosting. PM2, Nginx/TLS, Cloudflare WAF/CDN, backups, and
monitoring are documented in `ops/PRODUCTION.md`.
