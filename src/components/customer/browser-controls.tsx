import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { clearCustomerBrowserData, MAP_PREFERENCE_KEY } from "@/lib/browser-privacy";
import { useStorefrontLocations } from "@/hooks/use-storefront-locations";

export function BrowserControls() {
  const { hasLocations } = useStorefrontLocations();
  const [mapsAllowed, setMapsAllowed] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  useEffect(() => {
    try {
      setMapsAllowed(localStorage.getItem(MAP_PREFERENCE_KEY) === "allowed");
    } catch {
      /* The controls still work for this page if storage is blocked. */
    }
  }, []);

  function setMaps(allowed: boolean) {
    setMapsAllowed(allowed);
    try {
      localStorage.setItem(MAP_PREFERENCE_KEY, allowed ? "allowed" : "blocked");
      setStatus(
        allowed
          ? "Embedded maps can load when you visit Locations."
          : "Embedded maps will wait until you choose to load them.",
      );
    } catch {
      setStatus(
        "Your browser did not save this preference. Maps will ask again on your next visit.",
      );
    }
  }

  function clearData() {
    try {
      clearCustomerBrowserData(localStorage, sessionStorage);
      window.location.reload();
    } catch {
      setStatus(
        "Your browser blocked this action. You can clear this site's storage in your browser settings.",
      );
    }
  }

  return (
    <section
      id="browser-controls"
      className="mt-12 scroll-mt-28 border-t border-charcoal/15 pt-8"
      aria-labelledby="browser-controls-title"
    >
      <h2 id="browser-controls-title" className="font-display text-2xl font-black">
        Your browser controls
      </h2>
      <div className="mt-6 space-y-7">
        {hasLocations ? (
          <div>
            <label className="flex min-h-11 items-center gap-3 text-sm font-bold">
              <input
                type="checkbox"
                checked={mapsAllowed}
                onChange={(event) => setMaps(event.target.checked)}
                className="h-5 w-5 shrink-0 accent-primary"
              />
              Allow embedded OpenStreetMap maps
            </label>
            <p className="mt-2 max-w-[70ch] text-sm leading-6 text-muted-foreground">
              Map requests share technical information with OpenStreetMap. Turning this off stops
              future automatic map loads; addresses and pickup links stay available.
            </p>
          </div>
        ) : null}
        <div>
          <h3 className="text-sm font-bold">Clear Grill & Swill data on this device</h3>
          <p className="mt-2 max-w-[70ch] text-sm leading-6 text-muted-foreground">
            This removes the saved cart, guest identifier and contact/address details
            {hasLocations ? ", along with your map preference" : ""}. You may lose access to this
            device's rewards and order history. It does not erase server records or data belonging
            to other applications.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="outline" className="mt-4">
                Clear my browser data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear this device's Grill & Swill data?</AlertDialogTitle>
                <AlertDialogDescription>
                  Your cart and saved contact details will be removed. Clearing the guest identifier
                  can disconnect this browser from past orders and rewards. Server records remain;
                  contact support for a data request.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep my data</AlertDialogCancel>
                <AlertDialogAction onClick={clearData}>Clear and reload</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      {status ? (
        <p role="status" className="mt-4 text-sm leading-6">
          {status}
        </p>
      ) : null}
    </section>
  );
}

export function ExternalMap({
  src,
  title,
  className,
}: {
  src: string;
  title: string;
  className?: string;
}) {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    try {
      setAllowed(localStorage.getItem(MAP_PREFERENCE_KEY) === "allowed");
    } catch {
      /* Default to no external map request. */
    }
  }, []);
  function load() {
    setAllowed(true);
    try {
      localStorage.setItem(MAP_PREFERENCE_KEY, "allowed");
    } catch {
      /* Session-only choice. */
    }
  }
  return allowed ? (
    <iframe title={title} src={src} className={className} loading="lazy" />
  ) : (
    <div
      className={`${className ?? ""} flex flex-col items-center justify-center gap-4 bg-card p-8 text-center`}
    >
      <h2 className="font-display text-xl font-black">See this grill on the map</h2>
      <p className="max-w-sm text-sm leading-6 text-muted-foreground">
        Loading the map connects to OpenStreetMap. You can still use the address and order pickup
        without loading it.
      </p>
      <Button type="button" variant="outline" onClick={load}>
        Load map
      </Button>
    </div>
  );
}
