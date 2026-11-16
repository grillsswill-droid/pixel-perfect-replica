# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- Customers browsing and ordering Grill & Swill food for delivery or pickup on mobile and desktop.
- Guest customers who need to reopen order tracking and receipts without creating an account.
- Kitchen staff receiving orders and advancing preparation status.
- Administrators managing orders, menu items, combos, availability, promotions, locations, catering, gallery content, settings, and sales reporting.

## Product Purpose

Grill & Swill is a restaurant storefront and operations platform. It lets customers discover meals, customize them, place an order, pay securely, track preparation, and reopen a branded receipt while giving kitchen and admin staff one operational view of the same order. Success means a customer can move from appetite to a correctly priced, persisted, paid order without confusion, and staff can fulfill it without losing item or customization detail.

## Positioning

The product pairs highly visible Quick Order meal bundles with a continuous customer-to-kitchen-to-admin order record. Combo composition, availability, pricing, payment state, preparation state, tracking, and receipt details remain connected rather than becoming separate demonstrations.

## Operating Context

- Customers commonly arrive on a phone and need fast category browsing, clear food photography, one-tap eligible combo ordering, a cart, delivery or pickup details, and payment.
- Kitchen staff need high-scanability order cards, quantities, customizations, instructions, elapsed context, and unambiguous status controls.
- Administrators need dense but readable tables and forms for restaurant operations.
- The application runs as a Node-compatible TanStack Start server because it uses the MongoDB Node driver.
- Menu prices currently use USD. Additional presentment currencies are an open commercial decision and must not be inferred.

## Capabilities and Constraints

- Preserve the existing React 19, TypeScript, TanStack Start, Tailwind CSS, MongoDB, guest-cart, order-tracking, receipt, kitchen, and admin architecture.
- Preserve guest checkout and device-based rewards; do not introduce mandatory sign-up.
- Prices and availability are authoritative on the server. Client totals are display-only.
- Payment status and kitchen/order status are separate state machines.
- MongoDB credentials, session secrets, staff/admin passcodes, and payment secrets remain server-only.
- The merchant registration and payout country, legal entity, tax registrations, live payment credentials, and production domain are undecided external activation inputs.
- Database schema or generated-file changes managed by Lovable must not be edited manually.

## Brand Commitments

- Preserve the name “Grill & Swill” and the official flame-and-ampersand logo in `public/favicon.png` and existing branded photography.
- Preserve the established warm cream, ember orange, charcoal, and food-led identity while making it more coherent and premium.
- The experience should feel appetizing, confident, energetic, convenient, and professional—not like a generic template or generic AI-generated restaurant site.
- Avoid excessive gradients, decorative glass effects, random colors, logo distortion, fabricated brand claims, and unrelated imagery.
- Quick Order Meals is the first major shopping section immediately after the homepage hero.

## Evidence on Hand

- Official brand mark: `public/favicon.png`.
- Eleven visually verified, branded product photographs in `lovimg/` for the named combo meals and Little Swill Burger Box.
- Existing restaurant/menu photography in `src/assets/`.
- Existing menu, combo, pricing, order, kitchen, admin, tracking, receipt, rewards, catering, gallery, and location implementations in `src/`.
- No verified customer testimonials, press claims, merchant-country eligibility, tax registrations, or real store-contact proof is present; future work must not fabricate them.
- Eight requested product photographs remain unavailable: Mini Pizza Pals, Chicken Dippers Box, Little Grillers Box, Swill Scoop Cup, Double Scoop Dream, Cookie Crunch Sundae, Brownie Blast Sundae, and Loaded Swill Fries.

## Product Principles

1. Make ordering faster without hiding the meal, price, availability, or customization consequences.
2. Keep customer, payment, kitchen, admin, tracking, and receipt truth synchronized server-side.
3. Let real food and the official mark carry the brand; interface decoration supports appetite rather than competing with it.
4. Preserve guest convenience while protecting order access, personal information, staff tools, and payment authority.
5. Treat operational screens with precision and restraint, and customer-facing persuasion with confident visual energy.

## Accessibility & Inclusion

Target WCAG 2.2 AA for the web experience: keyboard access, visible focus, semantic structure, labeled forms, sufficient contrast, non-color status cues, accessible dialogs, touch-friendly targets, reduced-motion behavior, responsive text, and layouts that remain usable from 320px upward.
