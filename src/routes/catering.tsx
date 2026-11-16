import { queryOptions, useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Phone, Utensils } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useGuestId } from "@/hooks/use-guest";
import { getPublicCateringMenu, submitCateringInquiry } from "@/lib/admin.functions";
import { foodImage } from "@/lib/food-images";
import { storesQuery } from "@/lib/catalog.functions";
import { formatMoney } from "@/lib/pricing";

const cateringMenuQuery = () =>
  queryOptions({
    queryKey: ["catering-menu"],
    queryFn: () => getPublicCateringMenu(),
    staleTime: 60_000,
  });

export const Route = createFileRoute("/catering")({
  loader: ({ context }) => context.queryClient.ensureQueryData(cateringMenuQuery()),
  head: () => ({
    meta: [
      { title: "Catering | Grill & Swill" },
      { name: "description", content: "Plan your next gathering with Grill & Swill catering." },
    ],
  }),
  component: CateringPage,
});

function CateringPage() {
  const guestId = useGuestId();
  const { data, isLoading, isError } = useQuery(cateringMenuQuery());
  const { data: stores = [] } = useQuery(storesQuery());

  return (
    <main className="min-h-[65vh] bg-background">
      <section className="bg-charcoal px-5 py-14 text-cream sm:px-8 sm:py-20">
        <div className="mx-auto max-w-7xl">
          <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-primary">
            <Utensils className="h-4 w-4" /> Gather around the good stuff
          </p>
          <h1 className="mt-3 font-display text-5xl font-black uppercase sm:text-7xl">Catering</h1>
          <p className="mt-4 max-w-xl text-cream/70">
            Fresh favorites for your next get-together. Talk with your nearest grill about timing,
            availability and the right portions for your group.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading catering options…</p>
        ) : null}
        {isError ? (
          <p role="alert" className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">
            Catering options couldn’t be loaded. Please contact a store for help.
          </p>
        ) : null}
        {!isLoading && !isError && !data?.packages.length ? (
          <div className="rounded-3xl bg-card p-8 text-center shadow-card">
            <h2 className="font-display text-2xl font-black uppercase">
              Catering menus are being prepared
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Call your nearest location to discuss a custom order.
            </p>
          </div>
        ) : null}

        {data?.packages.length ? (
          <>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {data.packages.map((item) => (
                <article key={item.id} className="overflow-hidden rounded-3xl bg-card shadow-card">
                  {foodImage(item.image_key) ? (
                    <img
                      src={foodImage(item.image_key)}
                      alt=""
                      loading="lazy"
                      className="aspect-[1.4] w-full object-cover"
                    />
                  ) : null}
                  <div className="p-5">
                    {item.featured ? (
                      <p className="text-xs font-black uppercase tracking-wider text-primary">
                        Featured
                      </p>
                    ) : null}
                    <h2 className="mt-1 font-display text-2xl font-black uppercase">{item.name}</h2>
                    <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                    <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4 text-sm">
                      <div>
                        <dt className="text-xs text-muted-foreground">Portion</dt>
                        <dd className="mt-1 font-semibold">
                          {item.portion_size || "Ask for details"}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Serves</dt>
                        <dd className="mt-1 font-semibold">{item.serves || "Ask for details"}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Starting at</dt>
                        <dd className="mt-1 font-semibold">{formatMoney(item.price_cents)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted-foreground">Minimum</dt>
                        <dd className="mt-1 font-semibold">{item.minimum_order}</dd>
                      </div>
                    </dl>
                  </div>
                </article>
              ))}
            </div>
            {data.proteins.length ? (
              <section className="mt-10 rounded-3xl bg-accent p-6 sm:p-8">
                <h2 className="font-display text-2xl font-black uppercase">Protein add-ons</h2>
                <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.proteins.map((protein) => (
                    <li key={protein.id} className="rounded-2xl bg-card p-4">
                      <p className="font-bold">{protein.name}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {formatMoney(protein.price_cents)} {protein.unit} · minimum{" "}
                        {protein.minimum_quantity}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ) : null}

        <CateringInquiryForm packages={data?.packages ?? []} guestId={guestId} />
      </section>
    </main>
  );
}

function CateringInquiryForm({
  packages,
  guestId,
}: {
  packages: Array<{ id: string; name: string }>;
  guestId: string | null;
}) {
  const [values, setValues] = useState({
    name: "",
    email: "",
    phone: "",
    event_date: "",
    guest_count: "",
    package_id: "",
    message: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!guestId) {
      setError("Please try again in a moment.");
      return;
    }
    setBusy(true);
    setError("");
    setSubmitted(false);
    try {
      const result = await submitCateringInquiry({
        data: {
          ...values,
          guest_id: guestId,
          guest_count: Number(values.guest_count),
          package_id: values.package_id || null,
        },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSubmitted(true);
      setValues({
        ...values,
        event_date: "",
        guest_count: "",
        package_id: "",
        message: "",
      });
      toast.success("Your catering request has been sent.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "We couldn’t send your request.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-10 rounded-3xl bg-accent p-6 sm:p-8">
      <div className="max-w-2xl">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">
          Tell us what you’re planning
        </p>
        <h2 className="mt-2 font-display text-3xl font-black uppercase">Request catering</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Send your event details and a team member will follow up to confirm availability and
          pricing. This is a request, not an order or payment.
        </p>
      </div>
      {submitted ? (
        <p role="status" className="mt-5 rounded-xl bg-card p-4 text-sm font-semibold">
          Thanks — your request is in. A Grill &amp; Swill team member will be in touch.
        </p>
      ) : null}
      <form onSubmit={(event) => void submit(event)} className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold">
          Name
          <input
            required
            minLength={2}
            maxLength={80}
            value={values.name}
            onChange={(event) => setValues({ ...values, name: event.target.value })}
            className="min-h-11 rounded-xl border border-border bg-card px-3"
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Email
          <input
            required
            type="email"
            maxLength={254}
            value={values.email}
            onChange={(event) => setValues({ ...values, email: event.target.value })}
            className="min-h-11 rounded-xl border border-border bg-card px-3"
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Phone
          <input
            required
            type="tel"
            minLength={10}
            maxLength={20}
            value={values.phone}
            onChange={(event) => setValues({ ...values, phone: event.target.value })}
            className="min-h-11 rounded-xl border border-border bg-card px-3"
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Event date
          <input
            required
            type="date"
            min={new Date().toISOString().slice(0, 10)}
            value={values.event_date}
            onChange={(event) => setValues({ ...values, event_date: event.target.value })}
            className="min-h-11 rounded-xl border border-border bg-card px-3"
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Number of guests
          <input
            required
            type="number"
            min={1}
            max={5000}
            value={values.guest_count}
            onChange={(event) => setValues({ ...values, guest_count: event.target.value })}
            className="min-h-11 rounded-xl border border-border bg-card px-3"
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Package of interest
          <select
            value={values.package_id}
            onChange={(event) => setValues({ ...values, package_id: event.target.value })}
            className="min-h-11 rounded-xl border border-border bg-card px-3"
          >
            <option value="">Help me choose</option>
            {packages.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold sm:col-span-2">
          Additional details
          <textarea
            rows={4}
            maxLength={1500}
            value={values.message}
            onChange={(event) => setValues({ ...values, message: event.target.value })}
            className="rounded-xl border border-border bg-card p-3"
          />
        </label>
        {error ? (
          <p role="alert" className="text-sm text-destructive sm:col-span-2">
            {error}
          </p>
        ) : null}
        <div className="sm:col-span-2">
          <Button type="submit" variant="hero" loading={busy} disabled={!guestId}>
            Send catering request <ArrowRight />
          </Button>
        </div>
      </form>
    </section>
  );
}
