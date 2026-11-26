import { useQuery } from "@tanstack/react-query";

import { storesQuery } from "@/lib/catalog.functions";
import type { Store } from "@/lib/menu-types";

const NO_STORES: Store[] = [];

export function useStorefrontLocations() {
  const query = useQuery(storesQuery());
  const stores = query.data ?? NO_STORES;
  return { stores, hasLocations: stores.length > 0, isPending: query.isPending };
}
