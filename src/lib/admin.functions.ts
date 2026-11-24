import { createServerFn } from "@tanstack/react-start";
import type { Document } from "mongodb";
import { z } from "zod";

import {
  normalizeBundleComponents,
  normalizeOptionGroups,
  type CategoryId,
  type MenuCategory,
  type MenuItem,
} from "./menu-types";
import type {
  AdminLogDocument,
  CateringInquiryDocument,
  GalleryCommentDocument,
  GalleryLikeDocument,
  OrderDocument,
} from "./mongodb.server";
import { canTransitionOrder, type OrderStatus } from "./order-status";
import {
  DEFAULT_REWARD_TIERS,
  DELIVERY_FEE_CENTS,
  FREE_DELIVERY_THRESHOLD_CENTS,
  POINTS_PER_DOLLAR,
  POINTS_PER_DOLLAR_REDEEMED,
  PROMOS,
  type PromoDefinition,
} from "./pricing";
import { DEFAULT_TICKER_MESSAGES } from "./site-content";

type AdminSession = { admin?: boolean };

const adminSessionConfig = () => {
  const password = process.env["SESSION_SECRET"];
  if (!password || password.length < 32) {
    throw new Error("SESSION_SECRET must be configured with at least 32 characters.");
  }
  return {
    password,
    name: "gs-admin",
    maxAge: 60 * 60 * 8,
    cookie: {
      httpOnly: true,
      secure: process.env["NODE_ENV"] === "production",
      sameSite: "strict" as const,
      path: "/",
    },
  };
};

async function getAdminSession() {
  const { useSession: createSession } = await import("@tanstack/react-start/server");
  return createSession<AdminSession>(adminSessionConfig());
}

async function requireAdmin() {
  const session = await getAdminSession();
  if (!session.data.admin) throw new Error("Administrator access is required.");
}

async function secretMatches(input: string, expected: string) {
  const { createHash, timingSafeEqual } = await import("node:crypto");
  return timingSafeEqual(
    createHash("sha256").update(input, "utf8").digest(),
    createHash("sha256").update(expected, "utf8").digest(),
  );
}

const imageReference = z
  .string()
  .trim()
  .max(2048)
  .refine((value) => {
    if (!value) return true;
    if (/^\s*[/\\]{2}/.test(value)) return false;
    if (value.startsWith("/")) return true;
    try {
      return new URL(value).protocol === "https:";
    } catch {
      return /^[a-z0-9_-]+$/i.test(value);
    }
  }, "Use a bundled image key, root-relative path, or http(s) URL.");

const optionSchema = z
  .object({
    id: z
      .string()
      .trim()
      .min(1)
      .max(60)
      .regex(/^[a-z0-9_-]+$/i),
    label: z.string().trim().min(1).max(100),
    type: z.enum(["single", "multi"]),
    required: z.boolean().optional(),
    source_item_group_id: z.string().trim().min(1).max(60).optional(),
    source_option_group_id: z.string().trim().min(1).max(60).optional(),
    choices: z
      .array(
        z.object({
          id: z
            .string()
            .trim()
            .min(1)
            .max(60)
            .regex(/^[a-z0-9_-]+$/i),
          label: z.string().trim().min(1).max(120),
          price_cents: z.number().int().min(-100_000).max(100_000),
          menu_item_id: z.string().uuid().optional(),
          bundle_quantity: z.number().int().min(1).max(20).optional(),
        }),
      )
      .min(1)
      .max(50),
  })
  .strict()
  .refine(
    (group) => Boolean(group.source_item_group_id) === Boolean(group.source_option_group_id),
    "Linked option groups need both source group IDs.",
  );

const menuItemSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(120),
    category: z.enum(["burgers", "chicken", "pizza", "sides", "drinks", "kids", "desserts"]),
    description: z.string().trim().max(2000),
    price_cents: z.number().int().min(0).max(100_000),
    calories: z.number().int().min(0).max(100_000),
    image_key: imageReference,
    tags: z.array(z.string().trim().min(1).max(40)).max(20),
    ingredients: z.array(z.string().trim().min(1).max(80)).max(40),
    options: z.array(optionSchema).max(30),
    is_available: z.boolean(),
    is_featured: z.boolean(),
    sort_order: z.number().int().min(0).max(100_000),
    currency: z.literal("USD").default("USD"),
    is_quick_order: z.boolean().default(false),
    quick_order_group: z.enum(["burgers", "pizza", "kids", "desserts"]).optional(),
    quick_order_order: z.number().int().min(0).max(100_000).optional(),
    bundle_components: z
      .array(
        z.object({
          label: z.string().trim().min(1).max(120),
          quantity: z.number().int().min(1).max(20),
          menu_item_id: z.string().uuid().optional(),
        }),
      )
      .max(30)
      .default([]),
  })
  .strict()
  .refine(
    (item) => !item.is_quick_order || Boolean(item.quick_order_group),
    "Choose a Quick Order category for this item.",
  );

const categorySchema = z
  .object({
    id: z.enum(["burgers", "chicken", "pizza", "sides", "drinks", "kids", "desserts"]),
    label: z.string().trim().min(1).max(80),
    short: z.string().trim().min(1).max(40),
    blurb: z.string().trim().max(240),
    sort_order: z.number().int().min(0).max(1000),
  })
  .strict();

const rewardTierSchema = z
  .object({
    points: z.number().int().min(1).max(100_000),
    label: z.string().trim().min(1).max(120),
    value: z.string().trim().min(1).max(120),
  })
  .strict();

