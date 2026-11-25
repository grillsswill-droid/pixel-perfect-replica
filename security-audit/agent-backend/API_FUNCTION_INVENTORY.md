# API and server-function inventory

Source inventory: **44 TanStack server functions** (15 GET, 29 POST), **4 explicit HTTP API routes**, **13 storefront page routes**, and one root layout. Read-only local parsing of the copied production resolver confirms exactly 44 hashed entries and 44 named `*_createServerFn_handler` handlers, including the unused-by-frontend `placeOrder`. Source and compiled counts agree. Hashes are transport identifiers, not permission controls.

Server functions are HTTP RPC entry points under the framework server-function prefix (`/_serverFn/<build identifier>` in the copied build), with serialized GET query data or POST data. Input schemas operate on the deserialized `data`, not arbitrary MongoDB filters. The request middleware in `src/start.ts:23`–`:29` installs framework CSRF checking for all `handlerType === "serverFn"`. This is origin/request protection, not guest ownership validation or rate limiting. Explicit HTTP routes use their own guards, detailed below and in the payments assessment. Root audit records actual HTTP checks against the isolated built application.

## Shared schema and error conventions

These schema references include actual accepted fields and bounds; every function table refers to the applicable schema. UUID means Zod string UUID validation. `strict` rejects unexpected top-level properties; otherwise Zod object parsing strips them. Stripping unexpected role fields is not mass assignment. No-input handlers have no data validator and ignore supplied data. No application-wide RPC body/byte limit or persistent rate limiter is defined in these backend modules; schema lengths apply after body deserialization.

