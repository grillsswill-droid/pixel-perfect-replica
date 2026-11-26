import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

import { customerFaqGroups } from "@/lib/customer-content";
import { useStorefrontLocations } from "@/hooks/use-storefront-locations";
import { CustomerContent, CustomerPageHeader, SupportHelp } from "./customer-layout";

export function FaqPage() {
  const { hasLocations } = useStorefrontLocations();
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const search = query.trim().toLowerCase();
    return customerFaqGroups(hasLocations)
      .map((group) => ({
        ...group,
        items: group.items.filter(
          (item) =>
            !search || `${item.question} ${item.answer.join(" ")}`.toLowerCase().includes(search),
        ),
      }))
      .filter((group) => group.items.length > 0);
  }, [query, hasLocations]);
  const count = groups.reduce((total, group) => total + group.items.length, 0);

  return (
    <>
      <CustomerPageHeader
        title="Good questions. Clear answers."
        description={`Help with ordering, payments, ${hasLocations ? "pickup, " : ""}delivery, food requirements and the details that matter after checkout.`}
      />
      <CustomerContent>
        <div className="grid gap-10 lg:grid-cols-[250px_minmax(0,1fr)] lg:gap-16">
          <aside className="h-fit lg:sticky lg:top-28">
            <label htmlFor="faq-search" className="text-sm font-bold">
              Search the FAQs
            </label>
            <div className="relative mt-2">
              <Search
                className="pointer-events-none absolute top-3.5 left-3.5 h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              <input
                id="faq-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Try “payment” or “allergy”"
                className="h-12 w-full rounded-xl border border-input bg-card pr-11 pl-10 text-sm outline-none focus:ring-2 focus:ring-primary"
              />
              {query ? (
                <button
                  type="button"
                  aria-label="Clear FAQ search"
                  onClick={() => setQuery("")}
                  className="absolute top-0 right-0 grid h-12 w-11 place-items-center rounded-r-xl hover:bg-muted"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>
            <p
              role="status"
              aria-live="polite"
              className="mt-3 text-xs leading-5 text-muted-foreground"
            >
              {count} {count === 1 ? "answer" : "answers"}
              {query ? " found" : " to help you"}
            </p>
            <nav
              aria-label="FAQ topics"
              className="mt-6 flex flex-wrap gap-x-4 gap-y-1 lg:flex-col"
            >
              {groups.map((group, index) => (
                <a
                  key={group.title}
                  href={`#faq-group-${index}`}
                  className="inline-flex min-h-11 items-center text-sm font-semibold underline-offset-4 hover:underline"
                >
                  {group.title}
                </a>
              ))}
            </nav>
          </aside>
          <div className="min-w-0">
            {groups.length ? (
              groups.map((group, index) => (
                <section key={group.title} id={`faq-group-${index}`} className="mb-12 scroll-mt-28">
                  <h2 className="mb-5 font-display text-2xl font-black sm:text-3xl">
                    {group.title}
                  </h2>
                  <div className="border-t border-charcoal/20">
                    {group.items.map((item) => (
                      <details
                        key={item.question}
                        className="group border-b border-charcoal/20 py-1"
                      >
                        <summary className="cursor-pointer py-5 pr-5 text-base leading-6 font-bold outline-offset-4 marker:text-primary">
                          {item.question}
                        </summary>
                        <div className="max-w-[70ch] space-y-3 pb-6 text-base leading-7 text-muted-foreground">
                          {item.answer.map((answer) => (
                            <p key={answer}>{answer}</p>
                          ))}
                        </div>
                      </details>
                    ))}
                  </div>
                </section>
              ))
            ) : (
              <p className="py-8 text-base leading-7">
                No answers match that search. Try a shorter phrase, or contact support below.
              </p>
            )}
            <SupportHelp />
          </div>
        </div>
      </CustomerContent>
    </>
  );
}