const settingsSchema = z
  .object({
    delivery_fee_cents: z.number().int().min(0).max(20_000),
    free_delivery_threshold_cents: z.number().int().min(0).max(100_000),
    points_per_dollar: z.number().int().min(1).max(1000),
    points_per_dollar_redeemed: z.number().int().min(1).max(10_000),
    reward_tiers: z.array(rewardTierSchema).min(1).max(20),
    ticker_messages: z.array(z.string().trim().min(1).max(160)).max(20),
    business_hours: z
      .array(
        z.object({
          day: z.enum([
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
          ]),
          closed: z.boolean(),
          open: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
          close: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
        }),
      )
      .length(7),
  })
  .strict()
  .refine((settings) => new Set(settings.business_hours.map((entry) => entry.day)).size === 7, {
    message: "Include each day of the week exactly once.",
  });

const promotionSchema = z
  .object({
    id: z.string().uuid().optional(),
    code: z
      .string()
      .trim()
      .min(3)
      .max(24)
      .regex(/^[A-Z0-9_-]+$/i)
      .transform((v) => v.toUpperCase()),
    label: z.string().trim().min(1).max(80),
    description: z.string().trim().max(240),
    kind: z.enum(["amount", "percent"]),
    value: z.number().finite().positive().max(100_000),
    minSubtotalCents: z.number().int().min(0).max(100_000).optional(),
    category: z
      .enum(["burgers", "chicken", "pizza", "sides", "drinks", "kids", "desserts"])
      .optional(),
    usage_limit: z.number().int().min(1).max(1_000_000).optional(),
    active: z.boolean(),
  })
  .strict()
  .refine((value) => value.kind !== "percent" || value.value <= 100, {
    message: "Percentage discounts cannot exceed 100%.",
    path: ["value"],
  });

const cateringSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().max(1000),
    portion_size: z.string().trim().max(120),
    serves: z.string().trim().max(80),
    price_cents: z.number().int().min(0).max(1_000_000),
    minimum_order: z.number().int().min(1).max(100_000),
    image_key: imageReference,
    active: z.boolean(),
    featured: z.boolean(),
  })
  .strict();

const cateringProteinSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(100),
    price_cents: z.number().int().min(0).max(100_000),
    unit: z.string().trim().min(1).max(40),
    minimum_quantity: z.number().int().min(1).max(1000),
    active: z.boolean(),
  })
  .strict();

const gallerySchema = z
  .object({
    id: z.string().uuid().optional(),
    url: imageReference.refine((value) => value.length > 0, "Add an image URL or image key."),
    media_type: z.enum(["image", "video"]),
    caption: z.string().trim().max(300),
    dish_id: z.string().uuid().optional(),
    active: z.boolean(),
  })
  .strict()
  .refine((value) => value.media_type !== "video" || value.url.startsWith("https://"), {
    message: "Videos must use an HTTPS URL.",
    path: ["url"],
  });

const cateringInquirySchema = z
  .object({
    guest_id: z.string().uuid(),
    name: z.string().trim().min(2).max(80),
    email: z
      .string()
      .trim()
      .email()
      .max(254)
      .transform((value) => value.toLowerCase()),
    phone: z
      .string()
      .trim()
      .regex(/^[\d\s()+.-]{10,20}$/),
    event_date: z
      .string()
      .date()
      .refine((value) => value >= new Date().toISOString().slice(0, 10), {
        message: "Choose today or a future event date.",
      }),
    guest_count: z.number().int().min(1).max(5000),
    package_id: z.string().uuid().nullable(),
    message: z.string().trim().max(1500),
  })
  .strict();

const galleryFeedbackId = z.string().uuid();
const galleryCommentSchema = z
  .object({
    item_id: galleryFeedbackId,
    guest_id: z.string().uuid(),
    author: z.string().trim().min(2).max(50),
    text: z.string().trim().min(1).max(1000),
  })
  .strict();

const galleryLikeSchema = z
  .object({
    item_id: galleryFeedbackId,
    guest_id: z.string().uuid(),
  })
  .strict();

type StoreSettings = z.infer<typeof settingsSchema> & { _id: "storefront" } & Document;
type StoreLocation = {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  lat: number;
  lng: number;
  hours: string;
  features: string[];
  sort_order?: number;
};
type PromotionDocument = z.infer<typeof promotionSchema> & {
  id: string;
  usage_count: number;
  created_at: string;
  updated_at: string;
} & Document;
type CateringDocument = z.infer<typeof cateringSchema> & {
  id: string;
  updated_at: string;
} & Document;
type CateringProteinDocument = z.infer<typeof cateringProteinSchema> & {
  id: string;
  updated_at: string;
} & Document;
type GalleryDocument = z.infer<typeof gallerySchema> & {
  id: string;
  created_at: string;
  updated_at: string;
} & Document;

const DEFAULT_HOURS: StoreSettings["business_hours"] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
].map((day) => ({
  day: day as StoreSettings["business_hours"][number]["day"],
  closed: false,
  open: "07:00",
  close: "23:00",
}));

function fallbackCheckoutConfiguration() {
  return {
    deliveryFeeCents: DELIVERY_FEE_CENTS,
    freeDeliveryThresholdCents: FREE_DELIVERY_THRESHOLD_CENTS,
    pointsPerDollar: POINTS_PER_DOLLAR,
    pointsPerDollarRedeemed: POINTS_PER_DOLLAR_REDEEMED,
    businessHours: DEFAULT_HOURS,
    tickerMessages: DEFAULT_TICKER_MESSAGES,
    promotions: PROMOS,
  };
}

