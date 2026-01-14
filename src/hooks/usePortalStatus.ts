import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Cache key for portal status
const PORTAL_STATUS_KEY = ["portal-status"];

export const usePortalStatus = () => {
  const queryClient = useQueryClient();

  const { data: portalOpen, isLoading: loading } = useQuery({
    queryKey: PORTAL_STATUS_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portal_settings" as never)
        .select("student_portal_open")
        .eq("id", "1")
        .single();

      if (error) {
        console.error("Error checking portal status:", error);
        return false; // Default to closed if there's an error
      }
      return (data as { student_portal_open?: boolean })?.student_portal_open ?? false;
    },
    staleTime: 1000 * 60 * 10, // 10 minutes - portal status rarely changes
    gcTime: 1000 * 60 * 60, // 1 hour cache
  });

  // Set up realtime subscription for portal status changes
  useEffect(() => {
    const channel = supabase
      .channel("portal_settings_changes")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "portal_settings",
        },
        (payload) => {
          const newData = payload.new as { student_portal_open: boolean };
          // Update the React Query cache instead of local state
          queryClient.setQueryData(PORTAL_STATUS_KEY, newData.student_portal_open);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return { portalOpen: portalOpen ?? null, loading };
};
















