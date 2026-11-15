import { useEffect, useState } from "react";

const KEY = "grill-swill-guest-id";

/** Anonymous per-device id that rewards points and order history attach to. */
export function useGuestId(): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    let existing = window.localStorage.getItem(KEY);
    if (
      !existing ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(existing)
    ) {
      existing = crypto.randomUUID();
      window.localStorage.setItem(KEY, existing);
    }
    setId(existing);
  }, []);
  return id;
}