function fallbackStorefrontSettings() {
  return {
    delivery_fee_cents: DELIVERY_FEE_CENTS,
    free_delivery_threshold_cents: FREE_DELIVERY_THRESHOLD_CENTS,
    points_per_dollar: POINTS_PER_DOLLAR,
    points_per_dollar_redeemed: POINTS_PER_DOLLAR_REDEEMED,
    reward_tiers: DEFAULT_REWARD_TIERS,
    business_hours: DEFAULT_HOURS,
  };
}

const storeLocationSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z.string().trim().min(1).max(120),
    address: z.string().trim().min(1).max(200),
    city: z.string().trim().min(1).max(80),
    state: z.string().trim().min(2).max(60),
    zip: z.string().trim().min(3).max(20),
    phone: z.string().trim().min(7).max(40),
    lat: z.number().finite().min(-90).max(90),
    lng: z.number().finite().min(-180).max(180),
    hours: z.string().trim().min(1).max(120),
    features: z.array(z.string().trim().min(1).max(40)).max(20),
    sort_order: z.number().int().min(0).max(1000).optional(),
  })
  .strict();

async function adminLog(action: string, details: Record<string, string | number | boolean | null>) {
  const { randomUUID } = await import("node:crypto");
  const { collection, getMongoDatabase } = await import("./mongodb.server");
  const { db } = await getMongoDatabase();
  await collection<AdminLogDocument>(db, "admin_logs").insertOne({
    id: randomUUID(),
    admin_id: null,
    action,
    details,
    created_at: new Date().toISOString(),
  });
}

export const getAdminSessionState = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getAdminSession();
  return { authenticated: Boolean(session.data.admin) };
});

export const unlockAdmin = createServerFn({ method: "POST" })
  .validator((value: unknown) => z.object({ passcode: z.string().min(1).max(200) }).parse(value))
  .handler(async ({ data }) => {
    const expected = process.env["ADMIN_PASSCODE"];
    if (!expected || expected.length < 16) {
      throw new Error("Set ADMIN_PASSCODE to a unique secret of at least 16 characters.");
    }
    if (!(await secretMatches(data.passcode, expected))) return { ok: false as const };
    const session = await getAdminSession();
    await session.update({ admin: true });
    return { ok: true as const };
  });

export const lockAdmin = createServerFn({ method: "POST" }).handler(async () => {
  const session = await getAdminSession();
  await session.clear();
  return { ok: true as const };
});

export const getCheckoutConfiguration = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    const settings = await db
      .collection<StoreSettings>("site_settings")
      .findOne({ _id: "storefront" });
    const promotionOverrides = await db
      .collection<PromotionDocument>("promotions")
      .find({})
      .project<PromotionDocument>({ _id: 0 })
      .toArray();
    const overriddenCodes = new Set(promotionOverrides.map((promo) => promo.code));
    const promotions: PromoDefinition[] = [
      ...promotionOverrides
        .filter((promo) => promo.active)
        .map(({ code, label, description, kind, value, minSubtotalCents, category }) => ({
          code,
          label,
          description,
          kind,
          value,
          ...(minSubtotalCents !== undefined ? { minSubtotalCents } : {}),
          ...(category ? { category } : {}),
        })),
      ...PROMOS.filter((promo) => !overriddenCodes.has(promo.code)),
    ];
    return {
      deliveryFeeCents: settings?.delivery_fee_cents ?? DELIVERY_FEE_CENTS,
      freeDeliveryThresholdCents:
        settings?.free_delivery_threshold_cents ?? FREE_DELIVERY_THRESHOLD_CENTS,
      pointsPerDollar: settings?.points_per_dollar ?? POINTS_PER_DOLLAR,
      pointsPerDollarRedeemed: settings?.points_per_dollar_redeemed ?? POINTS_PER_DOLLAR_REDEEMED,
      businessHours: settings?.business_hours ?? DEFAULT_HOURS,
      tickerMessages: settings?.ticker_messages ?? DEFAULT_TICKER_MESSAGES,
      promotions,
    };
  } catch (error) {
    console.error("Checkout configuration unavailable; using storefront defaults.", error);
    return fallbackCheckoutConfiguration();
  }
});

export const getPublicGalleryItems = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    return await db
      .collection<GalleryDocument>("gallery_items")
      .find({ active: true })
      .project<
        Pick<GalleryDocument, "id" | "url" | "media_type" | "caption" | "dish_id" | "created_at"> &
          Document
      >({
        _id: 0,
        id: 1,
        url: 1,
        media_type: 1,
        caption: 1,
        dish_id: 1,
        created_at: 1,
      })
      .sort({ created_at: -1 })
      .limit(100)
      .toArray();
  } catch (error) {
    console.error("Gallery data unavailable; showing the empty state.", error);
    return [];
  }
});

export const getPublicCateringMenu = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    const [packages, proteins] = await Promise.all([
      db
        .collection<CateringDocument>("catering_packages")
        .find({ active: true })
        .project<CateringDocument>({ _id: 0 })
        .sort({ featured: -1, name: 1 })
        .toArray(),
      db
        .collection<CateringProteinDocument>("catering_proteins")
        .find({ active: true })
        .project<CateringProteinDocument>({ _id: 0 })
        .sort({ name: 1 })
        .toArray(),
    ]);
    return { packages, proteins };
  } catch (error) {
    console.error("Catering data unavailable; showing the contact fallback.", error);
    return { packages: [], proteins: [] };
  }
});

