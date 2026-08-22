import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Keeps screening state fresh while a run is actually in flight. Screening data
 * is only readable through server functions, so this polls the server instead
 * of subscribing the browser to database change broadcasts.
 *
 * Pass `enabled: false` (the default is "only while work is pending") to stop
 * the polling once every application has settled — a fully screened list does
 * not change on its own, and constant refetching made every screen feel slow.
 */
export function useApplicationsRealtime(enabled = true, intervalMs = 4000) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      // Only refetch what is currently mounted; inactive caches can wait.
      for (const key of [["applications"], ["application"], ["candidates"], ["my-applications"]]) {
        void queryClient.refetchQueries({ queryKey: key, type: "active" });
      }
    };
    const id = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(id);
  }, [queryClient, enabled, intervalMs]);
}

/** True while at least one application still has screening work outstanding. */
export function hasPendingWork(apps: { status: string }[] | undefined) {
  return !!apps?.some((a) => a.status === "uploaded" || a.status === "processing");
}
