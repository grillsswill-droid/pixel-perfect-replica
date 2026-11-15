import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { z } from "zod";
import {
  Activity,
  BarChart3,
  Boxes,
  ClipboardList,
  ImagePlus,
  LockKeyhole,
  MapPin,
  RefreshCw,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Tags,
  Users,
  Utensils,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  deleteAdminCateringPackage,
  deleteAdminCateringProtein,
  deleteAdminGalleryItem,
  deleteAdminMenuItem,
  deleteAdminPromotion,
  deleteStoreLocation,
  getAdminSales,
  getAdminWorkspace,
  lockAdmin,
  saveAdminCategory,
  saveAdminCateringPackage,
  saveAdminCateringProtein,
  saveAdminGalleryItem,
  saveAdminMenuItem,
  saveAdminPromotion,
  saveAdminSettings,
  saveStoreLocation,
  setAdminOrderStatus,
  updateAdminCateringInquiry,
  unlockAdmin,
  uploadAdminImage,
  type AdminWorkspaceData,
} from "@/lib/admin.functions";
import { canTransitionOrder, nextStatus, statusLabel, type OrderStatus } from "@/lib/order-status";
import { formatMoney } from "@/lib/pricing";
import { foodImage } from "@/lib/food-images";
import type { BundleComponent, CategoryId, MenuItem, QuickOrderGroup } from "@/lib/menu-types";

type Workspace = Awaited<ReturnType<typeof getAdminWorkspace>>;
type Tab =
  | "overview"
  | "orders"
  | "menu"
  | "categories"
  | "customers"
  | "locations"
  | "promotions"
  | "catering"
  | "gallery"
  | "sales"
  | "settings"
  | "activity";

const TABS: { id: Tab; label: string; icon: typeof Activity }[] = [
  { id: "overview", label: "Overview", icon: BarChart3 },
  { id: "orders", label: "Orders", icon: ClipboardList },
  { id: "menu", label: "Menu & combos", icon: Utensils },
  { id: "categories", label: "Categories", icon: Boxes },
  { id: "customers", label: "Customers", icon: Users },
  { id: "locations", label: "Locations", icon: MapPin },
  { id: "promotions", label: "Promotions", icon: Tags },
  { id: "catering", label: "Catering", icon: ShoppingBag },
  { id: "gallery", label: "Gallery", icon: ImagePlus },
  { id: "sales", label: "Sales", icon: BarChart3 },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "activity", label: "Activity", icon: Activity },
];

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [{ title: "Admin | Grill & Swill" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: AdminPage,
});

function AdminPage() {
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [passcode, setPasscode] = useState("");
  const [tab, setTab] = useState<Tab>("overview");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setWorkspace(await getAdminWorkspace());
      setError("");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "The admin workspace could not be loaded.",
      );
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!workspace?.authenticated) return;
    const timer = window.setInterval(() => void refresh(), 15_000);
    return () => window.clearInterval(timer);
  }, [workspace?.authenticated, refresh]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const result = await unlockAdmin({ data: { passcode } });
      if (!result.ok) {
        setError("That administrator passcode didn’t match.");
        return;
      }
      setPasscode("");
      await refresh();
      toast.success("Admin workspace unlocked");
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "The admin workspace could not be unlocked.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function runAction(
    action: () => Promise<unknown>,
    successMessage: string,
  ): Promise<boolean> {
    setBusy(true);
    setError("");
    try {
      await action();
      await refresh();
      toast.success(successMessage);
      return true;
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : "The requested change could not be saved.";
      setError(message);
      toast.error(message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    const success = await runAction(() => lockAdmin(), "Admin workspace locked");
    if (success) setWorkspace({ authenticated: false });
  }

  if (!workspace?.authenticated) {
    return (
      <main className="grid min-h-[65vh] place-items-center bg-background px-5 py-12">
        <form
          onSubmit={login}
          className="w-full max-w-md rounded-3xl bg-card p-7 shadow-card sm:p-9"
        >
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-primary">
            <ShieldCheck />
          </span>
          <p className="mt-6 text-xs font-black uppercase tracking-[0.17em] text-primary">
            Administrator access
          </p>
          <h1 className="mt-2 font-display text-3xl font-black uppercase">Operations dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Use the private administrator passcode. Kitchen staff use a separate login.
          </p>
          <label htmlFor="admin-passcode" className="mt-6 block text-sm font-bold">
            Admin passcode
          </label>
          <input
            id="admin-passcode"
            type="password"
            autoComplete="current-password"
            value={passcode}
            onChange={(event) => setPasscode(event.target.value)}
            required
            className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-3 focus-visible:outline-2 focus-visible:outline-primary"
          />
          {error ? (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" variant="hero" size="lg" loading={busy} className="mt-5 w-full">
            Unlock admin workspace
          </Button>
          <Link
            to="/kitchen"
            className="mt-5 block text-center text-sm font-semibold text-muted-foreground hover:text-primary"
          >
            Open kitchen board
          </Link>
        </form>
      </main>
    );
  }

  const data = workspace;

  return (
    <main className="min-h-[65vh] bg-background px-4 py-6 sm:px-6 sm:py-9">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">
              Grill &amp; Swill operations
            </p>
            <h1 className="mt-1 font-display text-3xl font-black uppercase sm:text-4xl">
              Admin workspace
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Orders, menu, customers, promotions and store operations.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => void refresh()} disabled={busy}>
              <RefreshCw className="h-4 w-4" /> Refresh
            </Button>
            <Button variant="outline" onClick={() => void logout()} disabled={busy}>
              <LockKeyhole className="h-4 w-4" /> Lock
            </Button>
          </div>
        </header>

        {error ? (
          <p
            role="alert"
            className="mb-5 rounded-xl bg-destructive/10 p-3 text-sm text-destructive"
          >
            {error}
          </p>
        ) : null}

        <nav
          className="-mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6"
          aria-label="Admin sections"
        >
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              aria-current={tab === id ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                tab === id
                  ? "bg-charcoal text-cream shadow-card"
                  : "bg-card text-muted-foreground hover:text-charcoal"
              }`}
            >
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </nav>

        {tab === "overview" ? (
          <Overview data={data} setTab={setTab} runAction={runAction} busy={busy} />
        ) : null}
        {tab === "orders" ? <OrdersPanel data={data} runAction={runAction} busy={busy} /> : null}
        {tab === "menu" ? <MenuPanel data={data} runAction={runAction} busy={busy} /> : null}
        {tab === "categories" ? (
          <CategoriesPanel data={data} runAction={runAction} busy={busy} />
        ) : null}
        {tab === "customers" ? <CustomersPanel data={data} /> : null}
        {tab === "locations" ? (
          <LocationsPanel data={data} runAction={runAction} busy={busy} />
        ) : null}
        {tab === "promotions" ? (
          <PromotionsPanel data={data} runAction={runAction} busy={busy} />
        ) : null}
        {tab === "catering" ? (
          <CateringPanel data={data} runAction={runAction} busy={busy} />
        ) : null}
        {tab === "gallery" ? <GalleryPanel data={data} runAction={runAction} busy={busy} /> : null}
        {tab === "sales" ? <SalesPanel /> : null}
        {tab === "settings" ? (
          <SettingsPanel data={data} runAction={runAction} busy={busy} />
        ) : null}
        {tab === "activity" ? <ActivityPanel data={data} /> : null}
      </div>
    </main>
  );
}

function Overview({
  data,
  setTab,
  runAction,
  busy,
}: {
  data: AdminWorkspaceData;
  setTab: (tab: Tab) => void;
  runAction: (action: () => Promise<unknown>, message: string) => Promise<boolean>;
  busy: boolean;
}) {
  const orders = data.orders;
  const open = orders.filter((order) => !["completed", "cancelled"].includes(order.status));
  const completedValue = orders
    .filter((order) => order.status === "completed")
    .reduce((sum, order) => sum + order.total_cents, 0);
  const average = orders.length
    ? Math.round(orders.reduce((sum, order) => sum + order.total_cents, 0) / orders.length)
    : 0;
  const tiles = [
    { label: "Orders loaded", value: String(orders.length), help: "Most recent 250 orders" },
    { label: "Active queue", value: String(open.length), help: "Needs kitchen action" },
    {
      label: "Completed order value",
      value: formatMoney(completedValue),
      help: "Demo payments are not collected",
    },
    { label: "Average order", value: formatMoney(average), help: "Recent orders" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {tiles.map((tile) => (
          <article key={tile.label} className="rounded-3xl bg-card p-5 shadow-card">
            <p className="text-sm font-bold text-muted-foreground">{tile.label}</p>
            <p className="mt-3 font-display text-3xl font-black">{tile.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{tile.help}</p>
          </article>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.8fr]">
        <section className="rounded-3xl bg-card p-5 shadow-card sm:p-6">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-primary">
                Live queue
              </p>
              <h2 className="mt-1 font-display text-2xl font-black uppercase">Recent orders</h2>
            </div>
            <Button variant="outline" size="sm" onClick={() => setTab("orders")}>
              All orders
            </Button>
          </div>
          <OrderTable orders={orders.slice(0, 8)} runAction={runAction} busy={busy} compact />
        </section>
        <section className="rounded-3xl bg-charcoal p-6 text-cream">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-primary">
            <Activity className="h-4 w-4" /> Quick links
          </p>
          <div className="mt-5 grid gap-2">
            <QuickLink label="Manage menu and combos" onClick={() => setTab("menu")} />
            <QuickLink label="Review promotions" onClick={() => setTab("promotions")} />
            <QuickLink
              label="Update business hours & delivery"
              onClick={() => setTab("settings")}
            />
            <Link
              to="/kitchen"
              className="rounded-xl border border-cream/15 px-4 py-3 text-sm font-bold transition hover:bg-cream/10"
            >
              Open kitchen board
            </Link>
          </div>
          <p className="mt-5 rounded-xl bg-cream/10 p-3 text-xs leading-relaxed text-cream/70">
            Order totals are snapshots from demo checkout. No card payments are processed.
          </p>
        </section>
      </div>
    </div>
  );
}

function OrdersPanel({
  data,
  runAction,
  busy,
}: {
  data: AdminWorkspaceData;
  runAction: (action: () => Promise<unknown>, message: string) => Promise<boolean>;
  busy: boolean;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const orders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.orders.filter((order) => {
      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      const matchesTerm =
        !term ||
        `${order.order_number} ${order.customer_name} ${order.customer_phone ?? ""} ${order.receipt_number ?? ""} ${order.items.map((item) => item.name).join(" ")}`
          .toLowerCase()
          .includes(term);
      return matchesStatus && matchesTerm;
    });
  }, [data.orders, search, statusFilter]);

  return (
    <Panel
      title="Order management"
      description="Search, review and advance orders through the kitchen workflow."
    >
      <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_220px]">
        <TextInput
          label="Search orders"
          value={search}
          onChange={setSearch}
          placeholder="Order number, customer, phone or receipt"
        />
        <label className="block text-sm font-semibold">
          Status
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className={inputClass}
          >
            <option value="all">All statuses</option>
            {["received", "kitchen", "handoff", "completed", "cancelled"].map((status) => (
              <option key={status} value={status}>
                {statusLabel(status as OrderStatus, "pickup")}
              </option>
            ))}
          </select>
        </label>
      </div>
      <OrderTable orders={orders} runAction={runAction} busy={busy} />
      {data.orders.length >= 250 ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Showing the latest 250 orders. Use Sales for complete period totals and exports.
        </p>
      ) : null}
    </Panel>
  );
}

function OrderTable({
  orders,
  runAction,
  busy,
  compact = false,
}: {
  orders: AdminWorkspaceData["orders"];
  runAction: (action: () => Promise<unknown>, message: string) => Promise<boolean>;
  busy: boolean;
  compact?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[900px] text-left text-sm">
        <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-3 py-3">Order / receipt</th>
            <th className="px-3 py-3">Customer</th>
            <th className="px-3 py-3">Status</th>
            <th className="px-3 py-3">Fulfillment</th>
            <th className="px-3 py-3">Order items</th>
            <th className="px-3 py-3 text-right">Total</th>
            <th className="px-3 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const next = nextStatus(order.status);
            return (
              <tr key={order.id} className="border-b border-border last:border-0">
                <td className="px-3 py-3">
                  <p className="font-bold">#{order.order_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {order.receipt_number ?? "Receipt pending"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(order.created_at).toLocaleString()}
                  </p>
                </td>
                <td className="px-3 py-3">
                  <p className="font-semibold">{order.customer_name}</p>
                  {order.customer_phone ? (
                    <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
                  ) : null}
                </td>
                <td className="px-3 py-3">
                  <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-bold text-primary">
                    {statusLabel(order.status, order.fulfillment)}
                  </span>
                </td>
                <td className="px-3 py-3 capitalize">{order.fulfillment}</td>
                <td className="px-3 py-3">
                  <details className="max-w-sm">
                    <summary className="flex min-h-11 cursor-pointer items-center font-semibold text-primary">
                      {order.items.length} {order.items.length === 1 ? "item" : "items"}
                    </summary>
                    <ul className="space-y-2 py-2 text-xs">
                      {order.items.map((item, index) => (
                        <li key={`${item.itemId}-${index}`}>
                          <span className="font-bold">{item.quantity} ×</span> {item.name}
                          {item.bundleComponents?.length ? (
                            <span className="block text-muted-foreground">
                              Includes:{" "}
                              {item.bundleComponents
                                .map((component) => `${component.quantity} × ${component.label}`)
                                .join(" · ")}
                            </span>
                          ) : null}
                          {item.summary.length ? (
                            <span className="block text-muted-foreground">
                              {item.summary.join(" · ")}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </details>
                </td>
                <td className="px-3 py-3 text-right font-bold">{formatMoney(order.total_cents)}</td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    {next ? (
                      <Button
                        size="sm"
                        variant="hero"
                        disabled={busy}
                        onClick={() =>
                          void runAction(
                            () => setAdminOrderStatus({ data: { id: order.id, status: next } }),
                            "Order status updated",
                          )
                        }
                      >
                        {compact ? "Advance" : `Move to ${statusLabel(next, order.fulfillment)}`}
                      </Button>
                    ) : null}
                    {canTransitionOrder(order.status, "cancelled") &&
                    order.status !== "cancelled" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={() => {
                          if (!window.confirm(`Cancel order #${order.order_number}?`)) return;
                          void runAction(
                            () =>
                              setAdminOrderStatus({ data: { id: order.id, status: "cancelled" } }),
                            "Order cancelled",
                          );
                        }}
                      >
                        Cancel
                      </Button>
                    ) : null}
                    <Button asChild size="sm" variant="outline">
                      <Link
                        to="/receipts/$id"
                        params={{ id: order.id }}
                        search={{ token: order.access_token }}
                        aria-label={`View receipt for order ${order.order_number}`}
                      >
                        Receipt
                      </Link>
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {orders.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No orders match.</p>
      ) : null}
    </div>
  );
}