| Schema reference / source | Accepted input and limits |
| --- | --- |
| `GuestId` (`orders.functions.ts:400`, `cart.functions.ts:40`) | `{ guestId: UUID }`; ordinary Zod object strips unexpected fields. Guest ID is caller-selected and not bound to verified guest session. |
| `OrderCapability` (`orders.functions.ts:450`) | `{ id: UUID, token: string matching /^[A-Za-z0-9_-]{43}$/ }`; strips extras; subsequent HMAC must bind stored order ID and stored guest ID. |
| `Selections` (`orders.functions.ts:72`, `cart.functions.ts:6`, `catalog.functions.ts:112`) | Record of arbitrary keys to arrays of at most 10 strings, each at most 40 characters. Number/key lengths are not bounded by this schema. Pricing subsequently rejects keys not present in item option groups; duplicates are not rejected. |
| `Address` (`orders.functions.ts:40`) | Trimmed name 2–80, street 4–120, unit optional/default empty ≤40, city 2–60, state exactly two ASCII letters normalized uppercase, ZIP five digits or ZIP+4, phone matching permitted digits/whitespace/`()+.-` at length 10–20, instructions optional/default empty ≤200. Strips extra properties. |
| `PlaceOrder` (`orders.functions.ts:63`) | guestId UUID; optional requestId UUID; lines 1–40 containing itemId UUID, integer quantity 1–20, Selections, removed strings ≤60 ×20, note ≤140; delivery/pickup; storeId UUID; Address or null; pickupName optional trimmed ≤80 (required ≥2 for pickup); promoCode optional/null trimmed ≤20; integer pointsToRedeem 0–100000; paymentLast4 exactly four digits. Delivery requires nonnull Address. Extras stripped. Menu/option/pricing/points/promo validated from DB before writes. |
| `Cart` (`cart.functions.ts:8`, `:32`) | guestId UUID; 0–40 lines; fulfillment delivery/pickup; storeId UUID/null. Line includes key ≤500, itemId UUID, slug ≤100, category in seven fixed values, name ≤120, imageKey ≤100, quantity integer 1–20, Selections, removed ≤20 strings ≤60, note ≤140, display unitPriceCents integer 0–100000, summary ≤40 strings ≤120, optional bundleComponents ≤30 with label ≤120 and quantity integer 1–20. Extras stripped; prices are display-only. |
| `Passcode` (`staff.functions.ts:48`, `admin.functions.ts:427`) | `{passcode: string length 1–200}`; extra fields stripped. Staff environment secret only required nonempty; admin environment secret minimum 16. Constant-time equal-length digest comparison used. No attempt quota. |
| `OrderStatus` (`staff.functions.ts:125`, `admin.functions.ts:1270`) | id UUID; status one of received/kitchen/handoff/completed/cancelled. Admin strict, staff strips extras. Backend checks transition graph and payment for provider-tagged orders; optimistic update binds current status. |
| `ImageReference` (`admin.functions.ts:69`) | Trimmed string ≤2048; empty accepted where appropriate; rejects initial two slash/backslash separators; accepts root-relative path, HTTPS URL, or alphanumeric/underscore/hyphen bundled key. Affects browser image/video destinations, not server URL fetch. |
| `MenuItem` (`admin.functions.ts:121`) | Strict. optional id UUID; name 1–120; category one of burgers/chicken/pizza/sides/drinks/kids/desserts; description ≤2000; integer price/calories 0–100000; ImageReference; ≤20 tags length1–40; ≤40 ingredients length1–80; ≤30 option groups; booleans available/featured; sort_order integer0–100000; currency literal USD default; is_quick_order boolean default false; optional quick_order_group from burgers/pizza/kids/desserts (required if quick order), quick_order_order integer0–100000; bundle_components default empty, ≤30 with label1–120, quantity1–20, optional menu UUID. |
| `OptionGroup` (`admin.functions.ts:84`) | Strict group: id regex alphanumeric/underscore/hyphen length1–60; label1–100; single/multi; optional required boolean; optional paired source_item_group_id/source_option_group_id length1–60; choices1–50 with id same regex1–60, label1–120, integer price_cents -100000–100000, optional menu_item_id UUID, optional bundle_quantity1–20. Both source IDs must be supplied together. |
| `Category` (`admin.functions.ts:157`) | Strict id from seven categories; label1–80, short1–40, blurb≤240 trimmed; sort_order integer0–1000. |
| `Settings` (`admin.functions.ts:175`) | Strict. integer delivery fee0–20000; free-delivery threshold0–100000; points_per_dollar1–1000; points_per_dollar_redeemed1–10000; reward tiers1–20 with points1–100000, label/value1–120; ticker messages≤20 strings1–160; exactly seven business_hours entries, unique allowed weekdays, closed boolean, open/close HH:mm 00:00–23:59. |
| `Store` (`admin.functions.ts:391`) | Strict optional id UUID; trimmed name1–120, address1–200, city1–80, state2–60, zip3–20, phone7–40, hours1–120; finite lat -90–90, lng -180–180; ≤20 features length1–40; optional sort_order integer0–1000. |
| `Promotion` (`admin.functions.ts:207`) | Strict optional id UUID; code alphanumeric/underscore/hyphen trimmed3–24 uppercase; label1–80; description≤240; kind amount/percent; finite positive value≤100000 (percent≤100); optional minSubtotalCents integer0–100000; optional seven-category category; optional usage_limit integer1–1000000; active boolean. No caller usage_count field accepted. |
| `CateringPackage` (`admin.functions.ts:234`) | Strict optional id UUID; name1–120, description≤1000, portion_size≤120, serves≤80 trimmed; price_cents integer0–1000000; minimum_order integer1–100000; ImageReference; active/featured booleans. |
| `CateringProtein` (`admin.functions.ts:249`) | Strict optional id UUID; name1–100, unit1–40; price_cents integer0–100000; minimum_quantity integer1–1000; active boolean. |
| `CateringInquiry` (`admin.functions.ts:275`) | Strict guest_id UUID; name2–80; valid trimmed email≤254 lowercased; phone regex permitted digits/whitespace/`()+.-` length10–20; ISO date today or later; guest_count integer1–5000; package_id UUID/null; message≤1500. No caller status accepted. |
| `GalleryItem` (`admin.functions.ts:260`) | Strict optional id UUID; nonempty ImageReference url; media_type image/video (video URL must start HTTPS); caption≤300; optional dish_id UUID; active boolean. |
| `GalleryFeedback` (`admin.functions.ts:582`) | Strict item_id UUID; optional guest_id UUID. |
| `GalleryLike` (`admin.functions.ts:311`) | Strict item_id UUID and guest_id UUID. |
| `GalleryComment` (`admin.functions.ts:302`) | Strict item_id UUID; guest_id UUID; trimmed author2–50 and text1–1000. No caller timestamps/id accepted. |
| `Id` (delete schemas) | Strict `{id: UUID}` except no-input logout handlers; missing/invalid IDs rejected by schema. |
| `CateringInquiryStatus` (`admin.functions.ts:1148`) | Strict id UUID and status new/contacted/closed. |
| `ImageUpload` (`admin.functions.ts:1196`) | Strict `{dataUrl: string ≤3000000}`; handler requires JPEG/PNG/WebP data URL base64 characters; decoded size1–2000000 bytes; claimed MIME must match accepted magic bytes. Filename is generated ObjectId. |
| `SalesPeriod` (`admin.functions.ts:1313`) | Strict period daily/weekly/monthly/yearly; date filter derived from server UTC date. |
| `QuickOrderSelection` (`catalog.functions.ts:107`) | Strict itemId UUID + Selections; requires available quick-order item, validates linked bundle availability/options, computes price from server menu. |

