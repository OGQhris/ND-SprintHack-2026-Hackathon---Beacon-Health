/**
 * Window events that open the verification viewer from anywhere in the app without importing it.
 * The viewer is mounted once in the shell and listens for both.
 */
export const VERIFICATION_REPLAY_EVENT = "beacon:verification-replay";
export const VERIFICATION_WATCH_EVENT = "beacon:verification-watch";

export type ReplayDetail = { runId: string };
export type WatchDetail = { employeeId: string };

/** Replays a saved browser recording (a verification history row's recordingId). */
export function openVerificationReplay(runId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ReplayDetail>(VERIFICATION_REPLAY_EVENT, { detail: { runId } }));
}

/** Follows the browser session of a verification that is running on the server for this employee. */
export function watchVerification(employeeId: string): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<WatchDetail>(VERIFICATION_WATCH_EVENT, { detail: { employeeId } }));
}