type MenuDraft = {
  id?: string;
  name: string;
  category: CategoryId;
  description: string;
  price: string;
  calories: string;
  image_key: string;
  tags: string;
  ingredients: string;
  options: string;
  is_available: boolean;
  is_featured: boolean;
  sort_order: string;
  is_quick_order: boolean;
  quick_order_group: QuickOrderGroup;
  quick_order_order: string;
  bundle_components: BundleComponent[];
};

const optionsSchema = z
  .array(
    z.object({
      id: z.string().min(1).max(60),
      label: z.string().min(1).max(100),
      type: z.enum(["single", "multi"]),
      required: z.boolean().optional(),
      source_item_group_id: z.string().min(1).max(60).optional(),
      source_option_group_id: z.string().min(1).max(60).optional(),
      choices: z
        .array(
          z.object({
            id: z.string().min(1).max(60),
            label: z.string().min(1).max(120),
            price_cents: z.number().int().min(-100_000).max(100_000),
            menu_item_id: z.string().uuid().optional(),
            bundle_quantity: z.number().int().min(1).max(20).optional(),
          }),
        )
        .min(1)
        .max(50),
    }),
  )
  .max(30)
  .superRefine((groups, context) => {
    const ids = new Set<string>();
    for (const [index, group] of groups.entries()) {
      if (ids.has(group.id)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [index, "id"],
          message: "Option group IDs must be unique.",
        });
      }
      ids.add(group.id);
      const choiceIds = new Set<string>();
      for (const [choiceIndex, choice] of group.choices.entries()) {
        if (choiceIds.has(choice.id)) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [index, "choices", choiceIndex, "id"],
            message: "Choice IDs must be unique in a group.",
          });
        }
        choiceIds.add(choice.id);
      }
    }
  });

const emptyMenuDraft: MenuDraft = {
  name: "",
  category: "burgers",
  description: "",
  price: "",
  calories: "0",
  image_key: "",
  tags: "",
  ingredients: "",
  options: "[]",
  is_available: true,
  is_featured: false,
  sort_order: "0",
  is_quick_order: false,
  quick_order_group: "burgers",
  quick_order_order: "0",
  bundle_components: [],
};

