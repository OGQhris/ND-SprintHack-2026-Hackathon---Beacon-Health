"use client";

import { useEffect, useState } from "react";
import { Spinner } from "@/components/ui/spinner";

type Frame = { src: string; label: string };

/**
 * Keeps the last decoded screenshot on screen until its replacement has fully decoded, so stepping
 * through frames never flashes the white stage underneath. A frame that fails to load is skipped.
 */
export function ViewerFrame({ src, label }: Frame) {
  const [ready, setReady] = useState<Frame | null>(null);

  useEffect(() => {
    let cancelled = false;
    const frame = new Image();
    frame.src = src;
    void frame
      .decode()
      .then(() => {
        if (!cancelled) setReady({ src, label });
      })
      .catch(() => {
        // Retain the previous screenshot if this one cannot be decoded.
      });
    return () => {
      cancelled = true;
    };
  }, [src, label]);

  if (!ready) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-xs text-ink-faint">
        <Spinner className="size-5 text-seal" aria-hidden />
        <span>Loading browser screenshot</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- per-run screenshots streamed from the API and swapped every second; next/image would add an optimization round-trip to each frame
    <img src={ready.src} alt={ready.label} className="pointer-events-none absolute inset-0 size-full object-contain" />
  );
}
