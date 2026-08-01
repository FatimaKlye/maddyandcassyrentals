# Production operations

## GoDaddy VPS deployment

This application requires a Node.js-capable VPS; it is not a static shared-hosting
upload. On an Ubuntu GoDaddy VPS:

1. Install Node.js 20+, Nginx, PM2, and Certbot.
2. Copy the repository and a production `.env` file to the server.
3. Run `npm ci`, `npm run build`, then `pm2 start ecosystem.config.cjs`.
4. Adapt `ops/nginx-godaddy.conf` to the real domain and enable it in Nginx.
5. Issue a TLS certificate with Certbot and point the GoDaddy DNS A record to
   the VPS.
6. Register `https://your-domain/api/paymongo/webhook` in PayMongo and subscribe
   to `checkout_session.payment.paid`.

Use Cloudflare proxying in front of the VPS for managed WAF, bot protection,
DDoS mitigation, and CDN caching. Never cache `/api/*`, `/account/*`, or
`/admin/*`.

## Required secrets

Start from `.env.example`. Keep the PayMongo key, webhook secret, Firebase
service account, and backup bucket in the VPS secret environment. Switch from
`sk_test_` to `sk_live_` only after test-mode webhook reconciliation passes.

## Firebase production setup

- Enable Firebase App Check, configure the reCAPTCHA v3 site key, then set
  `ENFORCE_FIREBASE_APP_CHECK=true`.
- Generate a Web Push certificate and configure
  `NEXT_PUBLIC_FIREBASE_VAPID_KEY`.
- Deploy rules with `npm run firebase:deploy-rules`.
- Enable the FCM Registration API and Cloud Messaging API.

## Backups

Create a private, versioned Cloud Storage bucket in a different region or
project. Schedule `gcloud firestore export` daily with Cloud Scheduler/Cloud
Run, or invoke `npm run firebase:backup` with `FIREBASE_BACKUP_BUCKET` set.
Configure retention and test a restore quarterly.

## Monitoring and alerts

- Monitor `GET /api/health` every minute from an external HTTPS monitor.
- Alert on HTTP 5xx rates, webhook `failed` records, PayMongo delivery failures,
  and Firebase quota/permission errors.
- Forward structured logs without request bodies, ID images, tokens, or secrets.
- Configure disk, memory, certificate-expiry, and PM2 restart alerts.
- Review `/admin/payments` and `/admin/audit` during daily reconciliation.
