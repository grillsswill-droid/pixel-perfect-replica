# Grill & Swill

A fast-casual restaurant storefront built with React, TypeScript, TanStack Start,
Tailwind CSS, and MongoDB. Guests can browse and customize menu items, pay for
delivery or pickup orders through Flutterwave, securely track orders, print itemized
receipts, browse combo meals, and collect rewards. Staff have a live kitchen
board; administrators have separate access to catalog, operations, reports,
promotions, catering, gallery media, and store settings.

## Development

Install dependencies and start the development server:

```sh
npm install
npm run dev
```

Run the production build, tests, and linter:

```sh
npm run build
npm test
npm run lint
```

## Environment

Configure `MONGODB_URI`, `MONGODB_DATABASE`, `SESSION_SECRET`, `STAFF_PASSCODE`,
`ADMIN_PASSCODE`, `PUBLIC_SITE_URL`, and the `FLW_*` variables in a private local
`.env` file using [`.env.example`](./.env.example)
as a template. `SESSION_SECRET` must contain at least 32 characters;
`ADMIN_PASSCODE` must be a unique secret of at least 16 characters. Keep both
passcodes private and distinct.
The app uses a Node.js server because MongoDB's native driver requires
Node-compatible networking; deploy it to a Node.js host, not Cloudflare Workers.
Vercel builds use Nitro's Vercel Node.js preset automatically.
In Vercel project settings, leave the output directory at its framework default;
do not override it to `dist`.
The MongoDB deployment must support transactions (MongoDB Atlas does). The app
creates its required indexes when it connects. Admin-uploaded JPEG, PNG, and
WebP images (up to 2 MB each) are stored in MongoDB GridFS.

## Flutterwave payments

Checkout uses Flutterwave Standard (hosted checkout) in USD. The browser calls
`POST /api/payments/initialize`; the server recomputes the order total and uses
`FLW_SECRET_KEY` to create the hosted payment link. The secret key is never sent
to browser code. `FLW_PUBLIC_KEY` and `FLW_ENCRYPTION_KEY` are included as
placeholders for a future Inline/direct-charge flow but are not required by the
current hosted flow.

Set the Flutterwave redirect/callback URL to the app-generated
`/api/payments/verify` URL by configuring `PUBLIC_SITE_URL` to the deployed HTTPS
origin. In the Flutterwave dashboard, configure the webhook URL as:

```text
https://your-domain.example/api/webhooks/flutterwave
```

Set the same random secret hash in Flutterwave and `FLW_SECRET_HASH`. The webhook
checks the `verif-hash` header before accepting `charge.completed` events. Both
the redirect and webhook re-fetch the transaction from Flutterwave, compare its
status, amount, currency, and `tx_ref`, then use one atomic paid transition so
retries cannot award rewards or fulfill an order twice. See the
[Flutterwave v3 API docs](https://developer.flutterwave.com/api) for dashboard
and test-mode details.

For a production Node.js server, build and start with:

```sh
npm run build
npm start
```

To load the starter menu and store locations into an empty database, run:

```sh
npm run db:seed
```

After the starter pizza catalog is present, load the 18 signature combo meals and
the Little Swillers and dessert categories with:

```sh
npm run db:seed:combos
```

Vercel does not run database seed scripts during deployment. To populate the
Production database, authenticate and link the Vercel CLI to this project, then
run these commands from the repository root:

```sh
vercel env pull /tmp/grill-swill-production.env --environment=production
# Only for a brand-new database:
node --env-file=/tmp/grill-swill-production.env scripts/seed-mongodb.mjs
node --env-file=/tmp/grill-swill-production.env scripts/seed-combo-meals.mjs
```

The combo seed requires pizza items configured with size, crust, and topping
options, so skip the starter seed if those items already exist.
Confirm the seed reports 18 Quick Order products. This targets the Production
`MONGODB_URI` and `MONGODB_DATABASE` without printing their values. Reload the
site after the seed completes; a redeploy is not required.

The combo seed is idempotent and only inserts missing products/categories. It
does not overwrite prices, availability, imagery, featured status, or other
changes made later through Admin → Menu. Pizza combos link to the configured
pizza varieties and reuse their current crust and topping choices. Combo prices
are stored in cents with `currency: "USD"` and are editable in the admin menu.
In Admin → Menu & combos, use the Quick Order filter to edit existing items or
Add Quick Order item to create one and assign its category, display order,
included components, price, availability, and featured status.

The seed command only inserts starter menu, category, and store data when each
collection is empty. Guest carts are synchronized to MongoDB while retaining
the local-device fallback; guest reward balances remain in `guests`, and order
profiles are stored in `users`. Keep the MongoDB connection string, session
secret, staff passcode, Flutterwave secret key, encryption key, and webhook hash
private. Pending or failed payment attempts remain out of the kitchen queue;
only verified payments are fulfilled and credited with rewards.

## Storefront routes

- `/` — home and order entry
- `/menu` — live catalog and item customizer
- `/deals` — available promotion codes
- `/catering` — catering packages and protein add-ons
- `/gallery` — published Grill & Swill media
- `/locations` — store directory
- `/rewards` — device-based points and order history
- `/account/orders` — recent order tracking and receipt links for this device
- `/checkout` — guest pickup or delivery checkout
- `/orders/:id` — live order progress (requires its signed tracking token)
- `/receipts/:id` — printable, snapshot-based order receipt
- `/kitchen` — staff order queue and item availability
- `/admin` — separate administrator login for order, menu/combo, customer, promotion,
  catering, gallery, sales, store settings, and announcement ticker workflows

Guests can also leave persistent likes and comments on published gallery posts,
and submit catering inquiries for follow-up. Gallery comments and catering
requests are rate-limited per device identifier; administrators can review and
update the status of catering requests from the catering workspace.

The admin menu editor uses the existing MongoDB menu and option-group model. A
combo is a menu item with a priced `combo` option group; checkout revalidates
every selection and price on the server. Custom promo usage limits are enforced
within the order transaction. Order status history and receipt snapshots are
stored with each order, and checkout request IDs prevent duplicate order/receipt
creation when the same submission is retried.
