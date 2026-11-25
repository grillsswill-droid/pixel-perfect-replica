// Production-compiled request handlers with synthetic Mongo/provider state.
// No TCP listener and no outbound network; real framework middleware is executed.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHmac } from 'node:crypto';
import ts from 'typescript';
import { toJSONAsync, fromCrossJSON } from 'seroval';

const root = process.cwd();
const evidence = path.join(root, 'security-audit/evidence');
const serverDir = path.join(root, 'security-audit/.cache/isolated-app/.output/server');
const memoryPath = path.join(root, 'security-audit/.cache/memory-mongo.mjs');
fs.writeFileSync(memoryPath, ts.transpileModule(fs.readFileSync(path.join(root, 'security-audit/tests/memory-mongo.ts'), 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText);
const { MemoryMongo } = await import(pathToFileURL(memoryPath));
const db = new MemoryMongo();
globalThis.__grillSwillMongoDatabase = Promise.resolve({ db, client: db.client });
const signingSecret = 'audit-only-compiled-handler-key-longer-than-32';
process.env.NODE_ENV = 'production';
process.env.SESSION_SECRET = signingSecret;
process.env.ADMIN_PASSCODE = 'audit-only-administrator-passcode';
process.env.STAFF_PASSCODE = '1234';
process.env.FLW_SECRET_KEY = 'FLWSECK_TEST-audit-placeholder';
process.env.FLW_SECRET_HASH = 'audit-only-webhook-placeholder';
process.env.PUBLIC_SITE_URL = 'https://audit.example.invalid';
process.chdir(path.join(root, 'security-audit/.cache/isolated-app'));
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const item = { id: id(20), slug: 'audit-burger', category: 'burgers', name: 'Audit Burger', description: 'Synthetic', price_cents: 3000, calories: 1, image_key: 'burger', tags: [], ingredients: [], options: [], is_available: true, is_featured: false, sort_order: 0 };
db.seed('menu_items', [item]);
db.seed('stores', [{ id: id(21), name: 'Synthetic Store' }]);
db.seed('categories', []);
db.seed('site_settings', [{ _id: 'storefront', points_per_dollar: 1 }]);
db.seed('guests', [{ id: id(1), points: 1000, lifetime_points: 1000 }]);
const now = new Date().toISOString();
const order = n => ({ id: id(n), guest_id: id(1), order_number: n, receipt_number: `GS-${n}`, status: 'received', fulfillment: 'pickup', store_id: id(21), address: null, items: [], currency: 'USD', subtotal_cents: 3000, discount_cents: 0, points_redeemed: 0, total_cents: 3248, points_earned: 300, payment_provider: 'flutterwave', payment_status: 'paid', customer_name: 'Synthetic Guest', customer_email: 'synthetic@example.invalid', created_at: now, updated_at: now });
db.seed('orders', [order(10), order(11)]);
const resolverFile = fs.readdirSync(serverDir).find(n => n.startsWith('__23tanstack-start-server-fn-resolver'));
const resolverText = fs.readFileSync(path.join(serverDir, resolverFile), 'utf8');
const inventory = [...resolverText.matchAll(/"([a-f0-9]{64})":\s*\{\s*functionName: "([^"]+)"/g)].map(m => ({ id: m[1], name: m[2].replace('_createServerFn_handler', '') }));
fs.writeFileSync(path.join(evidence, 'session-built-function-inventory.json'), JSON.stringify({ resolver: resolverFile, count: inventory.length, functions: inventory }, null, 2));
const names = Object.fromEntries(inventory.map(v => [v.name, v.id]));
const { default: app } = await import(pathToFileURL(path.join(serverDir, '_ssr/ssr.mjs')));
const observations = [];
const headersOf = response => Object.fromEntries([...response.headers].filter(([name]) => name !== 'set-cookie'));
const check = (name, passed, details = {}) => { observations.push({ name, passed, ...details }); };
async function request(route, options = {}) {
  return await app.fetch(new Request(`https://audit.example.invalid${route}`, options), {}, {});
}
async function rpc(name, method, data, extraHeaders = {}) {
  const payload = data === undefined ? undefined : JSON.stringify(await toJSONAsync({ data }));
  const headers = { 'x-tsr-serverFn': 'true', origin: 'https://audit.example.invalid', ...extraHeaders };
  let route = `/_serverFn/${names[name]}`;
  const options = { method, headers };
  if (method === 'GET') {
    if (payload) route += `?payload=${encodeURIComponent(payload)}`;
  } else if (payload) {
    headers['content-type'] = 'application/json';
    options.body = payload;
  }
  return request(route, options);
}

const originalError = console.error;
const serverLog = [];
console.error = (...args) => { serverLog.push(args.map(x => x instanceof Error ? x.message : typeof x === 'string' ? x : '[object]').join(' ').slice(0, 800)); };
try {
  const adminLocked = await rpc('getAdminSessionState', 'GET');
  const lockedBody = await adminLocked.text();
  const decodedLocked = fromCrossJSON(JSON.parse(lockedBody), { refs: new Map() });
  check('anonymous admin state is locked', adminLocked.status === 200 && decodedLocked.result?.authenticated === false, { status: adminLocked.status, headers: headersOf(adminLocked) });
  const publicHeaders = await rpc('getMenu', 'GET');
  check('public catalog handler returns synthetic menu', publicHeaders.status === 200 && (await publicHeaders.text()).includes('Audit Burger'), { status: publicHeaders.status, headers: headersOf(publicHeaders) });

  const blocked = await rpc('unlockAdmin', 'POST', { passcode: process.env.ADMIN_PASSCODE }, { origin: 'https://other.example.invalid', 'sec-fetch-site': 'cross-site' });
  check('cross-site server function blocked by real CSRF middleware', blocked.status === 403, { status: blocked.status });
  const login = await rpc('unlockAdmin', 'POST', { passcode: process.env.ADMIN_PASSCODE });
  const cookie = login.headers.get('set-cookie') ?? '';
  check('synthetic admin login succeeds with secure cookie attributes', login.status === 200 && cookie.includes('HttpOnly') && cookie.includes('Secure') && /SameSite=Strict/i.test(cookie), { status: login.status, httpOnly: /HttpOnly/i.test(cookie), secure: /Secure/i.test(cookie), sameSiteStrict: /SameSite=Strict/i.test(cookie), cookieValue: '[REDACTED]', headers: headersOf(login) });
  const csrfGet = await rpc('getAdminSessionState', 'GET', undefined, { origin: 'https://other.example.invalid', 'sec-fetch-site': 'cross-site', cookie: cookie.split(';')[0] });
  check('cross-site private GET RPC blocked', csrfGet.status === 403, { status: csrfGet.status });

  const token = createHmac('sha256', signingSecret).update(`grill-swill:order:${id(10)}:${id(1)}`).digest('base64url');
  const sharedResponse = await rpc('getOrder', 'GET', { id: id(10), token });
  const sharedText = await sharedResponse.text();
  check('order response discloses guest identifier', sharedResponse.status === 200 && sharedText.includes(id(1)), { status: sharedResponse.status });
  const rewardsResponse = await rpc('getGuestRewards', 'GET', { guestId: id(1) });
  const rewardsText = await rewardsResponse.text();
  check('built anonymous guest endpoint returns other private orders and access tokens', rewardsResponse.status === 200 && rewardsText.includes(id(11)) && rewardsText.includes('synthetic@example.invalid') && rewardsText.includes('accessToken'), { status: rewardsResponse.status, otherOrderReturned: rewardsText.includes(id(11)), privateEmailReturned: rewardsText.includes('synthetic@example.invalid'), tokenReturned: rewardsText.includes('accessToken') });
  const cartResponse = await rpc('saveCart', 'POST', { guestId: id(1), lines: [], fulfillment: 'pickup', storeId: id(21) });
  check('built anonymous cart write accepts another guest identifier', cartResponse.status === 200 && db.rows('carts').some(v => v.id === id(1)), { status: cartResponse.status });

  const legacy = await rpc('placeOrder', 'POST', { guestId: id(2), requestId: id(50), lines: [{ itemId: item.id, quantity: 1, selections: {}, removed: [], note: '' }], fulfillment: 'pickup', storeId: id(21), address: null, pickupName: 'Synthetic Guest', pointsToRedeem: 0, paymentLast4: '4242' });
  const created = db.rows('orders').find(v => v.guest_id === id(2));
  check('production compiled legacy checkout creates uncharged reward-bearing order', legacy.status === 200 && created?.payment_status === 'not_charged' && !created.payment_provider && db.rows('guests').find(v => v.id === id(2))?.points > 0, { status: legacy.status, uncharged: created?.payment_status === 'not_charged', providerAbsent: !created?.payment_provider, rewardsAwarded: db.rows('guests').find(v => v.id === id(2))?.points > 0 });
  const kitchenLogin = await rpc('unlockKitchen', 'POST', { passcode: '1234' });
  const staffCookie = kitchenLogin.headers.get('set-cookie')?.split(';')[0] ?? '';
  const kitchen = await rpc('getKitchenBoard', 'GET', undefined, { cookie: staffCookie });
  check('built kitchen board accepts unpaid legacy order for fulfillment', kitchen.status === 200 && created && (await kitchen.text()).includes(created.id), { status: kitchen.status });

  for (const [name, route, options, expected] of [
    ['malformed payment JSON rejected', '/api/payments/initialize', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://audit.example.invalid' }, body: '{' }, 400],
    ['wrong-origin payment initialization blocked', '/api/payments/initialize', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://other.example.invalid' }, body: '{}' }, 403],
    ['unsigned webhook rejected', '/api/webhooks/flutterwave', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' }, 401],
    ['media traversal identifier rejected', '/api/media/..%2F..%2Fetc%2Fpasswd', { method: 'GET' }, 404],
  ]) {
    const response = await request(route, options);
    check(name, response.status === expected, { status: response.status, expected });
  }
  const unknown = await request('/_serverFn/' + '0'.repeat(64), { headers: { 'x-tsr-serverFn': 'true', origin: 'https://audit.example.invalid' } });
  const errorBody = await unknown.text();
  check('unknown function returns generic failure without stack or path', unknown.status >= 400 && !errorBody.includes(root) && !errorBody.includes('node_modules') && !errorBody.includes('at '), { status: unknown.status, headers: headersOf(unknown) });
  const report = { started: now, finished: new Date().toISOString(), environment: 'credential-free production-compiled TanStack/Nitro handlers; no listener/outbound network; process-local MemoryMongo', functionCount: inventory.length, checks: observations, failed: observations.filter(v => !v.passed).length, network: 'blocked by preload', limitations: ['No real MongoDB concurrency, server/IAM/TLS/CDN/WAF behaviour.', 'Request handler invocation, not TCP/browser-based DAST or ZAP.', 'Synthetic cookies/tokens omitted from evidence.'], logMessages: serverLog };
  fs.writeFileSync(path.join(evidence, 'session-built-handler-results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ checks: observations.length, passed: observations.filter(v => v.passed).length, failed: report.failed, functionCount: inventory.length }, null, 2));
  if (report.failed) process.exitCode = 1;
} finally {
  console.error = originalError;
}

