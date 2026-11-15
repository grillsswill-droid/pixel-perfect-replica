import { queryOptions } from "@tanstack/react-query";

import { getGuestRewards, getOrder } from "./orders.functions";

export const orderQuery = (id: string) =>
  queryOptions({
    queryKey: ["order", id],
    queryFn: () => getOrder({ data: { id } }),
    refetchInterval: 5000,
  });

export const guestRewardsQuery = (guestId: string | null) =>
  queryOptions({
    queryKey: ["guest-rewards", guestId],
    queryFn: () => getGuestRewards({ data: { guestId: guestId! } }),
    enabled: !!guestId,
  });