function MenuPanel({
  data,
  runAction,
  busy,
}: {
  data: AdminWorkspaceData;
  runAction: (action: () => Promise<unknown>, message: string) => Promise<boolean>;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<MenuDraft>(emptyMenuDraft);
  const [filter, setFilter] = useState("all");
  const items = data.menu.filter((item) => filter === "all" || item.category === filter);

  function edit(item: MenuItem) {
    setDraft({
      id: item.id,
      name: item.name,
      category: item.category,
      description: item.description,
      price: (item.price_cents / 100).toFixed(2),
      calories: String(item.calories),
      image_key: item.image_key,
      tags: item.tags.join(", "),
      ingredients: item.ingredients.join(", "),
      options: JSON.stringify(item.options, null, 2),
      is_available: item.is_available,
      is_featured: item.is_featured,
      sort_order: String(item.sort_order),
      is_quick_order: Boolean(item.is_quick_order),
      quick_order_group: item.quick_order_group ?? "burgers",
      quick_order_order: String(item.quick_order_order ?? item.sort_order),
      bundle_components: (item.bundle_components ?? []).map((component) => ({ ...component })),
    });
  }

  function addComboGroup() {
    try {
      const options = optionsSchema.parse(JSON.parse(draft.options));
      if (options.some((option) => option.id === "combo")) {
        toast.error("This item already has a combo option group.");
        return;
      }
      setDraft((current) => ({
        ...current,
        options: JSON.stringify(
          [
            ...options,
            {
              id: "combo",
              label: "Make it a combo",
              type: "single",
              required: true,
              choices: [
                { id: "none", label: "Just the item", price_cents: 0 },
                { id: "classic", label: "+ Fries & drink", price_cents: 399 },
              ],
            },
          ],
          null,
          2,
        ),
      }));
    } catch {
      toast.error("Fix the option JSON before adding a combo group.");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    let options: MenuItem["options"];
    try {
      options = optionsSchema.parse(JSON.parse(draft.options));
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Enter valid options JSON.");
      return;
    }
    const price = Number(draft.price);
    const success = await runAction(
      () =>
        saveAdminMenuItem({
          data: {
            ...(draft.id ? { id: draft.id } : {}),
            name: draft.name,
            category: draft.category,
            description: draft.description,
            price_cents: Math.round(price * 100),
            calories: Number(draft.calories),
            image_key: draft.image_key,
            tags: splitList(draft.tags),
            ingredients: splitList(draft.ingredients),
            options,
            is_available: draft.is_available,
            is_featured: draft.is_featured,
            sort_order: Number(draft.sort_order),
            currency: "USD",
            is_quick_order: draft.is_quick_order,
            ...(draft.is_quick_order ? { quick_order_group: draft.quick_order_group } : {}),
            quick_order_order: Number(draft.quick_order_order),
            bundle_components: draft.bundle_components,
          },
        }),
      draft.id ? "Menu item updated" : "Menu item created",
    );
    if (success) setDraft(emptyMenuDraft);
  }

  async function uploadImage(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 2_000_000) {
      toast.error("Images must be smaller than 2 MB.");
      return;
    }
    await runAction(async () => {
      const dataUrl = await readFileAsDataUrl(file);
      const result = await uploadAdminImage({ data: { dataUrl } });
      setDraft((current) => ({ ...current, image_key: result.url }));
    }, "Image uploaded");
  }

  return (
    <Panel
      title="Menu and combo management"
      description="Edit customer-facing items, prices, availability, imagery and option groups. Combo offers use the same validated menu options and checkout pricing."
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <form
          onSubmit={(event) => void submit(event)}
          className="space-y-4 rounded-2xl bg-background p-4 sm:p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-xl font-black uppercase">
              {draft.id ? "Edit item" : "New item"}
            </h3>
            {draft.id ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setDraft(emptyMenuDraft)}
              >
                New
              </Button>
            ) : null}
          </div>
          <TextInput
            label="Name"
            value={draft.name}
            onChange={(value) => setDraft({ ...draft, name: value })}
            required
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <SelectInput
              label="Category"
              value={draft.category}
              onChange={(value) => {
                const category = data.categories.find((entry) => entry.id === value);
                if (category) setDraft({ ...draft, category: category.id });
              }}
              options={data.categories.map(
                (category) => [category.id, category.label] as [string, string],
              )}
            />
            <TextInput
              label="Price ($ USD)"
              type="number"
              step="0.01"
              min="0"
              value={draft.price}
              onChange={(value) => setDraft({ ...draft, price: value })}
              required
            />
            <TextInput
              label="Calories"
              type="number"
              min="0"
              value={draft.calories}
              onChange={(value) => setDraft({ ...draft, calories: value })}
            />
          </div>
          <TextArea
            label="Description"
            value={draft.description}
            onChange={(value) => setDraft({ ...draft, description: value })}
          />
          <TextInput
            label="Image key or HTTPS image URL"
            value={draft.image_key}
            onChange={(value) => setDraft({ ...draft, image_key: value })}
            placeholder="burger or https://…"
          />
          <label className="block text-sm font-semibold">
            Upload image (JPEG, PNG or WebP; max 2 MB)
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              disabled={busy}
              onChange={(event) => {
                void uploadImage(event.currentTarget.files?.[0]);
                event.currentTarget.value = "";
              }}
              className="mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-2 file:font-bold"
            />
          </label>
          <TextInput
            label="Tags (comma separated)"
            value={draft.tags}
            onChange={(value) => setDraft({ ...draft, tags: value })}
          />
          <TextInput
            label="Ingredients (comma separated)"
            value={draft.ingredients}
            onChange={(value) => setDraft({ ...draft, ingredients: value })}
          />
          <TextArea
            label="Option groups JSON"
            value={draft.options}
            onChange={(value) => setDraft({ ...draft, options: value })}
            rows={8}
            help="Add-ons and combo pricing are validated against this list at checkout."
          />
          <Button type="button" variant="outline" size="sm" onClick={addComboGroup}>
            Add combo option group
          </Button>
          <fieldset className="space-y-3 rounded-2xl border border-border p-4">
            <legend className="px-1 text-sm font-bold">Included bundle components</legend>
            <p className="text-xs text-muted-foreground">
              These items are saved with the order and shown to the kitchen. Link a component to a
              menu item when its availability should control this combo.
            </p>
            {draft.bundle_components.map((component, index) => (
              <div
                key={`${draft.id ?? "new"}-component-${index}`}
                className="grid gap-3 rounded-xl bg-card p-3 sm:grid-cols-[minmax(0,1fr)_100px_minmax(0,1fr)_auto]"
              >
                <TextInput
                  label="Component"
                  value={component.label}
                  onChange={(label) =>
                    setDraft((current) => ({
                      ...current,
                      bundle_components: current.bundle_components.map((entry, entryIndex) =>
                        entryIndex === index ? { ...entry, label } : entry,
                      ),
                    }))
                  }
                />
                <TextInput
                  label="Quantity"
                  type="number"
                  min="1"
                  max="20"
                  value={String(component.quantity)}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      bundle_components: current.bundle_components.map((entry, entryIndex) =>
                        entryIndex === index
                          ? { ...entry, quantity: Math.max(1, Number(value) || 1) }
                          : entry,
                      ),
                    }))
                  }
                />
                <SelectInput
                  label="Linked menu item"
                  value={component.menu_item_id ?? ""}
                  onChange={(menu_item_id) =>
                    setDraft((current) => ({
                      ...current,
                      bundle_components: current.bundle_components.map((entry, entryIndex) =>
                        entryIndex === index
                          ? { ...entry, menu_item_id: menu_item_id || undefined }
                          : entry,
                      ),
                    }))
                  }
                  options={[
                    ["", "No linked item"],
                    ...data.menu
                      .filter((item) => item.id !== draft.id)
                      .map((item) => [item.id, item.name] as [string, string]),
                  ]}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="self-end"
                  aria-label={`Remove component ${component.label || index + 1}`}
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      bundle_components: current.bundle_components.filter(
                        (_, entryIndex) => entryIndex !== index,
                      ),
                    }))
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  bundle_components: [...current.bundle_components, { label: "", quantity: 1 }],
                }))
              }
            >
              Add component
            </Button>
          </fieldset>
          <TextInput
            label="Sort order"
            type="number"
            min="0"
            value={draft.sort_order}
            onChange={(value) => setDraft({ ...draft, sort_order: value })}
          />
          <div className="flex flex-wrap gap-5">
            <CheckInput
              label="Available"
              checked={draft.is_available}
              onChange={(checked) => setDraft({ ...draft, is_available: checked })}
            />
            <CheckInput
              label={draft.is_quick_order ? "Popular Combos" : "Featured"}
              checked={draft.is_featured}
              onChange={(checked) => setDraft({ ...draft, is_featured: checked })}
            />
            <CheckInput
              label="Show in Quick Order"
              checked={draft.is_quick_order}
              onChange={(checked) => setDraft({ ...draft, is_quick_order: checked })}
            />
          </div>
          {draft.is_quick_order ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <SelectInput
                label="Quick Order category"
                value={draft.quick_order_group}
                onChange={(value) =>
                  setDraft({ ...draft, quick_order_group: value as QuickOrderGroup })
                }
                options={[
                  ["burgers", "Burgers & Grill"],
                  ["pizza", "Pizza Deals"],
                  ["kids", "Kids' Meals"],
                  ["desserts", "Ice Cream & Desserts"],
                ]}
              />
              <TextInput
                label="Quick Order display order"
                type="number"
                min="0"
                value={draft.quick_order_order}
                onChange={(value) => setDraft({ ...draft, quick_order_order: value })}
              />
            </div>
          ) : null}
          {draft.is_quick_order ? (
            <p className="-mt-2 text-xs text-muted-foreground">
              Lower display-order numbers appear first in their category and in Popular Combos.
            </p>
          ) : null}
          <Button type="submit" variant="hero" loading={busy}>
            {draft.id ? "Save item" : "Create item"}
          </Button>
        </form>

        <section>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-xl font-black uppercase">Catalog ({items.length})</h3>
            <select
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              className="h-10 rounded-xl border border-input bg-card px-3 text-sm"
            >
              <option value="all">All categories</option>
              {data.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>
          <div className="max-h-[70vh] divide-y divide-border overflow-y-auto rounded-2xl bg-card px-4 shadow-card">
            {items.map((item) => {
              const isCombo =
                item.is_quick_order ||
                Boolean(item.bundle_components?.length) ||
                item.options.some((option) => option.id === "combo");
              return (
                <article
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  <div className="min-w-0">
                    <p className="font-semibold">{item.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatMoney(item.price_cents)} · {item.category}
                      {isCombo ? " · combo offer" : ""}
                      {!item.is_available ? " · sold out" : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => edit(item)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() =>
                        void runAction(
                          () =>
                            saveAdminMenuItem({
                              data: {
                                id: item.id,
                                name: item.name,
                                category: item.category,
                                description: item.description,
                                price_cents: item.price_cents,
                                calories: item.calories,
                                image_key: item.image_key,
                                tags: item.tags,
                                ingredients: item.ingredients,
                                options: item.options,
                                is_available: !item.is_available,
                                is_featured: item.is_featured,
                                sort_order: item.sort_order,
                                currency: item.currency ?? "USD",
                                is_quick_order: item.is_quick_order ?? false,
                                ...(item.quick_order_group
                                  ? { quick_order_group: item.quick_order_group }
                                  : {}),
                                ...(item.quick_order_order !== undefined
                                  ? { quick_order_order: item.quick_order_order }
                                  : {}),
                                bundle_components: item.bundle_components ?? [],
                              },
                            }),
                          item.is_available ? "Item marked sold out" : "Item is available",
                        )
                      }
                    >
                      {item.is_available ? "86 item" : "Restore"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy}
                      onClick={() => {
                        if (!window.confirm(`Delete ${item.name} from the menu?`)) return;
                        void runAction(
                          () => deleteAdminMenuItem({ data: { id: item.id } }),
                          "Menu item deleted",
                        );
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </Panel>
  );
}

function CategoriesPanel({
  data,
  runAction,
  busy,
}: {
  data: AdminWorkspaceData;
  runAction: (action: () => Promise<unknown>, message: string) => Promise<boolean>;
  busy: boolean;
}) {
  const [selectedId, setSelectedId] = useState<CategoryId>(data.categories[0]?.id ?? "burgers");
  const category = data.categories.find((entry) => entry.id === selectedId);
  const [draft, setDraft] = useState({ label: "", short: "", blurb: "", sort_order: "0" });

  useEffect(() => {
    if (category) {
      setDraft({
        label: category.label,
        short: category.short,
        blurb: category.blurb,
        sort_order: String(category.sort_order),
      });
    }
  }, [selectedId, category]);

  return (
    <Panel
      title="Menu categories"
      description="The storefront uses a fixed category set. Update customer-facing names and descriptions here; adding a new category requires a catalog schema change."
    >
      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        <div className="flex flex-col gap-2">
          {data.categories.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setSelectedId(entry.id)}
              className={`rounded-xl px-4 py-3 text-left text-sm font-bold ${selectedId === entry.id ? "bg-charcoal text-cream" : "bg-background hover:bg-accent"}`}
            >
              {entry.label}
            </button>
          ))}
        </div>
        {category ? (
          <form
            className="max-w-2xl space-y-4 rounded-2xl bg-background p-5"
            onSubmit={(event) => {
              event.preventDefault();
              void runAction(
                () =>
                  saveAdminCategory({
                    data: { id: category.id, ...draft, sort_order: Number(draft.sort_order) },
                  }),
                "Category updated",
              );
            }}
          >
            <TextInput
              label="Category label"
              value={draft.label}
              onChange={(value) => setDraft({ ...draft, label: value })}
              required
            />
            <TextInput
              label="Short label"
              value={draft.short}
              onChange={(value) => setDraft({ ...draft, short: value })}
              required
            />
            <TextArea
              label="Description"
              value={draft.blurb}
              onChange={(value) => setDraft({ ...draft, blurb: value })}
            />
            <TextInput
              label="Sort order"
              type="number"
              min="0"
              value={draft.sort_order}
              onChange={(value) => setDraft({ ...draft, sort_order: value })}
            />
            <Button type="submit" variant="hero" loading={busy}>
              Save category
            </Button>
          </form>
        ) : (
          <p>No category records found.</p>
        )}
      </div>
    </Panel>
  );
}

function CustomersPanel({ data }: { data: AdminWorkspaceData }) {
  return (
    <Panel
      title="Customer directory"
      description="Guest profiles are device-based in this storefront; contact details are available only when customers provided them at checkout."
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-3">Customer</th>
              <th className="px-3 py-3">Phone</th>
              <th className="px-3 py-3">Orders</th>
              <th className="px-3 py-3">Order value</th>
              <th className="px-3 py-3">Last order</th>
            </tr>
          </thead>
          <tbody>
            {data.customers.map((customer) => (
              <tr key={customer.guest_id} className="border-b border-border last:border-0">
                <td className="px-3 py-3">
                  <p className="font-semibold">{customer.customer_name || "Guest"}</p>
                  <p className="text-xs text-muted-foreground">{customer.guest_id.slice(0, 8)}…</p>
                </td>
                <td className="px-3 py-3">{customer.customer_phone || "Not provided"}</td>
                <td className="px-3 py-3">{customer.order_count}</td>
                <td className="px-3 py-3 font-semibold">
                  {formatMoney(customer.order_value_cents)}
                </td>
                <td className="px-3 py-3 text-muted-foreground">
                  {new Date(customer.last_order_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data.customers.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No customer orders yet.</p>
        ) : null}
      </div>
    </Panel>
  );
}

type StoreDraft = {
  id?: string;
  name: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  lat: string;
  lng: string;
  hours: string;
  features: string;
  sort_order: string;
};
const emptyStoreDraft: StoreDraft = {
  name: "",
  address: "",
  city: "",
  state: "",
  zip: "",
  phone: "",
  lat: "30.2672",
  lng: "-97.7431",
  hours: "Daily 7am – 11pm",
  features: "Drive-thru, Delivery",
  sort_order: "0",
};

function LocationsPanel({
  data,
  runAction,
  busy,
}: {
  data: AdminWorkspaceData;
  runAction: (action: () => Promise<unknown>, message: string) => Promise<boolean>;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<StoreDraft>(emptyStoreDraft);

  function edit(location: AdminWorkspaceData["stores"][number]) {
    setDraft({
      id: location.id,
      name: location.name,
      address: location.address,
      city: location.city,
      state: location.state,
      zip: location.zip,
      phone: location.phone,
      lat: String(location.lat),
      lng: String(location.lng),
      hours: location.hours,
      features: location.features.join(", "),
      sort_order: String(location.sort_order ?? 0),
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const lat = Number(draft.lat);
    const lng = Number(draft.lng);
    const sortOrder = Number(draft.sort_order);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast.error("Latitude and longitude must be valid numbers.");
      return;
    }
    const success = await runAction(
      () =>
        saveStoreLocation({
          data: {
            ...(draft.id ? { id: draft.id } : {}),
            name: draft.name,
            address: draft.address,
            city: draft.city,
            state: draft.state,
            zip: draft.zip,
            phone: draft.phone,
            lat,
            lng,
            hours: draft.hours,
            features: draft.features
              .split(",")
              .map((feature) => feature.trim())
              .filter(Boolean),
            ...(Number.isFinite(sortOrder) ? { sort_order: sortOrder } : {}),
          },
        }),
      draft.id ? "Location updated" : "Location created",
    );
    if (success) setDraft(emptyStoreDraft);
  }

  return (
    <Panel
      title="Locations"
      description="Manage where customers can order pickup and delivery, plus the contact details and map metadata shown on the storefront."
    >
      <div className="grid gap-6 xl:grid-cols-[1fr_1.05fr]">
        <form
          onSubmit={(event) => void submit(event)}
          className="space-y-4 rounded-2xl bg-background p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-xl font-black uppercase">
              {draft.id ? "Edit location" : "New location"}
            </h3>
            {draft.id ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setDraft(emptyStoreDraft)}
              >
                New
              </Button>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput
              label="Location name"
              value={draft.name}
              onChange={(value) => setDraft({ ...draft, name: value })}
              required
            />
            <TextInput
              label="Sort order"
              type="number"
              min="0"
              value={draft.sort_order}
              onChange={(value) => setDraft({ ...draft, sort_order: value })}
            />
          </div>
          <TextInput
            label="Street address"
            value={draft.address}
            onChange={(value) => setDraft({ ...draft, address: value })}
            required
          />
          <div className="grid gap-3 sm:grid-cols-[1fr_120px_120px]">
            <TextInput
              label="City"
              value={draft.city}
              onChange={(value) => setDraft({ ...draft, city: value })}
              required
            />
            <TextInput
              label="State"
              value={draft.state}
              onChange={(value) => setDraft({ ...draft, state: value })}
              required
            />
            <TextInput
              label="ZIP"
              value={draft.zip}
              onChange={(value) => setDraft({ ...draft, zip: value })}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput
              label="Phone"
              value={draft.phone}
              onChange={(value) => setDraft({ ...draft, phone: value })}
              required
            />
            <TextInput
              label="Hours"
              value={draft.hours}
              onChange={(value) => setDraft({ ...draft, hours: value })}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput
              label="Latitude"
              type="number"
              step="0.0001"
              value={draft.lat}
              onChange={(value) => setDraft({ ...draft, lat: value })}
              required
            />
            <TextInput
              label="Longitude"
              type="number"
              step="0.0001"
              value={draft.lng}
              onChange={(value) => setDraft({ ...draft, lng: value })}
              required
            />
          </div>
          <TextInput
            label="Features (comma separated)"
            value={draft.features}
            onChange={(value) => setDraft({ ...draft, features: value })}
          />
          <Button type="submit" variant="hero" loading={busy}>
            {draft.id ? "Save location" : "Create location"}
          </Button>
        </form>
        <div className="space-y-3">
          {data.stores.map((location) => (
            <article
              key={location.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card p-4 shadow-card"
            >
              <div>
                <p className="font-display text-lg font-black uppercase">{location.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {location.address}, {location.city}, {location.state} {location.zip}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{location.hours}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => edit(location)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm(`Delete ${location.name}?`)) return;
                    void runAction(
                      () => deleteStoreLocation({ data: { id: location.id } }),
                      "Location deleted",
                    );
                  }}
                >
                  Delete
                </Button>
              </div>
            </article>
          ))}
          {!data.stores.length ? <EmptyState>No locations configured yet.</EmptyState> : null}
        </div>
      </div>
    </Panel>
  );
}

type PromotionDraft = {
  id?: string;
  isBuiltin: boolean;
  code: string;
  label: string;
  description: string;
  kind: "amount" | "percent";
  value: string;
  minSubtotal: string;
  category: string;
  usage_limit: string;
  active: boolean;
};
const emptyPromotion: PromotionDraft = {
  isBuiltin: false,
  code: "",
  label: "",
  description: "",
  kind: "percent",
  value: "10",
  minSubtotal: "",
  category: "",
  usage_limit: "",
  active: true,
};

function PromotionsPanel({
  data,
  runAction,
  busy,
}: {
  data: AdminWorkspaceData;
  runAction: (action: () => Promise<unknown>, message: string) => Promise<boolean>;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<PromotionDraft>(emptyPromotion);
  function edit(promo: AdminWorkspaceData["promotions"][number]) {
    setDraft({
      ...(promo.id.startsWith("builtin:") ? {} : { id: promo.id }),
      isBuiltin: promo.is_builtin,
      code: promo.code,
      label: promo.label,
      description: promo.description,
      kind: promo.kind,
      value: String(promo.kind === "amount" ? promo.value / 100 : promo.value),
      minSubtotal: promo.minSubtotalCents ? String(promo.minSubtotalCents / 100) : "",
      category: promo.category ?? "",
      usage_limit: promo.usage_limit ? String(promo.usage_limit) : "",
      active: promo.active,
    });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = Number(draft.value);
    const category = data.categories.find((entry) => entry.id === draft.category)?.id;
    if (draft.category && !category) {
      toast.error("Choose a valid menu category.");
      return;
    }
    const success = await runAction(
      () =>
        saveAdminPromotion({
          data: {
            ...(draft.id ? { id: draft.id } : {}),
            code: draft.code,
            label: draft.label,
            description: draft.description,
            kind: draft.kind,
            value: draft.kind === "amount" ? Math.round(value * 100) : value,
            ...(draft.minSubtotal
              ? { minSubtotalCents: Math.round(Number(draft.minSubtotal) * 100) }
              : {}),
            ...(category ? { category } : {}),
            ...(draft.usage_limit ? { usage_limit: Number(draft.usage_limit) } : {}),
            active: draft.active,
          },
        }),
      draft.id || draft.isBuiltin ? "Promotion updated" : "Promotion created",
    );
    if (success) setDraft(emptyPromotion);
  }

  return (
    <Panel
      title="Promotions and coupons"
      description="Active codes are available to customers at checkout. Usage caps are enforced atomically when orders are placed."
    >
      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
        <form
          onSubmit={(event) => void submit(event)}
          className="space-y-4 rounded-2xl bg-background p-5"
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-xl font-black uppercase">
              {draft.id || draft.isBuiltin ? "Edit coupon" : "New coupon"}
            </h3>
            {draft.id || draft.isBuiltin ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setDraft(emptyPromotion)}
              >
                New
              </Button>
            ) : null}
          </div>
          <TextInput
            label="Code"
            value={draft.code}
            onChange={(value) => setDraft({ ...draft, code: value.toUpperCase() })}
            required
            disabled={draft.isBuiltin}
          />
          <TextInput
            label="Offer title"
            value={draft.label}
            onChange={(value) => setDraft({ ...draft, label: value })}
            required
          />
          <TextArea
            label="Customer description"
            value={draft.description}
            onChange={(value) => setDraft({ ...draft, description: value })}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectInput
              label="Discount"
              value={draft.kind}
              onChange={(value) => setDraft({ ...draft, kind: value as "amount" | "percent" })}
              options={[
                ["percent", "Percent"],
                ["amount", "Fixed amount"],
              ]}
            />
            <TextInput
              label={draft.kind === "amount" ? "Amount ($)" : "Percent off"}
              type="number"
              min="0"
              step={draft.kind === "amount" ? "0.01" : "1"}
              value={draft.value}
              onChange={(value) => setDraft({ ...draft, value })}
              required
            />
          </div>
          <TextInput
            label="Minimum subtotal ($), optional"
            type="number"
            min="0"
            step="0.01"
            value={draft.minSubtotal}
            onChange={(value) => setDraft({ ...draft, minSubtotal: value })}
          />
          <SelectInput
            label="Limit to category (optional)"
            value={draft.category}
            onChange={(value) => setDraft({ ...draft, category: value })}
            options={[
              ["", "All categories"],
              ...data.categories.map(
                (category) => [category.id, category.label] as [string, string],
              ),
            ]}
          />
          <TextInput
            label="Maximum uses (blank = unlimited)"
            type="number"
            min="1"
            value={draft.usage_limit}
            onChange={(value) => setDraft({ ...draft, usage_limit: value })}
          />
          <CheckInput
            label="Active at checkout"
            checked={draft.active}
            onChange={(checked) => setDraft({ ...draft, active: checked })}
          />
          <Button type="submit" variant="hero" loading={busy}>
            {draft.id || draft.isBuiltin ? "Save coupon" : "Create coupon"}
          </Button>
        </form>
        <div className="space-y-3">
          {data.promotions.map((promo) => (
            <article
              key={promo.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card p-4 shadow-card"
            >
              <div>
                <p className="font-display text-lg font-black uppercase">
                  {promo.code} · {promo.label}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{promo.description}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {promo.kind === "amount" ? formatMoney(promo.value) : `${promo.value}% off`}
                  {promo.usage_limit
                    ? ` · ${promo.usage_count ?? 0}/${promo.usage_limit} uses`
                    : " · unlimited uses"}
                  {!promo.active ? " · inactive" : ""}
                  {promo.is_builtin ? " · built-in" : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => edit(promo)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || (promo.is_builtin && !promo.active)}
                  onClick={() => {
                    if (promo.is_builtin) {
                      if (!promo.active || !window.confirm(`Remove ${promo.code} from checkout?`))
                        return;
                      void runAction(
                        () =>
                          saveAdminPromotion({
                            data: {
                              ...(promo.id.startsWith("builtin:") ? {} : { id: promo.id }),
                              code: promo.code,
                              label: promo.label,
                              description: promo.description,
                              kind: promo.kind,
                              value: promo.value,
                              ...(promo.minSubtotalCents
                                ? { minSubtotalCents: promo.minSubtotalCents }
                                : {}),
                              ...(promo.category ? { category: promo.category } : {}),
                              ...(promo.usage_limit ? { usage_limit: promo.usage_limit } : {}),
                              active: false,
                            },
                          }),
                        "Coupon removed from checkout",
                      );
                    } else {
                      if (!window.confirm(`Delete ${promo.code}?`)) return;
                      void runAction(
                        () => deleteAdminPromotion({ data: { id: promo.id } }),
                        "Promotion deleted",
                      );
                    }
                  }}
                >
                  {promo.is_builtin ? (promo.active ? "Remove" : "Removed") : "Delete"}
                </Button>
              </div>
            </article>
          ))}
          {!data.promotions.length ? <EmptyState>No promotions configured yet.</EmptyState> : null}
        </div>
      </div>
    </Panel>
  );
}

type CateringDraft = {
  id?: string;
  name: string;
  description: string;
  portion_size: string;
  serves: string;
  price: string;
  minimum_order: string;
  image_key: string;
  active: boolean;
  featured: boolean;
};
const emptyCatering: CateringDraft = {
  name: "",
  description: "",
  portion_size: "",
  serves: "",
  price: "",
  minimum_order: "1",
  image_key: "",
  active: true,
  featured: false,
};

function CateringPanel({
  data,
  runAction,
  busy,
}: {
  data: AdminWorkspaceData;
  runAction: (action: () => Promise<unknown>, message: string) => Promise<boolean>;
  busy: boolean;
}) {
  const [draft, setDraft] = useState<CateringDraft>(emptyCatering);
  const [protein, setProtein] = useState<{
    id?: string;
    name: string;
    price: string;
    unit: string;
    minimum_quantity: string;
    active: boolean;
  }>({ name: "", price: "", unit: "per person", minimum_quantity: "1", active: true });

  async function savePackage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const success = await runAction(
      () =>
        saveAdminCateringPackage({
          data: {
            ...(draft.id ? { id: draft.id } : {}),
            name: draft.name,
            description: draft.description,
            portion_size: draft.portion_size,
            serves: draft.serves,
            price_cents: Math.round(Number(draft.price) * 100),
            minimum_order: Number(draft.minimum_order),
            image_key: draft.image_key,
            active: draft.active,
            featured: draft.featured,
          },
        }),
      draft.id ? "Catering package updated" : "Catering package created",
    );
    if (success) setDraft(emptyCatering);
  }

  async function saveProtein(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const success = await runAction(
      () =>
        saveAdminCateringProtein({
          data: {
            ...(protein.id ? { id: protein.id } : {}),
            name: protein.name,
            price_cents: Math.round(Number(protein.price) * 100),
            unit: protein.unit,
            minimum_quantity: Number(protein.minimum_quantity),
            active: protein.active,
          },
        }),
      protein.id ? "Catering protein add-on updated" : "Catering protein add-on created",
    );
    if (success)
      setProtein({ name: "", price: "", unit: "per person", minimum_quantity: "1", active: true });
  }

  return (
    <Panel
      title="Catering"
      description="Manage catering package pricing, portions, availability and optional protein add-ons."
    >
      <section className="mb-6 rounded-2xl bg-background p-5">
        <h3 className="font-display text-xl font-black uppercase">Customer inquiries</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Follow up directly with guests to confirm event availability and final pricing.
        </p>
        <div className="mt-4 space-y-3">
          {data.cateringInquiries.length ? (
            data.cateringInquiries.map((inquiry) => (
              <article
                key={inquiry.id}
                className="grid gap-3 rounded-xl bg-card p-4 shadow-card sm:grid-cols-[1fr_auto] sm:items-start"
              >
                <div>
                  <p className="font-semibold">{inquiry.name}</p>
                  <p className="text-sm text-muted-foreground">
                    <a className="underline" href={`mailto:${inquiry.email}`}>
                      {inquiry.email}
                    </a>
                    {" · "}
                    <a className="underline" href={`tel:${inquiry.phone.replace(/[^\d+]/g, "")}`}>
                      {inquiry.phone}
                    </a>
                  </p>
                  <p className="mt-2 text-sm">
                    {inquiry.event_date} · {inquiry.guest_count} guests ·{" "}
                    {inquiry.package_name ?? "Help me choose"}
                  </p>
                  {inquiry.message ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {inquiry.message}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-muted-foreground">
                    Submitted {new Date(inquiry.created_at).toLocaleString()}
                  </p>
                </div>
                <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
                  Status
                  <select
                    value={inquiry.status}
                    disabled={busy}
                    onChange={(event) => {
                      const status = event.target.value as "new" | "contacted" | "closed";
                      void runAction(
                        () =>
                          updateAdminCateringInquiry({
                            data: { id: inquiry.id, status },
                          }),
                        "Catering inquiry updated",
                      );
                    }}
                    className="min-h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground"
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="closed">Closed</option>
                  </select>
                </label>
              </article>
            ))
          ) : (
            <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              No catering requests yet.
            </p>
          )}
        </div>
      </section>
      <div className="grid gap-6 xl:grid-cols-2">
        <div className="space-y-4">
          <form
            onSubmit={(event) => void savePackage(event)}
            className="space-y-3 rounded-2xl bg-background p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-xl font-black uppercase">
                {draft.id ? "Edit package" : "New package"}
              </h3>
              {draft.id ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setDraft(emptyCatering)}
                >
                  New
                </Button>
              ) : null}
            </div>
            <TextInput
              label="Package name"
              value={draft.name}
              onChange={(value) => setDraft({ ...draft, name: value })}
              required
            />
            <TextArea
              label="Description"
              value={draft.description}
              onChange={(value) => setDraft({ ...draft, description: value })}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput
                label="Portion size"
                value={draft.portion_size}
                onChange={(value) => setDraft({ ...draft, portion_size: value })}
              />
              <TextInput
                label="Serves"
                value={draft.serves}
                onChange={(value) => setDraft({ ...draft, serves: value })}
              />
              <TextInput
                label="Price ($)"
                type="number"
                min="0"
                step="0.01"
                value={draft.price}
                onChange={(value) => setDraft({ ...draft, price: value })}
                required
              />
              <TextInput
                label="Minimum order"
                type="number"
                min="1"
                value={draft.minimum_order}
                onChange={(value) => setDraft({ ...draft, minimum_order: value })}
              />
            </div>
            <TextInput
              label="Image key or HTTPS URL"
              value={draft.image_key}
              onChange={(value) => setDraft({ ...draft, image_key: value })}
            />
            <div className="flex gap-5">
              <CheckInput
                label="Active"
                checked={draft.active}
                onChange={(checked) => setDraft({ ...draft, active: checked })}
              />
              <CheckInput
                label="Featured"
                checked={draft.featured}
                onChange={(checked) => setDraft({ ...draft, featured: checked })}
              />
            </div>
            <Button type="submit" variant="hero" loading={busy}>
              {draft.id ? "Save package" : "Create package"}
            </Button>
          </form>
          {data.catering.map((item) => (
            <article
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-card p-4 shadow-card"
            >
              <div>
                <p className="font-semibold">{item.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatMoney(item.price_cents)} · serves {item.serves} ·{" "}
                  {item.active ? "active" : "inactive"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setDraft({
                      id: item.id,
                      name: item.name,
                      description: item.description,
                      portion_size: item.portion_size,
                      serves: item.serves,
                      price: (item.price_cents / 100).toFixed(2),
                      minimum_order: String(item.minimum_order),
                      image_key: item.image_key,
                      active: item.active,
                      featured: item.featured,
                    })
                  }
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm(`Delete ${item.name}?`)) return;
                    void runAction(
                      () => deleteAdminCateringPackage({ data: { id: item.id } }),
                      "Catering package deleted",
                    );
                  }}
                >
                  Delete
                </Button>
              </div>
            </article>
          ))}
        </div>
        <div className="space-y-4">
          <form
            onSubmit={(event) => void saveProtein(event)}
            className="space-y-3 rounded-2xl bg-background p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-display text-xl font-black uppercase">
                {protein.id ? "Edit protein add-on" : "Protein add-on"}
              </h3>
              {protein.id ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setProtein({
                      name: "",
                      price: "",
                      unit: "per person",
                      minimum_quantity: "1",
                      active: true,
                    })
                  }
                >
                  New
                </Button>
              ) : null}
            </div>
            <TextInput
              label="Name"
              value={protein.name}
              onChange={(value) => setProtein({ ...protein, name: value })}
              required
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput
                label="Price ($)"
                type="number"
                min="0"
                step="0.01"
                value={protein.price}
                onChange={(value) => setProtein({ ...protein, price: value })}
                required
              />
              <TextInput
                label="Unit"
                value={protein.unit}
                onChange={(value) => setProtein({ ...protein, unit: value })}
                required
              />
            </div>
            <TextInput
              label="Minimum quantity"
              type="number"
              min="1"
              value={protein.minimum_quantity}
              onChange={(value) => setProtein({ ...protein, minimum_quantity: value })}
            />
            <CheckInput
              label="Active"
              checked={protein.active}
              onChange={(checked) => setProtein({ ...protein, active: checked })}
            />
            <Button type="submit" variant="hero" loading={busy}>
              {protein.id ? "Save protein" : "Add protein"}
            </Button>
          </form>
          {data.cateringProteins.map((entry) => (
            <article
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-card p-4 shadow-card"
            >
              <div>
                <p className="font-semibold">{entry.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatMoney(entry.price_cents)} {entry.unit} · min {entry.minimum_quantity} ·{" "}
                  {entry.active ? "active" : "inactive"}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setProtein({
                      id: entry.id,
                      name: entry.name,
                      price: (entry.price_cents / 100).toFixed(2),
                      unit: entry.unit,
                      minimum_quantity: String(entry.minimum_quantity),
                      active: entry.active,
                    })
                  }
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm(`Delete ${entry.name}?`)) return;
                    void runAction(
                      () => deleteAdminCateringProtein({ data: { id: entry.id } }),
                      "Protein add-on deleted",
                    );
                  }}
                >
                  Delete
                </Button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </Panel>
  );
}