export const submitCateringInquiry = createServerFn({ method: "POST" })
  .validator((value: unknown) => cateringInquirySchema.parse(value))
  .handler(async ({ data }) => {
    const { randomUUID } = await import("node:crypto");
    const { getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    const now = new Date();
    const recentCount = await db
      .collection<CateringInquiryDocument>("catering_inquiries")
      .countDocuments({
        guest_id: data.guest_id,
        created_at: { $gte: new Date(now.getTime() - 60 * 60 * 1000).toISOString() },
      });
    if (recentCount >= 3) {
      return { ok: false as const, error: "Please wait before sending another catering request." };
    }

    let packageName: string | null = null;
    if (data.package_id) {
      const selectedPackage = await db
        .collection<CateringDocument>("catering_packages")
        .findOne({ id: data.package_id, active: true }, { projection: { _id: 0, name: 1 } });
      if (!selectedPackage) {
        return { ok: false as const, error: "That catering package is no longer available." };
      }
      packageName = selectedPackage.name;
    }

    const inquiry: CateringInquiryDocument = {
      id: randomUUID(),
      ...data,
      package_name: packageName,
      status: "new",
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };
    await db.collection<CateringInquiryDocument>("catering_inquiries").insertOne(inquiry);
    return { ok: true as const };
  });

export const getGalleryFeedback = createServerFn({ method: "GET" })
  .validator((value: unknown) =>
    z
      .object({ item_id: galleryFeedbackId, guest_id: z.string().uuid().optional() })
      .strict()
      .parse(value),
  )
  .handler(async ({ data }) => {
    const { collection, getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    const item = await collection<GalleryDocument>(db, "gallery_items").findOne({
      id: data.item_id,
      active: true,
    });
    if (!item) throw new Error("This gallery post is no longer available.");

    const { createHash } = await import("node:crypto");
    const visitorHash = data.guest_id
      ? createHash("sha256").update(data.guest_id).digest("hex")
      : null;
    const [likeCount, liked, comments] = await Promise.all([
      db.collection<GalleryLikeDocument>("gallery_likes").countDocuments({
        gallery_item_id: data.item_id,
      }),
      visitorHash
        ? db
            .collection<GalleryLikeDocument>("gallery_likes")
            .findOne(
              { gallery_item_id: data.item_id, visitor_hash: visitorHash },
              { projection: { _id: 1 } },
            )
        : Promise.resolve(null),
      db
        .collection<GalleryCommentDocument>("gallery_comments")
        .find(
          { gallery_item_id: data.item_id },
          { projection: { _id: 0, id: 1, author: 1, text: 1, created_at: 1 } },
        )
        .sort({ created_at: -1 })
        .limit(100)
        .toArray(),
    ]);
    return {
      likeCount,
      likedByMe: Boolean(liked),
      comments: comments.map((comment) => ({
        id: String(comment.id),
        author: String(comment.author),
        text: String(comment.text),
        created_at: String(comment.created_at),
      })),
    };
  });

export const toggleGalleryLike = createServerFn({ method: "POST" })
  .validator((value: unknown) => galleryLikeSchema.parse(value))
  .handler(async ({ data }) => {
    const { createHash, randomUUID } = await import("node:crypto");
    const { getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    const itemExists = await db
      .collection<GalleryDocument>("gallery_items")
      .findOne({ id: data.item_id, active: true }, { projection: { _id: 1 } });
    if (!itemExists) throw new Error("This gallery post is no longer available.");
    const visitorHash = createHash("sha256").update(data.guest_id).digest("hex");
    const likes = db.collection<GalleryLikeDocument>("gallery_likes");
    const removed = await likes.deleteOne({
      gallery_item_id: data.item_id,
      visitor_hash: visitorHash,
    });
    if (removed.deletedCount) return { liked: false };

    try {
      await likes.insertOne({
        id: randomUUID(),
        gallery_item_id: data.item_id,
        visitor_hash: visitorHash,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
    }
    return { liked: true };
  });

export const addGalleryComment = createServerFn({ method: "POST" })
  .validator((value: unknown) => galleryCommentSchema.parse(value))
  .handler(async ({ data }) => {
    const { randomUUID } = await import("node:crypto");
    const { getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    const itemExists = await db
      .collection<GalleryDocument>("gallery_items")
      .findOne({ id: data.item_id, active: true }, { projection: { _id: 1 } });
    if (!itemExists) throw new Error("This gallery post is no longer available.");

    const now = new Date();
    const recentCount = await db
      .collection<GalleryCommentDocument>("gallery_comments")
      .countDocuments({
        guest_id: data.guest_id,
        created_at: { $gte: new Date(now.getTime() - 60 * 60 * 1000).toISOString() },
      });
    if (recentCount >= 5) {
      return { ok: false as const, error: "Please wait before posting another comment." };
    }
    const comment: GalleryCommentDocument = {
      id: randomUUID(),
      gallery_item_id: data.item_id,
      guest_id: data.guest_id,
      author: data.author,
      text: data.text,
      created_at: now.toISOString(),
    };
    await db.collection<GalleryCommentDocument>("gallery_comments").insertOne(comment);
    return {
      ok: true as const,
      comment: {
        id: comment.id,
        author: comment.author,
        text: comment.text,
        created_at: comment.created_at,
      },
    };
  });

export const getAdminWorkspace = createServerFn({ method: "GET" }).handler(async () => {
  const session = await getAdminSession();
  if (!session.data.admin) return { authenticated: false as const };

  const { collection, getMongoDatabase } = await import("./mongodb.server");
  const { db } = await getMongoDatabase();
  const [
    orders,
    menu,
    categories,
    settings,
    stores,
    promotions,
    catering,
    cateringProteins,
    cateringInquiries,
    gallery,
    customers,
    logs,
  ] = await Promise.all([
    collection<OrderDocument>(db, "orders")
      .find({})
      .project<OrderDocument>({ _id: 0 })
      .sort({ created_at: -1 })
      .limit(250)
      .toArray(),
    collection<MenuItem>(db, "menu_items")
      .find({})
      .project<MenuItem>({ _id: 0 })
      .sort({ category: 1, sort_order: 1 })
      .toArray(),
    collection<MenuCategory>(db, "categories")
      .find({})
      .project<MenuCategory>({ _id: 0 })
      .sort({ sort_order: 1 })
      .toArray(),
    db.collection<StoreSettings>("site_settings").findOne({ _id: "storefront" }),
    db
      .collection<StoreLocation>("stores")
      .find({})
      .project<StoreLocation>({ _id: 0 })
      .sort({ sort_order: 1, name: 1 })
      .toArray(),
    db
      .collection<PromotionDocument>("promotions")
      .find({})
      .project<PromotionDocument>({ _id: 0 })
      .sort({ created_at: -1 })
      .toArray(),
    db
      .collection<CateringDocument>("catering_packages")
      .find({})
      .project<CateringDocument>({ _id: 0 })
      .sort({ name: 1 })
      .toArray(),
    db
      .collection<CateringProteinDocument>("catering_proteins")
      .find({})
      .project<CateringProteinDocument>({ _id: 0 })
      .sort({ name: 1 })
      .toArray(),
    db
      .collection<CateringInquiryDocument>("catering_inquiries")
      .find({})
      .project<CateringInquiryDocument>({ _id: 0 })
      .sort({ created_at: -1 })
      .limit(100)
      .toArray(),
    db
      .collection<GalleryDocument>("gallery_items")
      .find({})
      .project<GalleryDocument>({ _id: 0 })
      .sort({ created_at: -1 })
      .toArray(),
    collection<OrderDocument>(db, "orders")
      .aggregate<{
        guest_id: string;
        customer_name: string;
        customer_phone?: string | null;
        order_count: number;
        last_order_at: string;
        order_value_cents: number;
      }>([
        {
          $match: {
            $or: [
              { payment_status: { $exists: false } },
              { payment_status: { $in: ["not_charged", "paid"] } },
            ],
          },
        },
        { $sort: { created_at: -1 } },
        {
          $group: {
            _id: "$guest_id",
            guest_id: { $first: "$guest_id" },
            customer_name: { $first: "$customer_name" },
            customer_phone: { $first: "$customer_phone" },
            order_count: { $sum: 1 },
            last_order_at: { $first: "$created_at" },
            order_value_cents: { $sum: "$total_cents" },
          },
        },
        { $sort: { last_order_at: -1 } },
        { $limit: 200 },
        { $project: { _id: 0 } },
      ])
      .toArray(),
    collection<AdminLogDocument>(db, "admin_logs")
      .find({})
      .project<AdminLogDocument>({ _id: 0 })
      .sort({ created_at: -1 })
      .limit(50)
      .toArray(),
  ]);
  const { createOrderAccessToken } = await import("./order-access.server");
  const storedPromotionCodes = new Set(promotions.map((promo) => promo.code));
  return {
    authenticated: true as const,
    orders: orders.map((order) => ({
      ...order,
      access_token: createOrderAccessToken(order.id, order.guest_id),
    })),
    menu,
    categories,
    settings: {
      _id: "storefront" as const,
      delivery_fee_cents: settings?.delivery_fee_cents ?? DELIVERY_FEE_CENTS,
      free_delivery_threshold_cents:
        settings?.free_delivery_threshold_cents ?? FREE_DELIVERY_THRESHOLD_CENTS,
      points_per_dollar: settings?.points_per_dollar ?? POINTS_PER_DOLLAR,
      points_per_dollar_redeemed:
        settings?.points_per_dollar_redeemed ?? POINTS_PER_DOLLAR_REDEEMED,
      reward_tiers: settings?.reward_tiers?.length ? settings.reward_tiers : DEFAULT_REWARD_TIERS,
      ticker_messages: settings?.ticker_messages ?? DEFAULT_TICKER_MESSAGES,
      business_hours: settings?.business_hours ?? DEFAULT_HOURS,
    },
    stores,
    promotions: [
      ...promotions.map((promo) => ({
        ...promo,
        is_builtin: PROMOS.some((builtIn) => builtIn.code === promo.code),
      })),
      ...PROMOS.filter((promo) => !storedPromotionCodes.has(promo.code)).map((promo) => ({
        ...promo,
        id: `builtin:${promo.code}`,
        usage_limit: undefined as number | undefined,
        usage_count: 0,
        active: true,
        is_builtin: true,
      })),
    ],
    catering,
    cateringProteins,
    cateringInquiries,
    gallery,
    customers,
    logs,
  };
});

export const getStorefrontSettings = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    const settings = await db
      .collection<StoreSettings>("site_settings")
      .findOne({ _id: "storefront" });

    return {
      delivery_fee_cents: settings?.delivery_fee_cents ?? DELIVERY_FEE_CENTS,
      free_delivery_threshold_cents:
        settings?.free_delivery_threshold_cents ?? FREE_DELIVERY_THRESHOLD_CENTS,
      points_per_dollar: settings?.points_per_dollar ?? POINTS_PER_DOLLAR,
      points_per_dollar_redeemed:
        settings?.points_per_dollar_redeemed ?? POINTS_PER_DOLLAR_REDEEMED,
      reward_tiers: settings?.reward_tiers?.length ? settings.reward_tiers : DEFAULT_REWARD_TIERS,
      business_hours: settings?.business_hours ?? DEFAULT_HOURS,
    };
  } catch (error) {
    console.error("Rewards settings unavailable; using storefront defaults.", error);
    return fallbackStorefrontSettings();
  }
});

export const saveAdminMenuItem = createServerFn({ method: "POST" })
  .validator((value: unknown) => menuItemSchema.parse(value))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { randomUUID } = await import("node:crypto");
    const { collection, getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    const now = new Date().toISOString();
    const id = data.id ?? randomUUID();
    const slug = data.name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const item: MenuItem & { updated_at: string } = {
      id,
      slug,
      name: data.name,
      category: data.category,
      description: data.description,
      price_cents: data.price_cents,
      calories: data.calories,
      image_key: data.image_key,
      tags: data.tags,
      ingredients: data.ingredients,
      options: normalizeOptionGroups(data.options),
      is_available: data.is_available,
      is_featured: data.is_featured,
      sort_order: data.sort_order,
      currency: data.currency,
      is_quick_order: data.is_quick_order,
      ...(data.quick_order_group ? { quick_order_group: data.quick_order_group } : {}),
      ...(data.quick_order_order !== undefined
        ? { quick_order_order: data.quick_order_order }
        : {}),
      bundle_components: normalizeBundleComponents(data.bundle_components),
      updated_at: now,
    };
    await collection<MenuItem & { updated_at: string }>(db, "menu_items").updateOne(
      { id },
      { $set: item },
      { upsert: true },
    );
    await adminLog(data.id ? "menu_item_updated" : "menu_item_created", { item_id: id });
    return item;
  });

export const deleteAdminMenuItem = createServerFn({ method: "POST" })
  .validator((value: unknown) => z.object({ id: z.string().uuid() }).strict().parse(value))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { collection, getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    const result = await collection<MenuItem>(db, "menu_items").deleteOne({ id: data.id });
    if (!result.deletedCount) throw new Error("That menu item no longer exists.");
    await adminLog("menu_item_deleted", { item_id: data.id });
    return { ok: true as const };
  });

export const saveAdminCategory = createServerFn({ method: "POST" })
  .validator((value: unknown) => categorySchema.parse(value))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { collection, getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    await collection<MenuCategory>(db, "categories").updateOne(
      { id: data.id as CategoryId },
      { $set: data },
      { upsert: true },
    );
    await adminLog("category_updated", { category_id: data.id });
    return { ok: true as const };
  });