In tables: **V** = malformed/missing input triggers Zod validation error; **D** = DB/other unexpected errors propagate to framework/request error handling; **C** = missing/invalid session configuration or h3 failure; **A** = generic access denied before DB operation. Root HTTP tests assess final response/stack behavior. These are actual source behaviors, not an asserted per-function HTTP status specification.

## Orders (`src/lib/orders.functions.ts`)

| Function / source line | Method / input | Authentication and authorization | DB operations / state changes | Response and error behavior | Application rate limit |
| --- | --- | --- | --- | --- | --- |
| `placeOrder` :110 | POST / PlaceOrder | Public; caller guestId trusted; no authenticated ownership proof; no payment verification | Reads menu/linked menu/store/settings/promo; within transaction reads/updates guest, reserves promo usage, increments counter, inserts order, upserts user, inserts admin log. Creates providerless `not_charged` demo order and immediately credits points. Duplicate guest+request key returns existing order. | `{ok:true, orderId, orderNumber, receiptNumber, accessToken, pointsEarned}`; missing menu/store/unavailable selections return `{ok:false,error}`; PricingError returned as business error; V/D/C propagate otherwise. | None; uniqueness/idempotency only limits same request ID, not new requests. |
| `getGuestRewards` :399 | GET / GuestId | Public; no session/capability/ownership proof | Reads guests and latest 12 orders by caller guest ID with missing/not_charged/paid payment state; actual order projection excludes only `_id`; mints HMAC tokens | `{points,lifetimePoints,orders}`; full order documents plus receipt fallback and accessToken, including undeclared private/internal fields; absent guest yields zeros; V/D/C. | None. |
| `getOrder` :449 | GET / OrderCapability | Public bearer read; HMAC binds stored order+guest; no guest session needed | Reads order by ID, checks token, optionally persists legacy missing receipt_number, reads store | Full order fields plus payment/status fallbacks and public store fields; null for missing/invalid token; V/D/C. Returns guest_id and internal payment fields. | None. |

## Carts (`src/lib/cart.functions.ts`)

| Function / source line | Method / input | Authentication and authorization | DB operations / state changes | Response and error behavior | Application rate limit |
| --- | --- | --- | --- | --- | --- |
| `getCart` :39 | GET / GuestId | Public; caller ID is sole lookup authority | `carts.findOne({id:guestId})`, inclusion projection | `{lines,fulfillment,storeId}` or null; V/D | None. |
| `saveCart` :56 | POST / Cart | Public; no guest ownership proof | `carts.updateOne` with explicitly constructed allowed fields and upsert | `{ok:true}`; V/D. Input display price retained but not trusted by checkout. | None; max 40 lines after body parse. |

## Kitchen (`src/lib/staff.functions.ts`)

Staff sessions: 12h, cookie `gs-staff`, `HttpOnly`, production `Secure`, `SameSite=Lax`. No tenant/store membership exists; staff role legitimately spans operations. Authentication is custom shared passcode, not customer login.

