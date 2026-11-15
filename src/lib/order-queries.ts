import { queryOptions } from "@tanstack/react-query";

import { getGuestRewards, getOrder } from "./orders.functions";

export const orderQuery = (id: string, token: string | null) =>
  queryOptions({
    queryKey: ["order", id, token],
    queryFn: () => getOrder({ data: { id, token: token! } }),
    enabled: !!token,
    refetchInterval: 5000,
  });

export const guestRewardsQuery = (guestId: string | null) =>
  queryOptions({
    queryKey: ["guest-rewards", guestId],
    queryFn: () => getGuestRewards({ data: { guestId: guestId! } }),
    enabled: !!guestId,
  });
