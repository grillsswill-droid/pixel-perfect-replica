// Verify compiled public pages and support handlers using synthetic records only.
// Run against a credential-free Node build; never starts a listener or connects to providers.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const require = createRequire(path.join(root, "package.json"));
// Deny all outbound networking and native environment-file loading before importing the app.
require(path.join(root, "security-audit/scripts/no-network.cjs"));
const ts = require("typescript");
const { JSDOM } = require("jsdom");
if (!process.argv[2])
  throw new Error(
    "Usage: node scripts/verify-customer-pages.mjs /path/to/credential-free-built-copy",
  );
const directory = path.resolve(process.argv[2]);
async function fixture(relative, name) {
  const file = path.join(directory, name + ".mjs");
  fs.writeFileSync(
    file,
    ts.transpileModule(fs.readFileSync(path.join(root, relative), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText,
  );
  return import(pathToFileURL(file));
}
const { MemoryMongo } = await fixture(
  "security-audit/tests/memory-mongo.ts",
  "customer-generic-memory",
);
const { SupportMemoryMongo } = await fixture(
  "src/test/support-memory.ts",
  "customer-support-memory",
);
const generic = new MemoryMongo();
const support = new SupportMemoryMongo();
const db = {
  collection: (name) => (name.startsWith("support_") ? support : generic).collection(name),
};
globalThis.__grillSwillMongoDatabase = Promise.resolve({ db, client: support.client });
Object.assign(process.env, {
  NODE_ENV: "production",
  MONGODB_URI: "mongodb://127.0.0.1:1/synthetic",
  SESSION_SECRET: "synthetic-customer-render-key-longer-than32",
  SUPPORT_EMAIL: "",
  SUPPORT_FROM_EMAIL: "",
  RESEND_API_KEY: "",
  PUBLIC_SITE_URL: "https://grillswill.com",
  SEO_INDEXING_ENABLED: "true",
  GOOGLE_SITE_VERIFICATION: "synthetic-google-verification",
  FLW_SECRET_KEY: "",
  FLW_SECRET_HASH: "",
  ADMIN_PASSCODE: "synthetic-customer-render-admin-passcode",
});
delete process.env.VERCEL_ENV;
process.chdir(directory);
const compiled = await import(pathToFileURL(path.join(directory, ".output/server/_ssr/ssr.mjs")));
const app =
  compiled.default ?? Object.values(compiled).find((value) => value?.default?.fetch)?.default;
const checks = [];
const check = (name, passed, details = {}) =>
  checks.push({ name, passed: Boolean(passed), ...details });
const publicPaths = [
  "/",
  "/menu",
  "/deals",
  "/catering",
  "/gallery",
  "/locations",
  "/faq",
  "/support",
  "/privacy",
  "/terms",
  "/refund-policy",
  "/delivery-policy",
  "/allergens",
  "/cookies",
  "/accessibility",
];
const unavailable = await app.fetch(new Request("https://grillswill.com/locations"), {}, {});
check(
  "No locations redirect to menu",
  unavailable.status === 307 && unavailable.headers.get("location") === "/menu",
  { status: unavailable.status },
);
for (const pathname of publicPaths) {
  if (pathname === "/locations")
    generic.seed("stores", [
      {
        id: "00000000-0000-4000-8000-000000000022",
        name: "Synthetic local test grill",
        address: "1 Example Road",
        city: "Example City",
        state: "Example Region",
        zip: "00000",
        phone: "+10000000000",
        hours: "Synthetic hours",
        lat: 0,
        lng: 0,
        features: [],
      },
    ]);
  const response = await app.fetch(new Request("https://grillswill.com" + pathname), {}, {});
  const html = await response.text();
  const doc = new JSDOM(html).window.document;
  const canonicals = doc.querySelectorAll('link[rel="canonical"]');
  const robots = doc.querySelectorAll('meta[name="robots"]');
  const schemas = [...doc.querySelectorAll('script[type="application/ld+json"]')].map((x) =>
    JSON.parse(x.textContent),
  );
  check(
    "Public compiled SSR " + pathname,
    response.status === 200 &&
      doc.querySelectorAll("h1").length === 1 &&
      canonicals.length === 1 &&
      canonicals[0].getAttribute("href") === "https://grillswill.com" + pathname &&
      robots.length === 1 &&
      robots[0].getAttribute("content").startsWith("index, follow") &&
      !response.headers.has("x-robots-tag") &&
      doc.querySelectorAll('meta[name="description"]').length === 1 &&
      schemas.length === 1,
    {
      status: response.status,
      headingCount: doc.querySelectorAll("h1").length,
      canonicalCount: canonicals.length,
      schemaCount: schemas.length,
    },
  );
  check(
    "Public links and secret isolation " + pathname,
    doc.querySelector('a[href^="mailto:grillsswill@gmail.com"]') &&
      doc.querySelector('a[href="/support"]') &&
      doc.querySelector('a[href="/faq"]') &&
      !html.includes(process.env.SESSION_SECRET) &&
      !html.includes(process.env.ADMIN_PASSCODE) &&
      !html.includes(process.env.MONGODB_URI),
  );
  if (pathname === "/faq")
    check("All32 FAQ answers in SSR", doc.querySelectorAll("summary").length === 32, {
      count: doc.querySelectorAll("summary").length,
    });
  if (pathname === "/support")
    check(
      "Support form in compiled SSR",
      Boolean(doc.querySelector('form input[id="support-email"]')),
    );
  if (pathname === "/locations") generic.seed("stores", []);
  if (pathname === "/privacy")
    check(
      "Policy date and counter disclosure in SSR",
      html.includes("26") && html.includes("2026") && html.includes("not automatically deleted"),
    );
}
for (const pathname of ["/admin", "/kitchen", "/rewards", "/account/orders", "/checkout"]) {
  const response = await app.fetch(new Request("https://grillswill.com" + pathname), {}, {});
  const html = await response.text();
  const doc = new JSDOM(html).window.document;
  check(
    "Private compiled SSR " + pathname,
    response.status === 200 &&
      response.headers.get("x-robots-tag") === "noindex, nofollow" &&
      doc.querySelector('meta[name="robots"]')?.getAttribute("content").startsWith("noindex") &&
      !doc.querySelector('link[rel="canonical"]'),
    { status: response.status },
  );
}
const sitemap = await app.fetch(new Request("https://grillswill.com/sitemap.xml"), {}, {});
const sitemapText = await sitemap.text();
check(
  "Compiled sitemap14 public URLs",
  sitemap.status === 200 &&
    (sitemapText.match(/<loc>/g) ?? []).length === 14 &&
    sitemapText.includes("/support") &&
    !sitemapText.includes("/locations") &&
    !sitemapText.includes("/admin"),
  { count: (sitemapText.match(/<loc>/g) ?? []).length },
);
const id = "00000000-0000-4000-8000-000000000001";
const payload = {
  requestId: id,
  name: "Synthetic customer",
  email: "synthetic@example.invalid",
  subject: "Synthetic support check",
  message: "Harmless local persistence validation.",
  topic: "website",
  orderReference: "",
};
async function post(body, origin = "https://grillswill.com") {
  return app.fetch(
    new Request("https://grillswill.com/api/support", {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify(body),
    }),
    {},
    {},
  );
}
const first = await post(payload);
const ack = await first.json();
check(
  "Compiled support durable202",
  first.status === 202 &&
    ack.ok === true &&
    ack.reference === "GS-" + id.toUpperCase() &&
    support.rows("support_requests").length === 1 &&
    first.headers.get("cache-control") === "no-store" &&
    first.headers.get("x-robots-tag") === "noindex, nofollow",
  { status: first.status, savedRecords: support.rows("support_requests").length },
);
const repeat = await post(payload);
const repeatAck = await repeat.json();
check(
  "Compiled support idempotent retry",
  repeat.status === 202 &&
    repeatAck.reference === ack.reference &&
    support.rows("support_requests").length === 1,
);
const changed = await post({ ...payload, message: "A different synthetic support message." });
check(
  "Compiled support changed payload blocked",
  changed.status === 409 && support.rows("support_requests").length === 1,
  { status: changed.status },
);
const cross = await post(
  { ...payload, requestId: "00000000-0000-4000-8000-000000000002" },
  "https://other.example.invalid",
);
check(
  "Compiled support cross-origin blocked",
  cross.status === 403 && support.rows("support_requests").length === 1,
  { status: cross.status },
);
const invalid = await post({});
check(
  "Compiled support invalid input blocked",
  invalid.status === 400 && support.rows("support_requests").length === 1,
  { status: invalid.status },
);
const method = await app.fetch(new Request("https://grillswill.com/api/support"), {}, {});
check(
  "Compiled support wrong method blocked",
  method.status === 405 && method.headers.get("cache-control") === "no-store",
  { status: method.status },
);
const missing = await app.fetch(
  new Request("https://grillswill.com/no-such-customer-page"),
  {},
  {},
);
check(
  "Missing page404 remains noindex",
  missing.status === 404 && missing.headers.get("x-robots-tag") === "noindex, nofollow",
  { status: missing.status },
);
process.env.VERCEL_ENV = "preview";
const preview = await app.fetch(new Request("https://grillswill.com/support"), {}, {});
const previewDoc = new JSDOM(await preview.text()).window.document;
check(
  "Preview support excluded from indexing",
  preview.status === 200 &&
    preview.headers.get("x-robots-tag") === "noindex, nofollow" &&
    previewDoc.querySelector('meta[name="robots"]')?.getAttribute("content").startsWith("noindex"),
);
const result = {
  checks: checks.length,
  passed: checks.filter((x) => x.passed).length,
  failed: checks.filter((x) => !x.passed),
  environment:
    "credential-free compiled Node build, process-local synthetic Mongo, outbound networking denied, providers disabled",
  results: checks,
};
fs.writeFileSync(
  path.join(directory, "customer-ssr-results.json"),
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result, null, 2));
if (result.failed.length) process.exitCode = 1;
