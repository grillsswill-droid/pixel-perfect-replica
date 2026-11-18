// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// Never set ssr.external or resolve.external: the Worker has no runtime module resolution, so
// the build fails. Never add compression (compressPublicAssets, vite-plugin-compression):
// hosting already compresses at the edge.
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { fileURLToPath } from "node:url";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// tr46 (pulled in by the MongoDB driver) requires "punycode/" — the npm package, not the
// Node built-in. The Worker build aliases bare "punycode" to unenv's .mjs file, and the
// trailing slash then resolves to "<file>.mjs/" and fails. Point it at the npm package.
const punycodePackage = fileURLToPath(
  new URL("./node_modules/punycode/punycode.js", import.meta.url),
);

const nitroPreset = process.env["VERCEL"] === "1" ? "vercel" : "node-server";

// The config wrapper's nitro type lists only a few keys, but it forwards every option to
// Nitro, so `alias` is passed through a variable rather than an inline object literal.
const nitroOptions = {
  preset: nitroPreset,
  alias: { "punycode/": punycodePackage },
};

export default defineConfig({
  nitro: nitroOptions,
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
