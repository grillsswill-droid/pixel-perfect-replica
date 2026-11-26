import { Link } from "@tanstack/react-router";

import { POLICY_VERSION_DATE, customerPolicyPage } from "@/lib/customer-content";
import { customerPolicyLinks, supportMailto } from "@/lib/customer-site";
import { useCustomerSite } from "@/hooks/use-customer-site";
import { useStorefrontLocations } from "@/hooks/use-storefront-locations";
import { BrowserControls } from "./browser-controls";
import { CustomerContent, CustomerPageHeader, SupportHelp } from "./customer-layout";

function PolicyPage({ slug }: { slug: string }) {
  const { hasLocations } = useStorefrontLocations();
  const policy = customerPolicyPage(slug, hasLocations);
  const configuration = useCustomerSite();
  return (
    <>
      <CustomerPageHeader title={policy.title} description={policy.description} />
      <CustomerContent>
        <div className="grid gap-10 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-16">
          <aside className="h-fit lg:sticky lg:top-28">
            <p className="text-xs leading-5 text-muted-foreground">
              Last updated{" "}
              {new Date(`${POLICY_VERSION_DATE}T00:00:00Z`).toLocaleDateString("en", {
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "UTC",
              })}
            </p>
            <nav aria-label="On this page" className="mt-5 space-y-1">
              {policy.sections.map((section, index) => (
                <a
                  key={section.heading}
                  href={`#policy-section-${index}`}
                  className="flex min-h-11 items-center text-sm leading-5 font-semibold hover:underline underline-offset-4"
                >
                  {section.heading}
                </a>
              ))}
              {slug === "cookies" ? (
                <a
                  href="#browser-controls"
                  className="flex min-h-11 items-center text-sm font-semibold hover:underline underline-offset-4"
                >
                  Your browser controls
                </a>
              ) : null}
            </nav>
            <nav aria-label="Other policies" className="mt-7 border-t border-charcoal/15 pt-5">
              {customerPolicyLinks(hasLocations)
                .filter((link) => link.path !== `/${slug}`)
                .map((link) => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className="flex min-h-11 items-center text-sm leading-5 text-muted-foreground hover:text-foreground"
                  >
                    {link.label}
                  </Link>
                ))}
            </nav>
          </aside>
          <article className="min-w-0 max-w-[75ch]">
            <div className="mb-10 border-b border-charcoal/15 pb-6 text-sm leading-6">
              <p>
                <strong>{configuration.legalBusinessName ?? configuration.businessName}</strong> ·
                International customers
              </p>
              {configuration.businessAddress ? (
                <p className="mt-2">{configuration.businessAddress}</p>
              ) : null}
              {configuration.jurisdiction ? (
                <p className="mt-2">
                  Business jurisdiction: {configuration.jurisdiction}. Mandatory rights in your
                  location are preserved.
                </p>
              ) : null}
              <a
                href={supportMailto(configuration.supportEmail, `${policy.title} question`)}
                className="mt-2 inline-flex min-h-11 items-center break-all font-bold text-primary underline underline-offset-4"
              >
                {configuration.supportEmail}
              </a>
            </div>
            {policy.sections.map((section, index) => (
              <section
                key={section.heading}
                id={`policy-section-${index}`}
                className="mb-10 scroll-mt-28"
              >
                <h2 className="mb-4 font-display text-xl leading-snug font-black sm:text-2xl">
                  {section.heading}
                </h2>
                <div className="space-y-4 text-base leading-7 text-muted-foreground">
                  {section.paragraphs?.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  {section.bullets?.length ? (
                    <ul className="list-disc space-y-3 pl-5 marker:text-primary">
                      {section.bullets.map((bullet) => (
                        <li key={bullet}>{bullet}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </section>
            ))}
            {slug === "cookies" ? <BrowserControls /> : null}
            <SupportHelp />
          </article>
        </div>
      </CustomerContent>
    </>
  );
}

export const PrivacyPage = () => <PolicyPage slug="privacy" />;
export const TermsPage = () => <PolicyPage slug="terms" />;
export const RefundPolicyPage = () => <PolicyPage slug="refund-policy" />;
export const DeliveryPolicyPage = () => <PolicyPage slug="delivery-policy" />;
export const AllergensPage = () => <PolicyPage slug="allergens" />;
export const CookiesPage = () => <PolicyPage slug="cookies" />;
export const AccessibilityPage = () => <PolicyPage slug="accessibility" />;
