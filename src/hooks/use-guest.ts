import { useEffect, useState } from "react";

const KEY = "grill-swill-guest-id";

/** Anonymous per-device id that rewards points and order history attach to. */
export function useGuestId(): string | null {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    let existing = window.localStorage.getItem(KEY);
    if (!existing || !/^[0-9a-f-]{36}$/i.test(existing)) {
      existing = crypto.randomUUID();
      window.localStorage.setItem(KEY, existing);
    }
    setId(existing);
  }, []);
  return id;
}
