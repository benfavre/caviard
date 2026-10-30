# Pay-first website checkout

Implemented and verified locally; not yet deployed. No real charge was made.

## Customer journey

All six pricing offers submit directly to Stripe. Stripe collects the billing
address; the existing signed webhook enforces metropolitan France and 20% VAT.
The return goes to Manage, stores a private receipt in an HttpOnly cookie,
removes it from the URL and offers personal signup or login. The buyer explicitly
confirms the account to attach. Attachment may precede the webhook: it grants
nothing itself, and payment confirmation automatically makes credits available.

Electron reads and spends the same account balance. Paid subscription invoices
add each period's quota once. Manage exposes invoices/payment methods/cancellation
for each purchase's Stripe customer. Anonymous subscriptions are independent
purchases, as stated on the pricing page; existing subscribers have a management
link. Desktop checkout still prevents another linked subscription.

The pricing page can resume the browser's latest checkout for 24 hours. Manage
retains an unclaimed receipt for seven days. The private Stripe success URL can
also resume it. No new email sender or email-based claiming is introduced.
Losing both the receipt and browser cookies requires support to verify ownership;
never attach a purchase solely by matching an email.

## Data and authentication

The additive `web_purchases` table stores SHA-256 receipt hashes, escrow
account/operation/plan and the final owner. Escrow accounts have no trial and a
non-OAuth issuer. Stripe metadata and grants stay on their original accounts;
balance/reservation queries include explicitly linked sources. Refund/dispute
blocking propagates to the owner. Existing trial grants remain unchanged.

Manage validates its personal session and rechecks the user is not blocked.
`INKLURA_PDF_WEB_SECRET` signs the exact path, timestamp and body for private
server calls. The API allows a 60-second window, checks the UUID subject and
rejects browser-origin calls to bridge routes. The secret must be identical
in the service and Manage runtime, at least 32 random characters.

Public checkout accepts form POSTs from the PDF/API origins only, allowlisted
plans and no client amounts. A persistent ceiling bounds new receipts to 100
per hour globally; revisit it before scaling traffic. Retrying a known receipt
retains the same order and Stripe idempotency key after an ambiguous failure.

## Rollout (requires deployment authorization)

1. Preserve concurrent edits. Back up SQLite with the existing online backup
   tool and back up affected source files.
2. Generate a dedicated private `INKLURA_PDF_WEB_SECRET`. Configure it in
   `/etc/inklura-pdf.env` and Manage's `[env].env_file` from `bext.config.toml`
   (currently `/home/infra-sj278/bext/sites/.secrets/inklura-manage-prism.env`).
   Do not rotate the shared SSO secret or print either secret.
3. Deploy the service using its existing release/install procedure, restarting
   only `inklura-pdf.service`. Check `/health` and `/v1/config`;
   `webPurchasesEnabled` must be true. The new table/index are additive.
4. Publish these files from `/home/pc1/dev/bext-caviard-pairing`:
   - `sites/inklura-manage-prism/src/lib/pdf-account.ts`
   - `sites/inklura-manage-prism/src/lib/pdf-billing.ts`
   - `sites/inklura-manage-prism/src/app/pdf/billing/page.tsx`
   - `sites/inklura-manage-prism/src/app/api/pdf/billing/route.ts`
   Existing personal-account modules are prerequisites. Verify secret loading,
   no-store responses and new routes. Purge only Manage's caches via the existing
   authenticated sidecar if needed; do not restart the shared web fleet.
5. Publish only `hosting/pdf/site/src/app/tarifs/page.tsx` and
   `hosting/pdf/site/public/inklura-pdf/pricing.css` to the PDF site. Do not
   overwrite unrelated landing-page/navigation edits. The CSS URL is versioned.
6. Check real Stripe totals/return URLs for the six offers and expire unpaid
   QA sessions. Verify completion with an isolated test purchase. Never use a
   real customer's account or purchase for QA. Run
   `node hosting/pdf/verify-live.mjs --pages-only` after publication.

Rollback: hide the new website purchase actions first. Keep the linked-source
ledger reader while web purchases exist, otherwise those credits become
invisible. Never restore an older database over newer purchases or exports.

## Checks

Node 22.16+ or 23.8+, Bun, OpenSSL and Playwright Chromium required:

```sh
npm --prefix server test
node hosting/pdf/verify-checkout.mjs
# In the Bext checkout, run these separately (device test mocks its DB module):
bun test sites/inklura-manage-prism/tests/pdf-account.test.ts sites/inklura-manage-prism/tests/pdf-billing.test.ts
bun test sites/inklura-manage-prism/tests/pdf-device.test.ts
```

Set `INKLURA_BEXT_ROOT` for another Bext checkout location. The browser fixture
uses actual PRISM rendering/account/billing handlers with simulated providers,
isolated HTTPS host mappings and disposable data. It checks 390/1280px,
JavaScript disabled, six actions, signup continuation, claiming, balance and
billing-portal navigation. Screenshots: `output/direct-checkout/`.

Results: 50 service tests, 17 account/billing tests, 3 device tests and four
browser journeys (signup/login at both widths) passed. No live Stripe checkout or production deployment was
performed in these checks.

Existing-account verification: web authentication resolves the same issuer/subject
as desktop. A test account with 519 remaining credits receives a 100-credit web
purchase and ends at 619, retaining its previous exports and single trial grant,
even after receipt and webhook replays. Duplicate-email signup switches to login
with the email and purchase continuation preserved.
