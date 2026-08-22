import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * Keeps screening state fresh while a list or profile is open. Screening data
 * is only readable through server functions, so this polls the server instead
 * of subscribing the browser to database change broadcasts.
 */
export function useApplicationsRealtime(intervalMs = 5000) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      queryClient.invalidateQueries({ queryKey: ["applications"] });
      queryClient.invalidateQueries({ queryKey: ["application"] });
      queryClient.invalidateQueries({ queryKey: ["candidates"] });
      queryClient.invalidateQueries({ queryKey: ["my-applications"] });
    };
    const id = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(id);
  }, [queryClient, intervalMs]);
}