export const saveAdminSettings = createServerFn({ method: "POST" })
  .validator((value: unknown) => settingsSchema.parse(value))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    await db
      .collection<StoreSettings>("site_settings")
      .updateOne({ _id: "storefront" }, { $set: data }, { upsert: true });
    const hoursText = data.business_hours
      .map(
        (entry) =>
          `${entry.day.slice(0, 3)} ${entry.closed ? "Closed" : `${entry.open}–${entry.close}`}`,
      )
      .join(" · ");
    await db.collection("stores").updateMany({}, { $set: { hours: hoursText } });
    await adminLog("store_settings_updated", {
      delivery_fee_cents: data.delivery_fee_cents,
      free_delivery_threshold_cents: data.free_delivery_threshold_cents,
      points_per_dollar: data.points_per_dollar,
      reward_tiers_count: data.reward_tiers.length,
      ticker_messages_count: data.ticker_messages.length,
    });
    return { ok: true as const };
  });

export const saveStoreLocation = createServerFn({ method: "POST" })
  .validator((value: unknown) => storeLocationSchema.parse(value))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { randomUUID } = await import("node:crypto");
    const { getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    const id = data.id ?? randomUUID();
    const store: StoreLocation = {
      ...data,
      id,
      features: [...new Set(data.features.map((feature) => feature.trim()).filter(Boolean))],
      sort_order: data.sort_order ?? 0,
    };
    await db
      .collection<StoreLocation>("stores")
      .updateOne({ id }, { $set: store }, { upsert: true });
    await adminLog(data.id ? "store_location_updated" : "store_location_created", {
      location_id: id,
    });
    return { ok: true as const, location: store };
  });

