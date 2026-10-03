"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import {
  Check,
  Circle,
  Globe,
  LoaderCircle,
  MousePointer2,
  Pause,
  Play,
  RotateCcw,
  ScanLine,
  ShieldCheck,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import type { VerificationRun } from "@/lib/verification-view";
export function replayVerification(id: string) {
  window.dispatchEvent(new CustomEvent("verification-replay", { detail: id }));
}
// Keep the last decoded screenshot on screen until its replacement is ready.
// A single opaque image avoids crossfades exposing the white stage underneath.
function VerificationFrame({ src, label }: { src: string; label: string }) {
  const [ready, setReady] = useState<{ src: string; label: string } | null>(
    null,
  );
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
        /* Retain the previous screenshot if the next frame fails. */
      });
    return () => {
      cancelled = true;
    };
  }, [src, label]);
  return ready ? (
    <img src={ready.src} alt={ready.label} className="viewer-frame" />
  ) : (
    <div className="viewer-wait">
      <LoaderCircle size={24} className="spin" />
      <span>Loading browser screenshot…</span>
    </div>
  );
}
export function VerificationViewer() {
  const [run, setRun] = useState<VerificationRun | null>(null);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [replay, setReplay] = useState(false);
  const [error, setError] = useState("");
  const seen = useRef(new Set<string>());
  const selected = useRef<string | null>(null);
  const requestVersion = useRef(0);
  useEffect(() => {
    let cancelled = false;
    async function load(id: string, isReplay: boolean) {
      const version = ++requestVersion.current;
      selected.current = id;
      setError("");
      try {
        const response = await fetch(`/api/verification-runs/${id}`, {
          cache: "no-store",
        });
        if (!response.ok)
          throw new Error("This recording could not be loaded.");
        const next = await response.json();
        if (cancelled || version !== requestVersion.current) return;
        setRun(next);
        setIndex(0);
        setPlaying(true);
        setReplay(isReplay);
        setOpen(true);
      } catch (e) {
        if (!cancelled)
          setError(e instanceof Error ? e.message : "Recording unavailable.");
      }
    }
    const onReplay = (event: Event) => {
      void load((event as CustomEvent<string>).detail, true);
    };
    window.addEventListener("verification-replay", onReplay);
    let busy = false;
    async function poll() {
      if (busy) return;
      busy = true;
      try {
        const response = await fetch("/api/verification-runs", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const data = (await response.json()) as { runs: VerificationRun[] };
        const unseen = data.runs.find(
          (r) => r.origin !== "batch" && !seen.current.has(r.id),
        );
        for (const r of data.runs) seen.current.add(r.id);
        if (
          unseen &&
          (!selected.current ||
            !data.runs.some((r) => r.id === selected.current))
        )
          await load(unseen.id, false);
        if (selected.current) {
          const currentId = selected.current;
          const updated = await fetch(`/api/verification-runs/${currentId}`, {
            cache: "no-store",
          });
          if (updated.ok && !cancelled && selected.current === currentId)
            setRun(await updated.json());
        }
      } catch {
        /* Keep the last frame visible through temporary network failures. */
      } finally {
        busy = false;
      }
    }
    void poll();
    const timer = setInterval(poll, 900);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("verification-replay", onReplay);
    };
  }, []);
  const stepCount = run?.steps.length ?? 0;
  useEffect(() => {
    if (!open || !playing || index >= stepCount - 1) return;
    const timer = setTimeout(() => setIndex((i) => i + 1), 1200);
    return () => clearTimeout(timer);
  }, [open, playing, stepCount, index]);
  const step = run?.steps[index];
  const finished = !!run?.finishedAt;
  const atEnd = finished && index >= (run?.steps.length ?? 0) - 1;
  const success = run?.state === "VERIFIED";
  return (
    <>
      {error && (
        <div className="verification-launcher" role="alert">
          {error}
          <button onClick={() => setError("")}>Dismiss</button>
        </div>
      )}
      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) {
            ++requestVersion.current;
          }
        }}
      >
        <DialogContent className="verification-viewer">
          <header className="viewer-heading">
            <span className="viewer-symbol">
              <ScanLine size={22} />
            </span>
            <div>
              <span className="eyebrow">BROWSER VERIFICATION</span>
              <DialogTitle>
                {run?.employeeName || "Credential check"}
              </DialogTitle>
              <DialogDescription>
                Watch the state licensing lookup, step by step.
              </DialogDescription>
            </div>
            <span
              className={`viewer-mode ${finished || replay ? "" : "is-live"}`}
            >
              {!finished && !replay && <span className="viewer-live-dot" />}
              {replay ? "REPLAY" : finished ? "RECORDED" : "LIVE"}
            </span>
          </header>
          <div className="viewer-body">
            <div className="viewer-stage">
              <div className="viewer-browser-bar">
                <div className="browser-dots">
                  <i />
                  <i />
                  <i />
                </div>
                <span>
                  <Globe size={12} /> aca-prod.accela.com / MILARA
                </span>
                <ShieldCheck size={14} />
              </div>
              <div className="viewer-screen">
                {!step && (
                  <div className="viewer-wait">
                    <div className="viewer-orbit">
                      <Globe size={30} />
                    </div>
                    <strong>Connecting to Michigan MILARA</strong>
                    <span>Preparing the secure browser session…</span>
                  </div>
                )}
                {step?.frameUrl && (
                  <VerificationFrame
                    key={run?.id}
                    src={step.frameUrl}
                    label={step.label}
                  />
                )}
                {step?.target && (
                  <div
                    className="viewer-target"
                    style={{
                      left: `${step.target.x * 100}%`,
                      top: `${step.target.y * 100}%`,
                      width: `${Math.max(step.target.width * 100, 2)}%`,
                      height: `${Math.max(step.target.height * 100, 2)}%`,
                    }}
                  />
                )}
                <div
                  className={`viewer-cursor ${step?.target ? "visible" : ""}`}
                  style={{
                    left: `${(step?.target?.x ?? 0.5) * 100}%`,
                    top: `${(step?.target?.y ?? 0.5) * 100}%`,
                  }}
                >
                  <MousePointer2
                    size={27}
                    fill="#1c493e"
                    stroke="white"
                    strokeWidth={1.5}
                  />
                  {step?.kind === "click" && (
                    <span key={step.index} className="viewer-click" />
                  )}
                </div>
                {step && (
                  <div className="viewer-caption" key={step.index}>
                    {step.kind === "click" ? (
                      <MousePointer2 size={15} />
                    ) : (
                      <ScanLine size={15} />
                    )}
                    <span>{step.label}</span>
                  </div>
                )}
              </div>
              <div className="viewer-controls">
                <button
                  aria-label={
                    playing && !atEnd ? "Pause playback" : "Play playback"
                  }
                  onClick={() => {
                    if (atEnd) setIndex(0);
                    setPlaying(!playing || atEnd);
                  }}
                >
                  {playing && !atEnd ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <button
                  aria-label="Replay from beginning"
                  onClick={() => {
                    setIndex(0);
                    setPlaying(true);
                    setReplay(true);
                  }}
                >
                  <RotateCcw size={15} />
                </button>
                <input
                  aria-label="Verification timeline"
                  type="range"
                  min={0}
                  max={Math.max(0, (run?.steps.length ?? 1) - 1)}
                  value={index}
                  onChange={(e) => {
                    setIndex(Number(e.target.value));
                    setPlaying(false);
                  }}
                />
                <span>
                  {run?.steps.length ? index + 1 : 0} / {run?.steps.length ?? 0}
                </span>
              </div>
            </div>
            <aside className="viewer-timeline">
              <div className="viewer-timeline-title">
                <span>ACTIVITY</span>
                <span>{run?.steps.length ?? 0} steps</span>
              </div>
              <div className="viewer-step-list">
                {run?.steps.map((s, i) => (
                  <button
                    key={s.index}
                    className={`viewer-step ${i === index ? "current" : ""} ${i < index ? "done" : ""}`}
                    onClick={() => {
                      setIndex(i);
                      setPlaying(false);
                    }}
                  >
                    <span className="viewer-step-icon">
                      {i < index ? (
                        <Check size={13} />
                      ) : i === index && !finished ? (
                        <LoaderCircle size={13} className="spin" />
                      ) : (
                        <Circle size={11} />
                      )}
                    </span>
                    <span>
                      {s.label}
                      <small>
                        {new Date(s.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                        })}
                      </small>
                    </span>
                  </button>
                ))}
              </div>
              {finished && (
                <div
                  className={`viewer-result ${success ? "success" : "review"}`}
                >
                  <span>
                    {success ? (
                      <ShieldCheck size={21} />
                    ) : (
                      <AlertCircle size={21} />
                    )}
                    <strong>{run?.state.replaceAll("_", " ")}</strong>
                  </span>
                  {run?.result ? (
                    <dl>
                      <div>
                        <dt>License</dt>
                        <dd>{run.result.licenseNumber}</dd>
                      </div>
                      <div>
                        <dt>Status</dt>
                        <dd>{run.result.status}</dd>
                      </div>
                      <div>
                        <dt>Expires</dt>
                        <dd>{run.result.expirationDate}</dd>
                      </div>
                    </dl>
                  ) : (
                    <p>
                      {run?.error ||
                        "No unique matching RN license was confirmed. Review the audit for details."}
                    </p>
                  )}
                  <small>Saved to verification history</small>
                </div>
              )}
              {!finished && (
                <div className="viewer-running">
                  <LoaderCircle size={14} className="spin" /> Browser is
                  checking the state source
                </div>
              )}
            </aside>
          </div>
          <footer className="viewer-footer">
            <span>
              <span className="viewer-evidence-dot" /> Actual browser
              screenshots · Cursor highlights recorded targets
            </span>
            <span>Checks continue when you close this window</span>
          </footer>
        </DialogContent>
      </Dialog>
    </>
  );
}
