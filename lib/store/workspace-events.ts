/**
 * Lets any client code ask the credential store to re-fetch the server snapshot right away
 * (after a verification, a demo-clock change, or an assistant tool that changed data)
 * without importing the store itself. The store listens for this event on window.
 */
export const WORKSPACE_REFRESH_EVENT = "beacon:workspace-refresh";

export function requestWorkspaceRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(WORKSPACE_REFRESH_EVENT));
}