| Function / source line | Method / input | Authentication and authorization | DB operations / state changes | Response and error behavior | Application rate limit |
| --- | --- | --- | --- | --- | --- |
| `unlockKitchen` :47 | POST / Passcode | Public login; constant-time comparison to configured STAFF_PASSCODE | No DB; h3 session update staff=true | `{ok:false}` wrong secret; `{ok:true}` correct; missing secret error; V/C | None; no minimum staff secret length beyond nonempty. |
| `lockKitchen` :59 | POST / no input validator | No prior auth required; clears caller session only | No DB; h3 clear cookie | `{ok:true}`; C | None. |
| `getKitchenBoard` :66 | GET / no input validator | Tests sealed session staff; returns locked result before DB if absent | Reads last 24h eligible orders (max 80), menu inclusion projection (unbounded count), logs (max 12), referenced stores | `{unlocked:false}` or `{unlocked:true,orders,menu,logs}` with full orders/address/payment fields; C/D | None; UI polls5s, no backend quota. |
| `setOrderStatus` :123 | POST / OrderStatus | `requireStaff` before DB; provider-tagged unpaid orders denied except cancellation; valid transition required | Reads order; compare-and-update ID+old status/history; inserts admin log | `{ok:true}` (same status idempotent); A; missing order/payment/state/concurrent-change errors; V/C/D | None. |
| `setItemAvailability` :173 | POST / `{id:UUID, available:boolean}`, strips extras | `requireStaff` before DB | Updates menu item availability/time; inserts admin log | `{ok:true}`; A; missing menu item error; V/C/D | None. |

## Catalog (`src/lib/catalog.functions.ts`)

| Function / source line | Method / input | Authentication and authorization | DB operations / state changes | Response and error behavior | Application rate limit |
| --- | --- | --- | --- | --- | --- |
| `getCategories` :49 | GET / no input validator | Public | Reads all categories sorted, `_id` excluded | Category array; bundled fallback on empty/DB error; no caller error for caught read failure | None; unbounded record count. |
| `getMenu` :66 | GET / no input validator | Public | Shared loader reads all menu; resolves linked option/bundle availability | Full menu array excluding `_id`; bundled fallback on empty/failure; logs error | None; unbounded menu count. |
| `verifyQuickOrderSelection` :106 | POST / QuickOrderSelection | Public; no private/sensitive ownership decision | Reads menu through loader; server price and linked availability computation; no writes | `{ok:true,line}` with ID/slug/category/name/image/price/summary/components; `{ok:false,error}` for nonquick/unavailable/bad options; V/D; catalog DB read can fall back | None; selections key count unbounded by schema. |
| `getStores` :121 | GET / no input validator | Public | Reads all stores sorted, `_id` excluded | Store array; bundled fallback on empty/DB failure | None; unbounded count. |

## Admin and public content (`src/lib/admin.functions.ts`)

Admin sessions: 8h, cookie `gs-admin`, `HttpOnly`, production `Secure`, `SameSite=Strict`. All 17 mutation handlers in the latter part of this module call `requireAdmin`, as does sales read (18 guarded handlers total). Public content/inquiry/feedback handlers intentionally do not require admin. Every `adminLog` inserts an action/details/time record with `admin_id:null`; DB mutation and log are usually separate operations.

