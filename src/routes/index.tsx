import { createFileRoute } from "@tanstack/react-router";

// The home route ships no og:image, so serve-time hosting can inject the
// project's social preview (explicit og:image or latest screenshot).
export const Route = createFileRoute("/")({
  component: Index,
});

// IMPORTANT: Replace this placeholder. See ./README.md for routing conventions.
function Index() {
  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ backgroundColor: "#fcfbf8" }}
    >
      <img
        data-lovable-blank-page-placeholder="REMOVE_THIS"
        src="https://cdn.gpteng.co/blank-app-v1.svg"
        alt="Your app will live here!"
      />
    </div>
  );
}

function CategoryGrid() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <Reveal className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold tracking-[0.25em] text-primary uppercase">The menu</p>
          <h2 className="mt-2 text-4xl font-black uppercase sm:text-5xl">What are you craving?</h2>
        </div>
        <Link to="/menu" className="flex items-center gap-1 text-sm font-bold text-primary hover:underline">
          Full menu <ArrowRight className="h-4 w-4" />
        </Link>
      </Reveal>
      <Stagger className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-6">
        {CATEGORIES.map((c, i) => (
          <StaggerItem key={c.id} className={cn(i < 2 ? "md:col-span-3" : "md:col-span-2", i === 4 && "col-span-2 md:col-span-2")}>
            <Link
              to="/menu"
              search={{ cat: c.id }}
              className="group relative block aspect-[4/5] overflow-hidden rounded-3xl bg-charcoal shadow-card md:aspect-auto md:h-80"
            >
              <img
                src={CATEGORY_IMAGES[c.id]}
                alt=""
                width={1024}
                height={1024}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal via-charcoal/30 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5 text-cream">
                <h3 className="text-2xl leading-none font-black uppercase sm:text-3xl">{c.short}</h3>
                <p className="mt-1.5 hidden text-sm text-cream/75 sm:block">{c.blurb}</p>
              </div>
              <span className="absolute top-4 right-4 grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground transition group-hover:-rotate-45">
                <ArrowRight className="h-5 w-5" />
              </span>
            </Link>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}

function Featured() {
  const { data } = useQuery(menuQuery());
  const [selected, setSelected] = useState<MenuItem | null>(null);
  const featured = (data ?? []).filter((i) => i.is_featured).slice(0, 4);
  if (featured.length === 0) return null;
  return (
    <section className="bg-cream-deep/60 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <Reveal>
          <p className="text-xs font-bold tracking-[0.25em] text-primary uppercase">Crowd favorites</p>
          <h2 className="mt-2 text-4xl font-black uppercase sm:text-5xl">The ones people drive for</h2>
        </Reveal>
        <Stagger className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((item) => (
            <StaggerItem key={item.id}>
              <MenuCard item={item} onSelect={setSelected} />
            </StaggerItem>
          ))}
        </Stagger>
      </div>
      <ItemCustomizer item={selected} onClose={() => setSelected(null)} />
    </section>
  );
}

function Heritage() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], ["-8%", "8%"]);
  const facts = [
    { n: "6am", t: "Potatoes hand-cut every morning" },
    { n: "500°", t: "Flat-top smash for the crust" },
    { n: "48h", t: "Slow-proofed pizza dough" },
    { n: "18h", t: "Cold brew steep time" },
  ];
  return (
    <section ref={ref} className="mx-auto grid max-w-7xl items-center gap-12 px-4 py-24 sm:px-6 lg:grid-cols-2">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[2rem] shadow-lift">
        <motion.img
          src={kitchenGrill}
          alt="Burgers being smashed on the Grill & Swill flat-top"
          width={1536}
          height={1024}
          loading="lazy"
          style={{ y, scale: 1.15 }}
          className="h-full w-full object-cover"
        />
        <div className="absolute bottom-4 left-4 rounded-full bg-cream px-4 py-2 text-xs font-bold tracking-widest uppercase">
          Since 1994
        </div>
      </div>
      <Reveal>
        <p className="text-xs font-bold tracking-[0.25em] text-primary uppercase">Our kitchen</p>
        <h2 className="mt-2 text-4xl font-black uppercase sm:text-5xl">No freezers. No heat lamps. No shortcuts.</h2>
        <p className="mt-5 max-w-lg text-lg text-charcoal/75">
          We started as one roadside grill with a hand-painted sign. The recipe hasn't changed: fresh beef, real buttermilk,
          dough that takes its time, and a crew that cooks your order when you place it.
        </p>
        <dl className="mt-8 grid grid-cols-2 gap-4">
          {facts.map((f) => (
            <div key={f.n} className="rounded-2xl bg-card p-5 shadow-card">
              <dt className="font-display text-4xl font-black text-primary">{f.n}</dt>
              <dd className="mt-1 text-sm font-semibold text-muted-foreground">{f.t}</dd>
            </div>
          ))}
        </dl>
      </Reveal>
    </section>
  );
}

function RewardsTeaser() {
  return (
    <section className="px-4 pb-24 sm:px-6">
      <Reveal className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-flame p-8 text-primary-foreground sm:p-14">
        <Flame className="absolute -right-10 -bottom-10 h-72 w-72 opacity-15" strokeWidth={1} />
        <div className="relative grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:items-center">
          <div>
            <p className="text-xs font-bold tracking-[0.25em] uppercase opacity-80">Swill Rewards</p>
            <h2 className="mt-2 text-4xl font-black uppercase sm:text-6xl">Eat. Earn. Repeat.</h2>
            <p className="mt-4 max-w-md text-lg opacity-90">
              Every $1 earns {POINTS_PER_DOLLAR} points — no account, no password. Points are saved on this device and
              redeem right at checkout.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="cream" size="lg">
                <Link to="/rewards">See my points</Link>
              </Button>
              <Button asChild variant="outline-light" size="lg">
                <Link to="/deals">Today's deals</Link>
              </Button>
            </div>
          </div>
          <ul className="grid gap-2">
            {REWARD_TIERS.map((t) => (
              <li key={t.points} className="flex items-center justify-between rounded-2xl bg-charcoal/25 px-5 py-3 backdrop-blur-sm">
                <span className="font-semibold">{t.label}</span>
                <span className="font-display font-black tabular-nums">{t.points} pts</span>
              </li>
            ))}
          </ul>
        </div>
      </Reveal>
      <div className="mx-auto mt-6 flex max-w-7xl items-center justify-center gap-2 text-sm font-semibold text-muted-foreground">
        <MapPin className="h-4 w-4 text-primary" />
        <Link to="/locations" className="hover:text-charcoal hover:underline">
          Find your nearest Grill & Swill
        </Link>
      </div>
    </section>
  );
}