function GalleryPanel({
  data,
  runAction,
  busy,
}: {
  data: AdminWorkspaceData;
  runAction: (action: () => Promise<unknown>, message: string) => Promise<boolean>;
  busy: boolean;
}) {
  const [editingId, setEditingId] = useState<string | undefined>();
  const [url, setUrl] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [caption, setCaption] = useState("");
  const [active, setActive] = useState(true);

  async function upload(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2_000_000) {
      toast.error("Choose a JPEG, PNG or WebP image smaller than 2 MB.");
      return;
    }
    await runAction(async () => {
      const dataUrl = await readFileAsDataUrl(file);
      const result = await uploadAdminImage({ data: { dataUrl } });
      setUrl(result.url);
      setMediaType("image");
    }, "Gallery image uploaded");
  }

  return (
    <Panel
      title="Gallery management"
      description="Upload image assets to MongoDB GridFS or add secure external media URLs. Active entries appear on the public gallery."
    >
      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <form
          className="space-y-4 rounded-2xl bg-background p-5"
          onSubmit={(event) => {
            event.preventDefault();
            void runAction(
              () =>
                saveAdminGalleryItem({
                  data: {
                    ...(editingId ? { id: editingId } : {}),
                    url,
                    media_type: mediaType,
                    caption,
                    active,
                  },
                }),
              editingId ? "Gallery item updated" : "Gallery item published",
            ).then((success) => {
              if (success) {
                setEditingId(undefined);
                setUrl("");
                setCaption("");
                setActive(true);
              }
            });
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-display text-xl font-black uppercase">
              {editingId ? "Edit media" : "Add media"}
            </h3>
            {editingId ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingId(undefined);
                  setUrl("");
                  setCaption("");
                  setMediaType("image");
                  setActive(true);
                }}
              >
                New
              </Button>
            ) : null}
          </div>
          <SelectInput
            label="Media type"
            value={mediaType}
            onChange={(value) => setMediaType(value as "image" | "video")}
            options={[
              ["image", "Image"],
              ["video", "Video"],
            ]}
          />
          <TextInput
            label={mediaType === "video" ? "HTTPS video URL" : "Image key or HTTPS URL"}
            value={url}
            onChange={setUrl}
            placeholder="Upload an image or paste a secure URL"
            required
          />
          {mediaType === "image" ? (
            <label className="block text-sm font-semibold">
              Upload image (JPEG, PNG or WebP; max 2 MB)
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                disabled={busy}
                onChange={(event) => {
                  void upload(event.currentTarget.files?.[0]);
                  event.currentTarget.value = "";
                }}
                className="mt-1 block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-accent file:px-3 file:py-2 file:font-bold"
              />
            </label>
          ) : null}
          <TextArea label="Caption" value={caption} onChange={setCaption} />
          <CheckInput label="Visible on public gallery" checked={active} onChange={setActive} />
          <Button type="submit" variant="hero" loading={busy}>
            {editingId ? "Save gallery item" : "Publish gallery item"}
          </Button>
        </form>
        <div className="grid gap-4 sm:grid-cols-2">
          {data.gallery.map((item) => (
            <article key={item.id} className="overflow-hidden rounded-2xl bg-card shadow-card">
              {item.media_type === "video" ? (
                <video
                  src={item.url}
                  controls
                  preload="metadata"
                  className="aspect-video w-full bg-charcoal object-cover"
                />
              ) : foodImage(item.url) ? (
                <img
                  src={foodImage(item.url)}
                  alt={item.caption || "Gallery media"}
                  loading="lazy"
                  className="aspect-video w-full bg-muted object-cover"
                />
              ) : (
                <div className="aspect-video w-full bg-muted" />
              )}
              <div className="flex items-start justify-between gap-3 p-4">
                <div>
                  <p className="text-sm font-semibold">{item.caption || "Untitled media"}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {item.active ? "Public" : "Hidden"} · {item.media_type}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditingId(item.id);
                      setUrl(item.url);
                      setMediaType(item.media_type);
                      setCaption(item.caption);
                      setActive(item.active);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      if (!window.confirm("Remove this gallery item?")) return;
                      void runAction(
                        () => deleteAdminGalleryItem({ data: { id: item.id } }),
                        "Gallery item removed",
                      );
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            </article>
          ))}
          {!data.gallery.length ? <EmptyState>No gallery media yet.</EmptyState> : null}
        </div>
      </div>
    </Panel>
  );
}