| Function / source line | Method / input | Authentication and authorization | DB operations / state changes | Response and error behavior | Application rate limit |
| --- | --- | --- | --- | --- | --- |
| `getAdminSessionState` :421 | GET / no input validator | Public; verifies caller sealed admin session | No DB; may create empty h3 session cookie | `{authenticated:boolean}`; C | None. |
| `unlockAdmin` :426 | POST / Passcode | Public login; constant-time configured ADMIN_PASSCODE comparison; configured secret min16 | No DB; sets admin=true in h3 session | `{ok:false}` wrong secret; `{ok:true}` correct; configuration error if missing/short; V/C | None. |
| `lockAdmin` :439 | POST / no input validator | No prior auth required; caller session clear only | No DB; deletes caller cookie | `{ok:true}`; C | None. |
| `getCheckoutConfiguration` :445 | GET / no input validator | Public | Reads storefront settings and all promotion overrides | Delivery/points/hours/ticker settings plus mapped active promotion fields; defaults on DB failure, logs error | None; unbounded promotion read. |
| `getPublicGalleryItems` :488 | GET / no input validator | Public; active=true filter | Reads gallery active items sorted, inclusion projection, max 100 | Array id/url/media_type/caption/dish_id/created_at; [] on failure, logs error | None. |
| `getPublicCateringMenu` :516 | GET / no input validator | Public; active=true packages/proteins | Reads active packages/proteins, excludes `_id`, sorted | `{packages,proteins}` full public docs; empty arrays on error, logs | None; unbounded counts. |
| `submitCateringInquiry` :541 | POST / CateringInquiry | Public; caller guest UUID trusted; selected package must exist+active | Counts last 1h same guest inquiries; reads optional active package; inserts inquiry with generated id/status=new/package_name/times | `{ok:true}` or `{ok:false,error}` quota/unavailable package; V/D | 3/hour per caller guest_id using non-atomic count+insert; rotating IDs/concurrency bypass. |
| `getGalleryFeedback` :581 | GET / GalleryFeedback | Public; requires published active gallery item; optional guest used only to lookup like hash | Reads active post, counts likes, optionally looks up hashed guest like, reads last 100 comments with explicit public inclusion | `{likeCount,likedByMe,comments:[id,author,text,created_at]}`; inactive/missing post error; V/D | None. |
| `toggleGalleryLike` :635 | POST / GalleryLike | Public; active post required; caller guest UUID hashed but not verified | Reads active post; deletes existing pair or inserts generated like with unique gallery/hash constraint | `{liked:false}` after delete or `{liked:true}` after insert/duplicate-key handling; missing active item error; V/D | None; unique pair only, can rotate IDs. |
| `addGalleryComment` :666 | POST / GalleryComment | Public; active post required; caller guest UUID unverified | Reads active post; counts recent 1h comments same guest; inserts generated comment | `{ok:true,comment:[id,author,text,created_at]}`; `{ok:false,error}` quota; missing active item error; V/D | 5/hour per guest_id using non-atomic count+insert; bypassable. |
| `getAdminWorkspace` :707 | GET / no input validator | Admin session check before DB; returns unauthenticated flag if absent | Parallel reads orders(max 250), all menu/categories/stores/promotions/packages/proteins/gallery/settings, inquiries(max 100), logs(max 50), order customer aggregate(max 200); creates order HMAC tokens | `{authenticated:false}` or admin data object including full orders+tokens, customers/contact, inquiries, settings etc.; C/D | None; many reads/admin aggregate, several unbounded collections. |
| `getStorefrontSettings` :868 | GET / no input validator | Public | Reads storefront settings | Explicit delivery/points/reward/hours fields; defaults on failure, logs | None. |
| `saveAdminMenuItem` :892 | POST / MenuItem + OptionGroup | Admin guard before DB | Upserts explicitly mapped menu, generated/selected UUID+normalized slug/options/components; inserts action log | Saved menu item object; A/V/C/D (including slug uniqueness) | None; schema bounds individual writes. |
| `deleteAdminMenuItem` :940 | POST / Id | Admin guard before DB | Deletes menu ID; action log; no linked-component reference guard | `{ok:true}`; missing item error; A/V/C/D | None. |
| `saveAdminCategory` :952 | POST / Category | Admin guard before DB | Upserts validated category; action log | `{ok:true}`; A/V/C/D | None. |
| `saveAdminSettings` :967 | POST / Settings | Admin guard before DB | Upserts storefront settings; updates all store hours text; action log; writes not one transaction | `{ok:true}`; A/V/C/D | None. |
| `saveStoreLocation` :993 | POST / Store | Admin guard before DB | Upserts location, deduplicates features, defaults order; action log | `{ok:true,location}`; A/V/C/D | None. |
| `deleteStoreLocation` :1016 | POST / Id | Admin guard before DB | Deletes store; action log; no existing order reference check | `{ok:true}`; missing location error; A/V/C/D | None. |
| `saveAdminPromotion` :1028 | POST / Promotion | Admin guard before DB; code ownership checks for existing custom/built-in override | Reads code; upserts allowed fields; preserves/initializes usage_count; action log | `{ok:true}`; conflicting code/promotion identity error; A/V/C/D | None. |
| `deleteAdminPromotion` :1058 | POST / Id | Admin guard before DB | Reads promotion; deactivates built-in override or deletes custom; action log | `{ok:true}`; missing promotion error; A/V/C/D | None. |
| `saveAdminCateringPackage` :1081 | POST / CateringPackage | Admin guard before DB | Upserts package and updated time; action log | `{ok:true}`; A/V/C/D | None. |
| `deleteAdminCateringPackage` :1102 | POST / Id | Admin guard before DB | Deletes package; action log | `{ok:true}`; missing package error; A/V/C/D | None. |
| `saveAdminCateringProtein` :1114 | POST / CateringProtein | Admin guard before DB | Upserts protein; action log | `{ok:true}`; A/V/C/D | None. |
| `deleteAdminCateringProtein` :1135 | POST / Id | Admin guard before DB | Deletes protein; action log | `{ok:true}`; missing protein error; A/V/C/D | None. |
| `updateAdminCateringInquiry` :1147 | POST / CateringInquiryStatus | Admin guard before DB; allowed status only | Updates inquiry status/time; action log | `{ok:true}`; missing inquiry error; A/V/C/D | None. |
| `saveAdminGalleryItem` :1175 | POST / GalleryItem | Admin guard before DB | Upserts gallery URL/media/publication/caption/dish and timestamps; action log | `{ok:true}`; A/V/C/D | None. |
| `uploadAdminImage` :1195 | POST / ImageUpload | Admin guard before decoding or DB | Writes in-memory decoded image to GridFS admin_media with generated ObjectID, allowlisted kind/contentType; action log | `{url:'/api/media/<generated-id>'}`; unsupported data URL/MIME/magic/size errors; A/V/C/D | No upload quota; 3M encoded/2M decoded size only; schema bound after body parse. |
| `deleteAdminGalleryItem` :1250 | POST / Id | Admin guard before DB | Deletes feedback/likes, then gallery item, then log; no transaction; does not delete GridFS media | `{ok:true}`; missing gallery error (feedback deletions already run); A/V/C/D | None. |
| `setAdminOrderStatus` :1268 | POST / OrderStatus (strict) | Admin guard; allowed transition; provider-tagged unpaid denied except cancel | Reads order; compare-and-update ID+old status and history; action log | `{ok:true}` including same-state result; missing/payment/state/race errors; A/V/C/D | None. |
| `getAdminSales` :1312 | GET / SalesPeriod | Admin guard before DB | Server date filter; order summary aggregate and ≤5000 order rows inclusion projection | Period/time range/count/value/average/truncated plus approved order fields; A/V/C/D | None; unbounded aggregate scan within period, output max 5000. |

