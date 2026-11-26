import { useEffect, useRef, useState } from "react";

import {
  getGalleryVideoUrlError,
  getStreamableVideoId,
  isDirectGalleryVideoUrl,
  resolveGalleryVideoUrl,
} from "@/lib/gallery-video";

type VideoSourceState = {
  source: string;
  url: string | null;
  loading: boolean;
  error: string | null;
};

type CachedVideoSource = {
  source: string;
  url: string;
  expiresAt: number;
};

function sourceExpiry(url: string) {
  const expires = Number(new URL(url).searchParams.get("Expires"));
  if (Number.isFinite(expires) && expires > 0)
    return expires < 1_000_000_000_000 ? expires * 1000 : expires;
  return Date.now() + 5 * 60_000;
}

export function useGalleryVideoSource(source: string, active: boolean) {
  const [retryCount, setRetryCount] = useState(0);
  const [state, setState] = useState<VideoSourceState>({
    source: "",
    url: null,
    loading: false,
    error: null,
  });
  const cached = useRef<CachedVideoSource | null>(null);

  useEffect(() => {
    if (!source) {
      setState({ source, url: null, loading: false, error: null });
      return;
    }

    if (isDirectGalleryVideoUrl(source)) {
      setState({ source, url: new URL(source).href, loading: false, error: null });
      return;
    }

    if (!getStreamableVideoId(source)) {
      setState({ source, url: null, loading: false, error: getGalleryVideoUrlError() });
      return;
    }

    if (cached.current?.source === source && cached.current.expiresAt > Date.now() + 30_000) {
      setState({ source, url: cached.current.url, loading: false, error: null });
      return;
    }

    if (!active) {
      setState((current) =>
        current.source === source ? current : { source, url: null, loading: false, error: null },
      );
      return;
    }

    const controller = new AbortController();
    setState({ source, url: null, loading: true, error: null });
    void resolveGalleryVideoUrl(source, controller.signal)
      .then((url) => {
        cached.current = { source, url, expiresAt: sourceExpiry(url) };
        setState({ source, url, loading: false, error: null });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          source,
          url: null,
          loading: false,
          error: error instanceof Error ? error.message : "The video link could not be loaded.",
        });
      });

    return () => controller.abort();
  }, [source, active, retryCount]);

  const currentState =
    state.source === source ? state : { source, url: null, loading: false, error: null };

  return {
    ...currentState,
    retry: () => setRetryCount((count) => count + 1),
  };
}
