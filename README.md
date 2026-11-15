# Grill & Swill

A fast-casual restaurant storefront built with React, TypeScript, TanStack Start,
Tailwind CSS, and MongoDB. Guests can browse and customize menu items, place
simulated delivery or pickup orders, track order progress, and collect rewards.
Staff can use the passcode-protected kitchen board to update orders and menu
availability.

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

Configure `MONGODB_URI`, `MONGODB_DATABASE`, `SESSION_SECRET`, and `STAFF_PASSCODE`
in a private local `.env` file using [`.env.example`](./.env.example) as a template.
The app uses a Node.js server because MongoDB's native driver requires
Node-compatible networking; deploy it to a Node.js host, not Cloudflare Workers.
Vercel builds use Nitro's Vercel Node.js preset automatically.
In Vercel project settings, leave the output directory at its framework default;
do not override it to `dist`.
The MongoDB deployment must support transactions (MongoDB Atlas does). The app
creates its required indexes when it connects.

For a production Node.js server, build and start with:

```sh
npm run build
npm start
```

To load the starter menu and store locations into an empty database, run:

```sh
npm run db:seed
```

The seed command only inserts starter menu, category, and store data when each
collection is empty. Guest carts are synchronized to MongoDB while retaining
the local-device fallback; guest reward balances remain in `guests`, and order
profiles are stored in `users`. Keep the MongoDB connection string, session
secret, and staff passcode private. Checkout is a demo and does not charge a
payment method.

## Storefront routes

- `/` — home and order entry
- `/menu` — live catalog and item customizer
- `/deals` — available promotion codes
- `/locations` — store directory
- `/rewards` — device-based points and order history
- `/checkout` — guest pickup or delivery checkout
- `/orders/:id` — live/simulated order progress
- `/kitchen` — staff order queue and item availability
