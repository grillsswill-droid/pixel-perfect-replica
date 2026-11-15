# Grill & Swill

A fast-casual restaurant storefront built with React, TypeScript, TanStack Start,
Tailwind CSS, and Supabase. Guests can browse and customize menu items, place
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

Set the server-side Supabase and staff values listed in [`.env.example`](./.env.example).
Keep service-role keys, session secrets, and staff passcodes private. The checkout
is a demo and does not charge a payment method.

## Storefront routes

- `/` — home and order entry
- `/menu` — live catalog and item customizer
- `/deals` — available promotion codes
- `/locations` — store directory
- `/rewards` — device-based points and order history
- `/checkout` — guest pickup or delivery checkout
- `/orders/:id` — live/simulated order progress
- `/kitchen` — staff order queue and item availability