export const deleteStoreLocation = createServerFn({ method: "POST" })
  .validator((value: unknown) => z.object({ id: z.string().uuid() }).strict().parse(value))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    const result = await db.collection("stores").deleteOne({ id: data.id });
    if (!result.deletedCount) throw new Error("That location no longer exists.");
    await adminLog("store_location_deleted", { location_id: data.id });
    return { ok: true as const };
  });

export const saveAdminPromotion = createServerFn({ method: "POST" })
  .validator((value: unknown) => promotionSchema.parse(value))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { randomUUID } = await import("node:crypto");
    const { getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    const promotions = db.collection<PromotionDocument>("promotions");
    const existing = await promotions.findOne({ code: data.code });
    const isBuiltIn = PROMOS.some((promo) => promo.code === data.code);
    if (existing && !isBuiltIn && existing.id !== data.id) {
      throw new Error("A coupon with that code already exists.");
    }
    if (data.id && existing && existing.id !== data.id) {
      throw new Error("That coupon code belongs to a different promotion.");
    }
    const id = data.id ?? existing?.id ?? randomUUID();
    const now = new Date().toISOString();
    await promotions.updateOne(
      { id },
      {
        $set: { ...data, id, updated_at: now },
        $setOnInsert: { created_at: now, usage_count: existing?.usage_count ?? 0 },
      },
      { upsert: true },
    );
    await adminLog(data.id ? "promotion_updated" : "promotion_created", { promotion_id: id });
    return { ok: true as const };
  });

