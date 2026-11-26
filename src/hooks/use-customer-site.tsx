import { createContext, useContext, type ReactNode } from "react";

import {
  DEFAULT_CUSTOMER_CONFIGURATION,
  type CustomerSiteConfiguration,
} from "@/lib/customer-site";

const CustomerSiteContext = createContext<CustomerSiteConfiguration>(
  DEFAULT_CUSTOMER_CONFIGURATION,
);

export function CustomerSiteProvider({
  configuration,
  children,
}: {
  configuration: CustomerSiteConfiguration;
  children: ReactNode;
}) {
  return (
    <CustomerSiteContext.Provider value={configuration}>{children}</CustomerSiteContext.Provider>
  );
}

export function useCustomerSite() {
  return useContext(CustomerSiteContext);
}