function SalesPanel() {
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly" | "yearly">("daily");
  const [sales, setSales] = useState<Awaited<ReturnType<typeof getAdminSales>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    getAdminSales({ data: { period } })
      .then((result) => {
        if (active) setSales(result);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(reason instanceof Error ? reason.message : "Sales could not be loaded.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [period]);

  function downloadCsv() {
    if (!sales) return;
    const fields = [
      "Order",
      "Date",
      "Customer",
      "Status",
      "Fulfillment",
      "Total",
      "Payment status",
    ];
    const escape = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows = sales.orders.map((order) => [
      order.order_number,
      new Date(order.created_at).toISOString(),
      order.customer_name,
      order.status,
      order.fulfillment,
      (order.total_cents / 100).toFixed(2),
      order.payment_status ?? "not_charged",
    ]);
    rows.push([
      "",
      "",
      "",
      "Completed order value (demo)",
      "",
      (sales.completedOrderValueCents / 100).toFixed(2),
      "",
    ]);
    const csv = [
      fields.map(escape).join(","),
      ...rows.map((row) => row.map(escape).join(",")),
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `grill-swill-sales-${period}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Panel
      title="Sales reports"
      description="Period totals are based on completed order values, not captured payments. Checkout is currently a demo and no payments are processed."
    >
      <style>{`@media print { body * { visibility: hidden !important; } #sales-print, #sales-print * { visibility: visible !important; } #sales-print { position: absolute; inset: 0; width: 100%; padding: 24px; background: white; color: black; } }`}</style>
      <div className="mb-5 flex flex-wrap items-center gap-2 print:hidden">
        {(["daily", "weekly", "monthly", "yearly"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setPeriod(value)}
            className={`rounded-full px-4 py-2 text-sm font-bold capitalize ${value === period ? "bg-charcoal text-cream" : "bg-background text-muted-foreground"}`}
          >
            {value}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" disabled={!sales} onClick={downloadCsv}>
            Download CSV
          </Button>
          <Button size="sm" variant="outline" disabled={!sales} onClick={() => window.print()}>
            Print / Save PDF
          </Button>
        </div>
      </div>
      {error ? (
        <p role="alert" className="mb-4 rounded-xl bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {loading ? <p className="text-sm text-muted-foreground">Loading sales report…</p> : null}
      {sales ? (
        <div id="sales-print">
          <div className="mb-5">
            <h2 className="font-display text-2xl font-black uppercase">Sales · {period}</h2>
            <p className="text-xs text-muted-foreground">
              {new Date(sales.start).toLocaleString()} – {new Date(sales.end).toLocaleString()}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Completed order value only. Demo checkout means no payment has been collected.
            </p>
          </div>
          <div className="mb-6 grid gap-3 sm:grid-cols-3">
            <Metric label="All orders" value={String(sales.orderCount)} />
            <Metric label="Completed orders" value={String(sales.completedCount)} />
            <Metric
              label="Completed order value"
              value={formatMoney(sales.completedOrderValueCents)}
            />
          </div>
          {sales.truncated ? (
            <p className="mb-3 text-xs font-semibold text-destructive">
              CSV contains the latest 5,000 orders in this period. Period totals include all orders.
            </p>
          ) : null}
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[700px] text-left text-sm">
              <thead className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-3">Order</th>
                  <th className="p-3">Date</th>
                  <th className="p-3">Customer</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Payment</th>
                  <th className="p-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {sales.orders.map((order) => (
                  <tr key={order.id} className="border-b border-border last:border-0">
                    <td className="p-3 font-semibold">#{order.order_number}</td>
                    <td className="p-3 text-muted-foreground">
                      {new Date(order.created_at).toLocaleString()}
                    </td>
                    <td className="p-3">{order.customer_name}</td>
                    <td className="p-3 capitalize">{order.status}</td>
                    <td className="p-3">{order.payment_status ?? "not charged"}</td>
                    <td className="p-3 text-right font-semibold">
                      {formatMoney(order.total_cents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

function SettingsPanel({
  data,
  runAction,
  busy,
}: {
  data: AdminWorkspaceData;
  runAction: (action: () => Promise<unknown>, message: string) => Promise<boolean>;
  busy: boolean;
}) {
  const [deliveryFee, setDeliveryFee] = useState(
    (data.settings.delivery_fee_cents / 100).toFixed(2),
  );
  const [threshold, setThreshold] = useState(
    (data.settings.free_delivery_threshold_cents / 100).toFixed(2),
  );
  const [pointsPerDollar, setPointsPerDollar] = useState(String(data.settings.points_per_dollar));
  const [pointsPerDollarRedeemed, setPointsPerDollarRedeemed] = useState(
    String(data.settings.points_per_dollar_redeemed),
  );
  const [rewardTiers, setRewardTiers] = useState(data.settings.reward_tiers);
  const [hours, setHours] = useState(data.settings.business_hours);
  const settingsSnapshot = JSON.stringify(data.settings);
  const parsedSettings = useMemo(
    () =>
      z
        .object({
          delivery_fee_cents: z.number(),
          free_delivery_threshold_cents: z.number(),
          points_per_dollar: z.number(),
          points_per_dollar_redeemed: z.number(),
          reward_tiers: z.array(
            z.object({
              points: z.number(),
              label: z.string(),
              value: z.string(),
            }),
          ),
          business_hours: z.array(
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
              open: z.string(),
              close: z.string(),
            }),
          ),
        })
        .parse(JSON.parse(settingsSnapshot)),
    [settingsSnapshot],
  );

  useEffect(() => {
    setDeliveryFee((parsedSettings.delivery_fee_cents / 100).toFixed(2));
    setThreshold((parsedSettings.free_delivery_threshold_cents / 100).toFixed(2));
    setPointsPerDollar(String(parsedSettings.points_per_dollar));
    setPointsPerDollarRedeemed(String(parsedSettings.points_per_dollar_redeemed));
    setRewardTiers(parsedSettings.reward_tiers);
    setHours(parsedSettings.business_hours);
  }, [parsedSettings]);

  return (
    <Panel
      title="Store settings"
      description="Delivery pricing is applied by the server at checkout. Business hours and reward configuration are published operational details."
    >
      <form
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          void runAction(
            () =>
              saveAdminSettings({
                data: {
                  delivery_fee_cents: Math.round(Number(deliveryFee) * 100),
                  free_delivery_threshold_cents: Math.round(Number(threshold) * 100),
                  points_per_dollar: Number(pointsPerDollar),
                  points_per_dollar_redeemed: Number(pointsPerDollarRedeemed),
                  reward_tiers: rewardTiers.map((tier) => ({
                    points: Number(tier.points),
                    label: tier.label,
                    value: tier.value,
                  })),
                  business_hours: hours,
                },
              }),
            "Store settings saved",
          );
        }}
      >
        <div className="grid max-w-3xl gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <TextInput
            label="Delivery fee ($)"
            type="number"
            min="0"
            step="0.01"
            value={deliveryFee}
            onChange={setDeliveryFee}
            required
          />
          <TextInput
            label="Free delivery threshold ($)"
            type="number"
            min="0"
            step="0.01"
            value={threshold}
            onChange={setThreshold}
            required
          />
          <TextInput
            label="Points per $1"
            type="number"
            min="1"
            step="1"
            value={pointsPerDollar}
            onChange={setPointsPerDollar}
            required
          />
          <TextInput
            label="Points redeemed per $1"
            type="number"
            min="1"
            step="1"
            value={pointsPerDollarRedeemed}
            onChange={setPointsPerDollarRedeemed}
            required
          />
        </div>
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="font-display text-xl font-black uppercase">Reward tiers</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                setRewardTiers((current) => [
                  ...current,
                  { points: 250, label: "New reward", value: "$2.50 off" },
                ])
              }
            >
              Add reward
            </Button>
          </div>
          <div className="space-y-3">
            {rewardTiers.map((tier, index) => (
              <div
                key={`${tier.label}-${index}`}
                className="grid gap-3 rounded-2xl bg-card p-3 shadow-card sm:grid-cols-[120px_1fr_1fr_auto]"
              >
                <TextInput
                  label="Points"
                  type="number"
                  min="1"
                  value={String(tier.points)}
                  onChange={(value) =>
                    setRewardTiers((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, points: Number(value) || 0 } : item,
                      ),
                    )
                  }
                />
                <TextInput
                  label="Reward name"
                  value={tier.label}
                  onChange={(value) =>
                    setRewardTiers((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, label: value } : item,
                      ),
                    )
                  }
                />
                <TextInput
                  label="Perk"
                  value={tier.value}
                  onChange={(value) =>
                    setRewardTiers((current) =>
                      current.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, value } : item,
                      ),
                    )
                  }
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-end"
                  onClick={() =>
                    setRewardTiers((current) =>
                      current.filter((_, itemIndex) => itemIndex !== index),
                    )
                  }
                >
                  Remove
                </Button>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="mb-3 font-display text-xl font-black uppercase">Business hours</h3>
          <div className="overflow-x-auto rounded-2xl bg-card p-3 shadow-card">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-2">Day</th>
                  <th className="p-2">Closed</th>
                  <th className="p-2">Opens</th>
                  <th className="p-2">Closes</th>
                </tr>
              </thead>
              <tbody>
                {hours.map((entry, index) => (
                  <tr key={entry.day} className="border-t border-border">
                    <td className="p-2 font-semibold">{entry.day}</td>
                    <td className="p-2">
                      <input
                        type="checkbox"
                        checked={entry.closed}
                        onChange={(event) =>
                          setHours((current) =>
                            current.map((hour, i) =>
                              i === index ? { ...hour, closed: event.target.checked } : hour,
                            ),
                          )
                        }
                        aria-label={`${entry.day} closed`}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="time"
                        value={entry.open}
                        disabled={entry.closed}
                        onChange={(event) =>
                          setHours((current) =>
                            current.map((hour, i) =>
                              i === index ? { ...hour, open: event.target.value } : hour,
                            ),
                          )
                        }
                        className="rounded-lg border border-input bg-background px-2 py-1"
                        aria-label={`${entry.day} opening time`}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="time"
                        value={entry.close}
                        disabled={entry.closed}
                        onChange={(event) =>
                          setHours((current) =>
                            current.map((hour, i) =>
                              i === index ? { ...hour, close: event.target.value } : hour,
                            ),
                          )
                        }
                        className="rounded-lg border border-input bg-background px-2 py-1"
                        aria-label={`${entry.day} closing time`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <Button type="submit" variant="hero" loading={busy}>
          Save settings
        </Button>
      </form>
    </Panel>
  );
}

function ActivityPanel({ data }: { data: AdminWorkspaceData }) {
  return (
    <Panel
      title="Audit activity"
      description="Recent administrator and order actions recorded by the system."
    >
      <ul className="divide-y divide-border rounded-2xl bg-card px-4 shadow-card">
        {data.logs.map((log) => (
          <li key={log.id} className="flex flex-wrap items-start justify-between gap-3 py-4">
            <div>
              <p className="font-semibold">{log.action.replaceAll("_", " ")}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {Object.entries(log.details)
                  .map(([key, value]) => `${key.replaceAll("_", " ")}: ${String(value)}`)
                  .join(" · ")}
              </p>
            </div>
            <time className="text-xs text-muted-foreground">
              {new Date(log.created_at).toLocaleString()}
            </time>
          </li>
        ))}
        {!data.logs.length ? (
          <li className="py-8 text-center text-sm text-muted-foreground">
            No logged activity yet.
          </li>
        ) : null}
      </ul>
    </Panel>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl bg-card p-5 shadow-card sm:p-7">
      <div className="mb-6 border-b border-border pb-4">
        <h2 className="font-display text-2xl font-black uppercase sm:text-3xl">{title}</h2>
        <p className="mt-2 max-w-4xl text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

function TextInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required = false,
  disabled,
  ...props
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
  step?: string;
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        {...props}
        className={`${inputClass} mt-1`}
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 3,
  help,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
  help?: string;
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <textarea
        rows={rows}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass} mt-1 h-auto min-h-20 py-2`}
      />
      {help ? (
        <span className="mt-1 block text-xs font-normal text-muted-foreground">{help}</span>
      ) : null}
    </label>
  );
}

function SelectInput({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: [string, string][];
}) {
  return (
    <label className="block text-sm font-semibold">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`${inputClass} mt-1`}
      >
        {options.map(([optionValue, labelText]) => (
          <option key={optionValue} value={optionValue}>
            {labelText}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckInput({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-primary"
      />
      {label}
    </label>
  );
}

function QuickLink({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-cream/15 px-4 py-3 text-left text-sm font-bold transition hover:bg-cream/10"
    >
      {label}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-background p-4">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-2 font-display text-2xl font-black">{value}</p>
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function splitList(value: string) {
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result !== "string") {
        reject(new Error("The selected file could not be read."));
        return;
      }
      resolve(reader.result);
    });
    reader.addEventListener("error", () =>
      reject(new Error("The selected file could not be read.")),
    );
    reader.readAsDataURL(file);
  });
}

const inputClass =
  "block h-11 w-full rounded-xl border border-input bg-background px-3 text-sm outline-none transition focus:border-primary focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-50";
