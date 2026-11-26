# Google SEO setup

The application renders search metadata during SSR, so crawlers do not need to
wait for client JavaScript to see the title, description, canonical or structured
data. It uses its existing TanStack Start routing and photographs, with no new
SEO service, tracking script or dependency.

## Included behaviour

| Area | Implementation |
|---|---|
| Public pages | `/`, `/menu`, `/deals`, `/catering`, `/gallery`, `/locations`, `/faq`, `/support`, `/privacy`, `/terms`, `/refund-policy`, `/delivery-policy`, `/allergens`, `/cookies`, `/accessibility` |
| Metadata | Unique titles/descriptions, absolute canonical and Open Graph URLs, Twitter cards and a real food photo |
| Structured data | Homepage `WebSite`/`Organization`; public-page breadcrumbs; script-safe JSON serialization |
| Discovery | Runtime `/robots.txt` and `/sitemap.xml`, supporting GET/HEAD without database/session calls; 14 stable public URLs, with conditional Locations discovered through storefront links |
| Private pages | Checkout, rewards/device history, orders, receipts, accounts, admin and kitchen excluded from sitemap and marked `noindex` |
| Other responses | APIs, RPCs, unknown/error pages and preview/alternate hosts marked `noindex`; valid canonical-production public JPEG/PNG/WebP media remains indexable |
| Canonical filters | `/menu?cat=pizza` points to `/menu`; tracking parameters/fragments never enter SEO URLs |
| Current deals | Prefetched for initial HTML, rather than requiring client loading to replace promotion defaults |

The public route registry in [seo.ts](../src/lib/seo.ts) drives metadata and the
sitemap together. Adding a future public landing page requires its real route,
its metadata entry and a verification test. Private workflow pages must remain
outside that registry. The public Support page is indexable; support records and
administrative replies have no public lookup and remain outside search.

Locations depend on actual administrator configuration. The static sitemap
omits `/locations` so it does not advertise an unavailable location page; the
storefront links to it when real locations exist. The customer pages are lazy
loaded, and their longer policy/FAQ content is not bundled into the shared SEO
metadata module.

The sitemap omits invented update timestamps, `priority` and `changefreq`.
Restaurant addresses, phone numbers, hours, reviews, ratings and social profiles
are not invented. The bundled stores contain sample contacts; `Restaurant` /
`LocalBusiness` markup should be added only after the owner confirms actual
business/location information. The existing favicon remains in place; no
unavailable high-resolution logo is claimed in organization data.

## Deployment configuration

Use the managed deployment environment/Secrets settings for these values:

```text
PUBLIC_SITE_URL=https://your-preferred-production-domain.example
SEO_INDEXING_ENABLED=true
GOOGLE_SITE_VERIFICATION=<optional Search Console HTML-tag content value>
```

Replace the example origin with the actual preferred domain. Configure an HTTPS
root origin without credentials, query, fragment, non-default port or path.
`PUBLIC_SITE_URL` also supports payment redirects, so retain the same intended
public origin for both features. Local development can keep its existing
`http://localhost:3000`; local pages intentionally remain `noindex` and have no
production canonical until a valid public HTTPS origin is configured.

Indexing requires `NODE_ENV=production`, an explicitly valid `PUBLIC_SITE_URL`,
a request on that exact origin, and a production deployment. Vercel Preview and
Development environments remain `noindex`. An unset `SEO_INDEXING_ENABLED`
enables indexing under those conditions; `false` disables it. Unknown flag
values fail closed. Set `false` for a production domain that is not ready to
publish. A disabled/noncanonical deployment does not publish a sitemap.

Behind a self-hosted HTTPS-terminating proxy, ensure the application's incoming
Web Request URL reflects the public HTTPS origin. SEO does not guess a trusted
canonical from arbitrary `Host` or forwarding-header values. If the incoming
URL does not match the configured origin, the conservative `noindex` policy
applies.

Keep noindex pages crawlable: Google must be able to fetch a page to see its
meta/header instruction. Therefore robots allows crawling even when indexing
is disabled, but advertises no sitemap. This is an indexing policy, not an
authorization mechanism; backend access controls still protect private data.
The security audit's substantive authorization/payment fixes remain separate
work.

## Google Search Console activation

1. Deploy the SEO changes to the intended production domain.
2. Add that domain in [Google Search Console](https://search.google.com/search-console/about).
   DNS TXT verification is suitable for a Domain property. For a URL-prefix
   property's HTML-tag method, copy only the `content` value into
   `GOOGLE_SITE_VERIFICATION` and redeploy. Do not paste the entire meta tag or
   an API credential.
3. Confirm `https://your-domain.example/robots.txt` advertises the preferred
   sitemap and `https://your-domain.example/sitemap.xml` returns XML with the
   14 preferred public URLs. Use the actual production domain in those URLs.
4. Submit `sitemap.xml` in Search Console → Sitemaps.
5. Use URL Inspection on the homepage and menu to check crawlability,
   Google-selected canonical, rendered HTML and indexing eligibility. Request
   indexing for the homepage after the site is ready.
6. Validate the public JSON-LD with [Google's Rich Results Test](https://search.google.com/test/rich-results).
   Markup eligibility differs by schema type; adding metadata does not promise
   a particular ranking or rich result. Monitor indexing and search performance
   in Search Console as Google recrawls the site.

No Google account connection, sitemap submission, production deployment or
business profile change was performed by the implementation itself.

## Local verification

The SEO tests cover canonical/privacy rules, structured-data semantics and
script safety, deployment/origin gates, GET/HEAD discovery documents, public
media and noindex policies, and response stream/cookie preservation.

```sh
npm test
npx tsc --noEmit
npm run build
```

Test/build verification must use a synthetic database/provider configuration if
executing server-rendered pages. Never connect a testing harness to a live
payment provider or production database. A disabled sitemap in local or preview
mode is expected. Production serving must use the Node/Vercel runtime so the
custom server entry handles robots/sitemap; there is deliberately no static
`public/robots.txt` that could override deployment-aware policy.

## Official references

- [Google SEO starter guide](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Canonical URLs](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls)
- [Building a sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap)
- [Robots.txt](https://developers.google.com/search/docs/crawling-indexing/robots/intro)
- [Noindex instructions](https://developers.google.com/search/docs/crawling-indexing/block-indexing)
- [JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics)
- [Structured-data policies](https://developers.google.com/search/docs/appearance/structured-data/sd-policies)
- [Local business requirements](https://developers.google.com/search/docs/appearance/structured-data/local-business)

