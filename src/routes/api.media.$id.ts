import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/media/$id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const { GridFSBucket, ObjectId } = await import("mongodb");
        if (!/^[0-9a-f]{24}$/i.test(params.id)) {
          return new Response("Not found", { status: 404 });
        }

        const { Readable } = await import("node:stream");
        const { getMongoDatabase } = await import("../lib/mongodb.server");
        const { db } = await getMongoDatabase();
        const id = new ObjectId(params.id);
        const bucket = new GridFSBucket(db, { bucketName: "admin_media" });
        const [file] = await bucket
          .find({ _id: id, "metadata.kind": "admin-image" })
          .limit(1)
          .toArray();
        if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.contentType ?? "")) {
          return new Response("Not found", { status: 404 });
        }

        const stream = bucket.openDownloadStream(id);
        return new Response(Readable.toWeb(stream) as ReadableStream, {
          headers: {
            "content-type": file.contentType!,
            "content-length": String(file.length),
            "cache-control": "public, max-age=31536000, immutable",
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});