## Explicit HTTP endpoints

The independently reviewed HTTP API, payment schema, settlement/webhook state, and safe mock results are in [payments assessment](../agent-payments/ASSESSMENT.md). These are four routes in addition to the 44 RPC functions.

| Source / route method | Accepted input / guard | DB/network effects, output and limits |
| --- | --- | --- |
| `src/routes/api.payments.initialize.ts:105`, POST `/api/payments/initialize` | Same-origin when Origin supplied; application/json; strict guest checkout schema with authoritative USD pricing; no guest ownership proof | Creates/updates pending checkout, fixed Flutterwave API call; JSON checkout URL/order/ref, 201/200; declared Content-Length/post-buffer text limit 128000; no request quota; structured generic 400/403/409/413/415/502/503/500; no-store JSON. |
| `src/routes/api.payments.verify.ts:26`, GET `/api/payments/verify` | Public; transaction_id numeric optional; ref/order/status optional; no continuation/guest proof | Provider verification and settlement, or unsigned state change without transaction_id; 303 private token/order or checkout status redirect; no request/ID-length limit; no explicit redirect no-store. See PM-001/PM-002. |
| `src/routes/api.webhooks.flutterwave.ts:34`, POST `/api/webhooks/flutterwave` | Configured `verif-hash` timing-safe match before body/DB; validated event/ID/status/ref | Event claim, fixed provider re-fetch, settlement, event result; JSON auth/payload/upstream errors; header/post-buffer 128000 limit, no application request quota; no-store. |
| `src/routes/api.media.$id.ts:3`, GET `/api/media/:id` | Public; 24-hex ObjectID; admin-image metadata kind; JPEG/PNG/WebP MIME allowlist | GridFS read stream, length/MIME/nosniff, public max-age31536000 immutable; 404 invalid/missing/kind/type; no publication/owner/session requirement or throttle. |