export const deleteAdminPromotion = createServerFn({ method: "POST" })
  .validator((value: unknown) => z.object({ id: z.string().uuid() }).strict().parse(value))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    const promotions = db.collection<PromotionDocument>("promotions");
    const promotion = await promotions.findOne({ id: data.id });
    if (!promotion) throw new Error("That promotion no longer exists.");
    if (PROMOS.some((promo) => promo.code === promotion.code)) {
      await promotions.updateOne(
        { id: data.id },
        { $set: { active: false, updated_at: new Date().toISOString() } },
      );
      await adminLog("promotion_deactivated", { promotion_id: data.id });
      return { ok: true as const };
    }
    const result = await promotions.deleteOne({ id: data.id });
    if (!result.deletedCount) throw new Error("That promotion no longer exists.");
    await adminLog("promotion_deleted", { promotion_id: data.id });
    return { ok: true as const };
  });

export const saveAdminCateringPackage = createServerFn({ method: "POST" })
  .validator((value: unknown) => cateringSchema.parse(value))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { randomUUID } = await import("node:crypto");
    const { getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    const id = data.id ?? randomUUID();
    await db
      .collection<CateringDocument>("catering_packages")
      .updateOne(
        { id },
        { $set: { ...data, id, updated_at: new Date().toISOString() } },
        { upsert: true },
      );
    await adminLog(data.id ? "catering_package_updated" : "catering_package_created", {
      package_id: id,
    });
    return { ok: true as const };
  });

export const deleteAdminCateringPackage = createServerFn({ method: "POST" })
  .validator((value: unknown) => z.object({ id: z.string().uuid() }).strict().parse(value))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    const result = await db.collection("catering_packages").deleteOne({ id: data.id });
    if (!result.deletedCount) throw new Error("That catering package no longer exists.");
    await adminLog("catering_package_deleted", { package_id: data.id });
    return { ok: true as const };
  });

export const saveAdminCateringProtein = createServerFn({ method: "POST" })
  .validator((value: unknown) => cateringProteinSchema.parse(value))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { randomUUID } = await import("node:crypto");
    const { getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    const id = data.id ?? randomUUID();
    await db
      .collection<CateringProteinDocument>("catering_proteins")
      .updateOne(
        { id },
        { $set: { ...data, id, updated_at: new Date().toISOString() } },
        { upsert: true },
      );
    await adminLog(data.id ? "catering_protein_updated" : "catering_protein_created", {
      protein_id: id,
    });
    return { ok: true as const };
  });

export const deleteAdminCateringProtein = createServerFn({ method: "POST" })
  .validator((value: unknown) => z.object({ id: z.string().uuid() }).strict().parse(value))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    const result = await db.collection("catering_proteins").deleteOne({ id: data.id });
    if (!result.deletedCount) throw new Error("That catering protein no longer exists.");
    await adminLog("catering_protein_deleted", { protein_id: data.id });
    return { ok: true as const };
  });

export const updateAdminCateringInquiry = createServerFn({ method: "POST" })
  .validator((value: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["new", "contacted", "closed"]),
      })
      .strict()
      .parse(value),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    const result = await db
      .collection<CateringInquiryDocument>("catering_inquiries")
      .updateOne(
        { id: data.id },
        { $set: { status: data.status, updated_at: new Date().toISOString() } },
      );
    if (!result.matchedCount) throw new Error("That catering inquiry no longer exists.");
    await adminLog("catering_inquiry_status_updated", {
      inquiry_id: data.id,
      status: data.status,
    });
    return { ok: true as const };
  });

export const saveAdminGalleryItem = createServerFn({ method: "POST" })
  .validator((value: unknown) => gallerySchema.parse(value))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { randomUUID } = await import("node:crypto");
    const { getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    const id = data.id ?? randomUUID();
    const now = new Date().toISOString();
    await db
      .collection<GalleryDocument>("gallery_items")
      .updateOne(
        { id },
        { $set: { ...data, id, updated_at: now }, $setOnInsert: { created_at: now } },
        { upsert: true },
      );
    await adminLog(data.id ? "gallery_item_updated" : "gallery_item_created", { gallery_id: id });
    return { ok: true as const };
  });

export const uploadAdminImage = createServerFn({ method: "POST" })
  .validator((value: unknown) =>
    z
      .object({ dataUrl: z.string().max(3_000_000) })
      .strict()
      .parse(value),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const match = data.dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
    if (!match) throw new Error("Choose a JPEG, PNG, or WebP image.");

    const { Buffer } = await import("node:buffer");
    const image = Buffer.from(match[2]!, "base64");
    if (image.byteLength === 0 || image.byteLength > 2_000_000) {
      throw new Error("Images must be smaller than 2 MB.");
    }

    const signature = image.subarray(0, 12);
    const contentType = signature.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))
      ? "image/jpeg"
      : signature
            .subarray(0, 8)
            .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
        ? "image/png"
        : signature.toString("ascii", 0, 4) === "RIFF" &&
            signature.toString("ascii", 8, 12) === "WEBP"
          ? "image/webp"
          : null;
    if (!contentType || contentType !== match[1]) {
      throw new Error("The selected file is not a valid JPEG, PNG, or WebP image.");
    }

    const [{ GridFSBucket, ObjectId }, { Readable }] = await Promise.all([
      import("mongodb"),
      import("node:stream"),
    ]);
    const { getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    const id = new ObjectId();
    const bucket = new GridFSBucket(db, { bucketName: "admin_media" });
    const upload = bucket.openUploadStreamWithId(id, id.toHexString(), {
      metadata: { kind: "admin-image", contentType },
    });
    await new Promise<void>((resolve, reject) => {
      Readable.from(image)
        .on("error", reject)
        .pipe(upload)
        .on("error", reject)
        .on("finish", resolve);
    });
    await adminLog("image_uploaded", { image_id: id.toHexString(), bytes: image.byteLength });
    return { url: `/api/media/${id.toHexString()}` };
  });

