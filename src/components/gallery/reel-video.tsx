import { Maximize, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { useGalleryPageVisible, useGalleryReducedMotion } from "@/hooks/use-gallery-media";

function videoTime(seconds: number) {
  const value = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, "0")}`;
}

export function ReelVideo({
  src,
  caption,
  active,
  muted,
  onMutedChange,
  children,
}: {
  src: string;
  caption: string;
  active: boolean;
  muted: boolean;
  onMutedChange: (muted: boolean) => void;
  children?: ReactNode;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const playbackAllowed = useRef(false);
  const reduced = useGalleryReducedMotion();
  const pageVisible = useGalleryPageVisible();
  const [intent, setIntent] = useState<"auto" | "play" | "pause">("auto");
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const player = video.current;
    if (!player) return;
    playbackAllowed.current =
      active && pageVisible && !failed && intent !== "pause" && (!reduced || intent === "play");
    if (!playbackAllowed.current) {
      player.pause();
      return;
    }
    void player
      .play()
      .then(() => {
        if (!playbackAllowed.current) player.pause();
      })
      .catch(() => {
        // Browsers may require a click before playback; the play control remains available.
      });
    return () => {
      playbackAllowed.current = false;
      player.pause();
    };
  }, [active, pageVisible, reduced, intent, failed]);

  function togglePlayback() {
    const player = video.current;
    if (!player || !active || !pageVisible) return;
    if (player.paused) {
      setIntent("play");
      void player.play().catch(() => setFailed(true));
    } else {
      setIntent("pause");
      player.pause();
    }
  }

  return (
    <div ref={frame} className="gallery-reel-frame">
      <video
        ref={video}
        src={src}
        aria-label={caption || "Grill & Swill video"}
        muted={muted}
        playsInline
        loop
        preload={active ? "metadata" : "none"}
        className="absolute inset-0 h-full w-full object-contain"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onError={() => setFailed(true)}
        onLoadedMetadata={(event) =>
          setDuration(
            Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0,
          )
        }
        onDurationChange={(event) =>
          setDuration(
            Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0,
          )
        }
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
      />
      {failed ? (
        <div
          role="alert"
          className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-charcoal px-12 text-center text-white"
        >
          <p className="text-base font-semibold">This video couldn’t be played.</p>
          <button
            type="button"
            className="gallery-media-button px-4"
            onClick={() => {
              setFailed(false);
              setIntent("play");
              video.current?.load();
            }}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> Try again
          </button>
          <a
            className="inline-flex min-h-11 items-center text-sm underline"
            href={src}
            target="_blank"
            rel="noopener noreferrer"
          >
            Open the original video
          </a>
        </div>
      ) : (
        <button
          type="button"
          data-gallery-play
          aria-label={playing ? "Pause video" : "Play video"}
          onClick={togglePlayback}
          className="absolute inset-0 flex cursor-pointer items-center justify-center focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-white"
        >
          {!playing ? (
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-charcoal/75 text-white">
              <Play className="h-8 w-8 fill-current" aria-hidden="true" />
            </span>
          ) : null}
        </button>
      )}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-charcoal via-charcoal/45 to-transparent"
        aria-hidden="true"
      />
      <div className="absolute left-3 top-3 z-10 flex gap-2">
        <button
          type="button"
          className="gallery-media-button h-11 w-11"
          aria-label={muted ? "Turn sound on" : "Mute video"}
          aria-pressed={!muted}
          onClick={() => onMutedChange(!muted)}
        >
          {muted ? (
            <VolumeX className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Volume2 className="h-5 w-5" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          className="gallery-media-button h-11 w-11"
          aria-label="Expand video"
          onClick={() => {
            if (!frame.current?.requestFullscreen) {
              toast.info("Fullscreen is not available in this browser.");
              return;
            }
            void frame.current
              .requestFullscreen()
              .catch(() => toast.error("The video could not be expanded. Please try again."));
          }}
        >
          <Maximize className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      {children}
      <div className="absolute inset-x-4 bottom-2 z-10 flex items-center gap-2 text-xs tabular-nums text-white">
        <button
          type="button"
          aria-label={playing ? "Pause video" : "Play video"}
          className="gallery-media-button h-11 w-11 shrink-0"
          onClick={togglePlayback}
          disabled={failed}
        >
          {playing ? (
            <Pause className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Play className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
        <span>{videoTime(currentTime)}</span>
        <input
          type="range"
          aria-label="Video progress"
          aria-valuetext={`${videoTime(currentTime)} of ${videoTime(duration)}`}
          min={0}
          max={duration || 1}
          step={0.1}
          value={Math.min(currentTime, duration || 1)}
          disabled={!duration || failed}
          className="gallery-video-progress h-11 min-w-0 flex-1 cursor-pointer accent-white"
          onChange={(event) => {
            const next = Number(event.currentTarget.value);
            if (video.current) video.current.currentTime = next;
            setCurrentTime(next);
          }}
        />
        <span>{videoTime(duration)}</span>
      </div>
    </div>
  );
}