## Storefront pages and root layout

Page shells being publicly routable does not imply backend privileged data is publicly readable; administrator and kitchen APIs enforce their session flags. Order/receipt access is the bearer function described above. Page routes can invoke server functions during SSR or from the hydrated client; neither changes server authorization requirements.

| Route / exact source declaration | Boundary / backend dependency |
| --- | --- |
| `/`, `src/routes/index.tsx:40` | Public catalog/storefront SSR/UI; guest cart interactions. |
| `/menu`, `src/routes/menu.tsx:16` | Public menu/category SSR; category search allowlisted to actual category IDs; Quick Order verification/catalog RPCs. |
| `/deals`, `src/routes/deals.tsx:13` | Public promotion configuration. |
| `/catering`, `src/routes/catering.tsx:22` | Public catering loader; public inquiry mutation collects bounded contact/event information. |
| `/gallery`, `src/routes/gallery.tsx:24` | Published-gallery loader; public feedback/like/comment functions. |
| `/locations`, `src/routes/locations.tsx:13` | Public store loader. |
| `/rewards`, `src/routes/rewards.tsx:37` | Public shell; client guest UUID sent to getGuestRewards; settings public. Guest history boundary B-01 applies. |
| `/account/orders`, `src/routes/account.orders.tsx:13` | Public shell; device UUID history fetch. No registered-user account system. |
| `/checkout`, `src/routes/checkout.tsx:48` | Public guest checkout; payment query state allowlist; private contact/address cached in browser; authoritative payment initialize API. |
| `/orders/:id`, `src/routes/orders.$id.tsx:15` | Optional 43-character token query; loader invokes getOrder only with token; ID UUID validator enforced by backend; missing/invalid capability yields unavailable result; noindex/nofollow. |
| `/receipts/:id`, `src/routes/receipts.$id.tsx:10` | Optional 43-character token; same getOrder loader/boundary; noindex/nofollow. |
| `/kitchen`, `src/routes/kitchen.tsx:22` | Public locked UI; getKitchenBoard/unlock/lock/status/inventory via staff session; 5s polling after unlock; noindex/nofollow. |
| `/admin`, `src/routes/admin.tsx:90` | Public locked UI; administrator workspace and 17 mutation functions plus sales read; noindex/nofollow. |
| Root layout, `src/routes/__root.tsx:75` | Root context/layout/error shell, not an extra application page path. |

## Validation and completeness

- `function-inventory.json` contains machine-parsed source names/methods/lines/guard markers. Every one of its 44 names appears in a table above; schema references capture the accepted fields, bounds and subsequent business checks.
- Compiled resolver checked read-only at `security-audit/.cache/isolated-app/.output/server/__23tanstack-start-server-fn-resolver-Bl0uB8Sk.mjs`; exactly 44 hash/object keys. No endpoint secret or capability value recorded.
- No GraphQL/OpenAPI/Swagger endpoint exists in active application source. Described function schemas act as code contracts; there is no formal versioned public API specification found.
- The separate `my-mongodb-app` example uses a Next.js public server action to ping its MongoDB connection. It is not part of the root TanStack route tree/build. Its source/config/SCA coverage is separately recorded by the payments/supply-chain reviewers; no example deployment target was tested.
- Runtime cloud edge limits, provider signatures/transports, production response headers, actual live catalog/document schemas and real MongoDB isolation were not inferred from this inventory. Root report records local tests and those gaps explicitly.
