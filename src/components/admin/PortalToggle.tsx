import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Power } from "lucide-react";

const fetchPortalStatus = async (): Promise<boolean> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("portal_settings")
    .select("student_portal_open")
    .eq("id", "1")
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data?.student_portal_open ?? true;
};

const updatePortalStatus = async (active: boolean): Promise<boolean> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from("portal_settings")
    .update({ student_portal_open: active })
    .eq("id", "1");

  if (error) throw error;
  return active;
};

export const PortalToggle = () => {
  const queryClient = useQueryClient();
  const { data: portalActive = true, isPending, error } = useQuery({
    queryKey: ["admin", "portal-status"],
    queryFn: fetchPortalStatus,
    retry: 1,
  });

  // Handle errors via effect
  useEffect(() => {
    if (error) {
      console.error("Failed to fetch portal status:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      toast.error(`Failed to load portal status: ${message}`);
    }
  }, [error]);

  const mutation = useMutation({
    mutationFn: updatePortalStatus,
    onSuccess: (active) => {
      queryClient.setQueryData(["admin", "portal-status"], active);
      toast.success(
        active 
          ? "SIWES Portal is now OPEN - Students and supervisors can sign up and log in"
          : "SIWES Portal is now CLOSED - All signups and logins are blocked"
      );
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Failed to update portal status";
      toast.error(message);
    },
  });

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Power className="h-5 w-5" />
            SIWES Portal Control
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">
            Error loading portal status. Please check your database connection.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-card h-full flex flex-col">
      <CardHeader className="pb-4 border-b">
        <CardTitle className="flex items-center gap-2 text-xl sm:text-2xl">
          <Power className="h-5 w-5 text-primary" />
          SIWES Portal Control
        </CardTitle>
        <CardDescription className="text-sm mt-2">
          Enable or disable student and supervisor signups and logins
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="space-y-1 flex-1">
            <Label htmlFor="portal-toggle" className="text-base font-semibold">
              Portal Status
            </Label>
            <p className="text-sm text-muted-foreground break-words">
              {isPending ? "Loading..." : portalActive 
                ? "Portal is currently OPEN" 
                : "Portal is currently CLOSED"}
            </p>
          </div>
          <div className="flex-shrink-0">
            <Switch
              id="portal-toggle"
              checked={Boolean(portalActive)}
              onCheckedChange={(checked) => mutation.mutate(checked)}
              disabled={isPending || mutation.isPending}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

