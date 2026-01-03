import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface AuditLog {
  id: string;
  action_type: string;
  table_name: string;
  record_id: string | null;
  created_at: string;
  user_type: string | null;
  user_email: string | null;
  new_value: Record<string, unknown> | null;
  old_value: Record<string, unknown> | null;
}

const fetchAuditLogs = async (): Promise<AuditLog[]> => {
  try {
    // Fetch from audit_logs table - includes admin, supervisor, and student actions
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200); // Increased limit to show more actions
    
    if (error) {
      console.error("Error fetching audit logs:", error);
      // Return empty array instead of throwing
      return [] as AuditLog[];
    }
    
    // Map the data to match the AuditLog interface
    return (data ?? []).map((log) => ({
      id: log.id,
      action_type: log.action_type,
      table_name: log.table_name,
      record_id: log.record_id,
      created_at: log.created_at,
      user_type: (log as unknown as { user_type?: string }).user_type || null,
      user_email: (log as unknown as { user_email?: string }).user_email || null,
      new_value: log.new_value as Record<string, unknown> | null,
      old_value: log.old_value as Record<string, unknown> | null,
    }));
  } catch (err: unknown) {
    console.error("Failed to fetch audit logs:", err);
    return [] as AuditLog[];
  }
};

export const AuditLogPanel = () => {
  const auditQuery = useQuery({
    queryKey: ["admin", "audit"],
    queryFn: fetchAuditLogs,
    refetchInterval: 30_000,
    retry: 1,
  });

  // Handle errors via effect
  useEffect(() => {
    if (auditQuery.error) {
      console.error("AuditLogPanel query error:", auditQuery.error);
    }
  }, [auditQuery.error]);

  return (
    <Card className="shadow-card h-full flex flex-col">
      <CardHeader className="pb-4 border-b flex-shrink-0">
        <CardTitle className="text-xl sm:text-2xl">Audit Trail</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pt-6 overflow-hidden flex flex-col min-h-0">
        <div className="overflow-x-auto overflow-y-auto flex-1 -mx-1 px-1">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="min-w-[100px]">Action</TableHead>
                <TableHead className="min-w-[120px]">Table</TableHead>
                <TableHead className="min-w-[100px]">User Type</TableHead>
                <TableHead className="min-w-[150px]">User Email</TableHead>
                <TableHead className="min-w-[100px]">Record</TableHead>
                <TableHead className="min-w-[150px]">Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(auditQuery.data && auditQuery.data.length > 0) ? (
                auditQuery.data.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge className="whitespace-nowrap">{log.action_type}</Badge>
                    </TableCell>
                    <TableCell className="break-words">{log.table_name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="whitespace-nowrap">
                        {log.user_type || "admin"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm break-all max-w-[150px]">
                      {log.user_email || "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground break-all max-w-[100px]">
                      {log.record_id ?? "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {new Date(log.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    {auditQuery.isPending ? (
                      <div className="flex items-center justify-center">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading audit logs...
                      </div>
                    ) : (
                      "No audit logs found"
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
};


