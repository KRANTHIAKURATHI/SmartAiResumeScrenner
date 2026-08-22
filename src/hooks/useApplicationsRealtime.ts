import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Keeps screening state live while the recruiter watches a list or profile. */
export function useApplicationsRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("applications-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "applications" }, () => {
        queryClient.invalidateQueries({ queryKey: ["applications"] });
        queryClient.invalidateQueries({ queryKey: ["application"] });
        queryClient.invalidateQueries({ queryKey: ["candidates"] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
