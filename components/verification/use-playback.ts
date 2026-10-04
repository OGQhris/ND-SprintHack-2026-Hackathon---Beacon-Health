"use client";

import { useCallback, useEffect, useState } from "react";

const ADVANCE_MS = 750;

/**
 * Step playback for one run: the current step index, play/pause, and auto-advance every 0.75 s while
 * playing. Mount it keyed by run id so a new run starts from the first step.
 */
export function usePlayback(count: number, open: boolean) {
  const [rawIndex, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const last = Math.max(count - 1, 0);
  const index = Math.min(rawIndex, last);

  useEffect(() => {
    if (!open || !playing || index >= last) return;
    const id = setTimeout(() => setIndex((i) => Math.min(i + 1, last)), ADVANCE_MS);
    return () => clearTimeout(id);
  }, [open, playing, index, last]);

  const seek = useCallback((next: number) => {
    setIndex(next);
    setPlaying(false);
  }, []);

  const restart = useCallback(() => {
    setIndex(0);
    setPlaying(true);
  }, []);

  /** Play/pause; at the end of a finished run it starts over. */
  const toggle = useCallback(
    (atEnd: boolean) => {
      if (atEnd) setIndex(0);
      setPlaying((p) => !p || atEnd);
    },
    [],
  );

  return { index, playing, count, seek, restart, toggle };
}
