import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/* eslint-disable no-control-regex -- Public configuration must reject control characters. */

import {
  BUSINESS_NAME,
  DEFAULT_SUPPORT_EMAIL,
  type CustomerSiteConfiguration,
} from "./customer-site";

export const getCustomerSiteConfiguration = createServerFn({ method: "GET" }).handler(
  async (): Promise<CustomerSiteConfiguration> => {
    const { loadLocalServerEnvironment } = await import("./server-environment.server");
    loadLocalServerEnvironment();
    const { isSupportInboxConfigured, isSupportEmailDeliveryConfigured } =
      await import("./support.server");
    const configuredEmail = z
      .string()
      .email()
      .max(254)
      .safeParse(process.env["SUPPORT_EMAIL"]?.trim());
    const publicText = (key: string, maximum = 300): string | null => {
      const value = process.env[key]?.trim();
      return value && value.length <= maximum && !/[\u0000-\u001f]/.test(value) ? value : null;
    };
    return {
      supportEmail: configuredEmail.success ? configuredEmail.data : DEFAULT_SUPPORT_EMAIL,
      inboxEnabled: isSupportInboxConfigured(),
      emailDeliveryEnabled: isSupportEmailDeliveryConfigured(),
      businessName: BUSINESS_NAME,
      operatingRegions: "Worldwide",
      legalBusinessName: publicText("LEGAL_BUSINESS_NAME"),
      businessAddress: publicText("LEGAL_BUSINESS_ADDRESS", 600),
      jurisdiction: publicText("LEGAL_JURISDICTION"),
      supportHours: publicText("SUPPORT_HOURS"),
    };
  },
);
