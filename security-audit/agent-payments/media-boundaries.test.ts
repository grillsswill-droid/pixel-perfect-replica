import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryMongo } from "../tests/memory-mongo";

const state = vi.hoisted(() => ({
  database: undefined as any,
  admin: false,
  files: [] as any[],
  uploads: 0,
}));
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    let validator: ((value: any) => any) | undefined;
    const builder = {
      validator(fn: (value: any) => any) { validator = fn; return builder; },
      handler(fn: (options: any) => any) { return async (options: any = {}) => fn({ data: validator ? validator(options.data) : options.data, context: {} }); },
    };
    return builder;
  },
}));
vi.mock("@tanstack/react-start/server", () => ({
  useSession: async () => ({ data: { admin: state.admin }, update: async () => undefined, clear: async () => undefined }),
}));
vi.mock("@/lib/mongodb.server", () => ({
  getMongoDatabase: async () => { state.database.databaseCalls++; return { client: state.database.client, db: state.database }; },
  collection: (db: any, name: string) => db.collection(name),
}));
vi.mock("mongodb", async () => {
  const { Readable, Writable } = await import("node:stream");
  class ObjectId {
    constructor(private value = "aaaaaaaaaaaaaaaaaaaaaaaa") {}
    toHexString() { return this.value; }
  }
  class GridFSBucket {
    find(filter: any) {
      return { limit: () => ({ toArray: async () => state.files.filter(file => file._id === filter._id.toHexString() && file.metadata.kind === filter["metadata.kind"]) }) };
    }
    openDownloadStream(id: ObjectId) {
      return Readable.from(state.files.find(file => file._id === id.toHexString()).bytes);
    }
    openUploadStreamWithId(id: ObjectId, name: string, options: any) {
      state.uploads++;
      const chunks: Buffer[] = [];
      return new Writable({
        write(chunk, _encoding, done) { chunks.push(Buffer.from(chunk)); done(); },
        final(done) {
          const bytes = Buffer.concat(chunks);
          state.files.push({ _id: id.toHexString(), filename: name, metadata: options.metadata, length: bytes.length, bytes });
          done();
        },
      });
    }
  }
  return { ObjectId, GridFSBucket };
});

import { uploadAdminImage } from "@/lib/admin.functions";
import { Route as mediaRoute } from "@/routes/api.media.$id";

const download = (id: string) => (mediaRoute as any).options.server.handlers.GET({ params: { id } });
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j0j8AAAAASUVORK5CYII=", "base64");
const dataUrl = (bytes: Buffer, type = "image/png") => `data:${type};base64,${bytes.toString("base64")}`;

beforeEach(() => {
  state.database = new MemoryMongo();
  state.admin = false;
  state.files = [];
  state.uploads = 0;
  vi.stubEnv("SESSION_SECRET", "audit-only-signing-key-32-characters-minimum");
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("GridFS image access and upload validation", () => {
  it("denies anonymous uploads before a database or storage call", async () => {
    await expect(uploadAdminImage({ data: { dataUrl: dataUrl(png) } })).rejects.toThrow("Administrator access is required");
    expect(state.database.databaseCalls).toBe(0);
    expect(state.uploads).toBe(0);
  });
  it.each([
    "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    "data:text/html;base64,PGgxPnN5bnRoZXRpYzwvaDE+",
    "data:image/png;base64,",
    "data:image/png;base64,not-valid-base64!",
  ])("rejects unsupported or malformed upload %s", async url => {
    state.admin = true;
    await expect(uploadAdminImage({ data: { dataUrl: url } })).rejects.toThrow();
    expect(state.uploads).toBe(0);
    expect(state.database.databaseCalls).toBe(0);
  });
  it("rejects MIME and signature mismatch", async () => {
    state.admin = true;
    await expect(uploadAdminImage({ data: { dataUrl: dataUrl(png, "image/jpeg") } })).rejects.toThrow("not a valid");
    expect(state.uploads).toBe(0);
  });
  it("rejects arbitrary data disguised as an image", async () => {
    state.admin = true;
    await expect(uploadAdminImage({ data: { dataUrl: dataUrl(Buffer.from("Harmless synthetic text")) } })).rejects.toThrow("not a valid");
    expect(state.uploads).toBe(0);
  });
  it("rejects a decoded image beyond 2 MB before storage", async () => {
    state.admin = true;
    const oversized = Buffer.alloc(2_000_001); png.copy(oversized);
    await expect(uploadAdminImage({ data: { dataUrl: dataUrl(oversized) } })).rejects.toThrow("smaller than 2 MB");
    expect(state.uploads).toBe(0);
    expect(state.database.databaseCalls).toBe(0);
  });
  it("uses a server-generated ID and returns public image bytes with nosniff", async () => {
    state.admin = true;
    expect(await uploadAdminImage({ data: { dataUrl: dataUrl(png) } })).toEqual({ url: "/api/media/aaaaaaaaaaaaaaaaaaaaaaaa" });
    expect(state.files[0].filename).toBe("aaaaaaaaaaaaaaaaaaaaaaaa");
    state.admin = false;
    const response = await download("aaaaaaaaaaaaaaaaaaaaaaaa");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(png);
    // No gallery/menu publication record is needed: all admin-image IDs are public.
    expect(state.database.rows("gallery_items")).toHaveLength(0);
  });
  it.each(["../file", "aaaaaaaaaaaaaaaaaaaaaaa", "g".repeat(24)])("rejects invalid media ID %s before database access", async id => {
    expect((await download(id)).status).toBe(404);
    expect(state.database.databaseCalls).toBe(0);
  });
  it("rejects a file whose stored MIME type is outside the allowlist", async () => {
    state.files = [{ _id: "aaaaaaaaaaaaaaaaaaaaaaaa", metadata: { kind: "admin-image", contentType: "text/html" }, length: 20, bytes: Buffer.from("Harmless synthetic text") }];
    expect((await download("aaaaaaaaaaaaaaaaaaaaaaaa")).status).toBe(404);
  });
  it("does not serve GridFS files outside admin-image kind", async () => {
    state.files = [{ _id: "aaaaaaaaaaaaaaaaaaaaaaaa", metadata: { kind: "private-document", contentType: "image/png" }, length: png.length, bytes: png }];
    expect((await download("aaaaaaaaaaaaaaaaaaaaaaaa")).status).toBe(404);
  });
});