export const deleteAdminGalleryItem = createServerFn({ method: "POST" })
  .validator((value: unknown) => z.object({ id: z.string().uuid() }).strict().parse(value))
  .handler(async ({ data }) => {
    await requireAdmin();
    const { getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    await Promise.all([
      db.collection<GalleryLikeDocument>("gallery_likes").deleteMany({ gallery_item_id: data.id }),
      db
        .collection<GalleryCommentDocument>("gallery_comments")
        .deleteMany({ gallery_item_id: data.id }),
    ]);
    const result = await db.collection("gallery_items").deleteOne({ id: data.id });
    if (!result.deletedCount) throw new Error("That gallery item no longer exists.");
    await adminLog("gallery_item_deleted", { gallery_id: data.id });
    return { ok: true as const };
  });

export const setAdminOrderStatus = createServerFn({ method: "POST" })
  .validator((value: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["received", "kitchen", "handoff", "completed", "cancelled"]),
      })
      .strict()
      .parse(value),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const { collection, getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    const orders = collection<OrderDocument>(db, "orders");
    const order = await orders.findOne({ id: data.id });
    if (!order) throw new Error("That order no longer exists.");
    if (order.payment_provider && order.payment_status !== "paid" && data.status !== "cancelled") {
      throw new Error("Payment must be verified before this order can enter fulfillment.");
    }
    if (order.status === data.status) return { ok: true as const };
    if (!canTransitionOrder(order.status, data.status)) {
      throw new Error(`Cannot move an order from ${order.status} to ${data.status}.`);
    }
    const now = new Date().toISOString();
    const result = await orders.updateOne(
      { id: data.id, status: order.status },
      {
        $set: {
          status: data.status,
          updated_at: now,
          status_history: [
            ...(order.status_history ?? [{ status: order.status, updated_at: order.created_at }]),
            { status: data.status, updated_at: now },
          ],
        },
      },
    );
    if (!result.modifiedCount)
      throw new Error("The order changed in another session. Refresh and retry.");
    await adminLog("order_status", { order_id: data.id, status: data.status });
    return { ok: true as const };
  });

export const getAdminSales = createServerFn({ method: "GET" })
  .validator((value: unknown) =>
    z
      .object({ period: z.enum(["daily", "weekly", "monthly", "yearly"]) })
      .strict()
      .parse(value),
  )
  .handler(async ({ data }) => {
    await requireAdmin();
    const now = new Date();
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    if (data.period === "weekly") {
      const daysSinceMonday = (start.getUTCDay() + 6) % 7;
      start.setUTCDate(start.getUTCDate() - daysSinceMonday);
    } else if (data.period === "monthly") {
      start.setUTCDate(1);
    } else if (data.period === "yearly") {
      start.setUTCMonth(0, 1);
    }

    const { collection, getMongoDatabase } = await import("./mongodb.server");
    const { db } = await getMongoDatabase();
    const filter = { created_at: { $gte: start.toISOString(), $lte: now.toISOString() } };
    const [summary, orders] = await Promise.all([
      collection<OrderDocument>(db, "orders")
        .aggregate<{
          orderCount: number;
          completedCount: number;
          completedValue: number;
        }>([
          { $match: filter },
          {
            $group: {
              _id: null,
              orderCount: { $sum: 1 },
              completedCount: {
                $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] },
              },
              completedValue: {
                $sum: {
                  $cond: [{ $eq: ["$status", "completed"] }, "$total_cents", 0],
                },
              },
            },
          },
        ])
        .toArray(),
      collection<OrderDocument>(db, "orders")
        .find(filter)
        .project<
          Pick<
            OrderDocument,
            | "id"
            | "order_number"
            | "status"
            | "fulfillment"
            | "total_cents"
            | "created_at"
            | "customer_name"
            | "payment_status"
          >
        >({
          _id: 0,
          id: 1,
          order_number: 1,
          status: 1,
          fulfillment: 1,
          total_cents: 1,
          created_at: 1,
          customer_name: 1,
          payment_status: 1,
        })
        .sort({ created_at: -1 })
        .limit(5000)
        .toArray(),
    ]);
    const totals = summary[0] ?? { orderCount: 0, completedCount: 0, completedValue: 0 };
    return {
      period: data.period,
      start: start.toISOString(),
      end: now.toISOString(),
      orderCount: totals.orderCount,
      completedCount: totals.completedCount,
      completedOrderValueCents: totals.completedValue,
      averageCompletedOrderCents: totals.completedCount
        ? Math.round(totals.completedValue / totals.completedCount)
        : 0,
      truncated: totals.orderCount > orders.length,
      orders,
    };
  });

export type AdminWorkspace = Awaited<ReturnType<typeof getAdminWorkspace>>;
export type AdminWorkspaceData = Extract<AdminWorkspace, { authenticated: true }>;
