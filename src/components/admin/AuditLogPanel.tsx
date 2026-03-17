import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Eye, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

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
    const { data, error } = await supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    
    if (error) {
      console.error("Error fetching audit logs:", error);
      return [];
    }
    
    return (data ?? []).map((log) => ({
      id: log.id,
      action_type: log.action_type,
      table_name: log.table_name,
      record_id: log.record_id,
      created_at: log.created_at,
      user_type: (log as any).user_type || null,
      user_email: (log as any).user_email || null,
      new_value: log.new_value as Record<string, unknown> | null,
      old_value: log.old_value as Record<string, unknown> | null,
    }));
  } catch (err) {
    console.error("Failed to fetch audit logs:", err);
    return [];
  }
};

const renderRecord = (record: Record<string, unknown> | null, otherRecord: Record<string, unknown> | null = null) => {
  if (!record) return <span className="text-muted-foreground italic px-2">None</span>;
  return (
    <div className="space-y-2 bg-slate-50/50 p-3 rounded-lg border">
      {Object.entries(record).map(([key, value]) => {
        // Highlighting logic: if it's different from the other record
        const isDifferent = otherRecord && JSON.stringify(otherRecord[key]) !== JSON.stringify(value);
        return (
          <div key={key} className={`grid grid-cols-[1fr_2fr] gap-3 py-1.5 border-b border-gray-100 last:border-0 ${isDifferent ? 'bg-indigo-50/40 -mx-1 px-1 rounded' : ''}`}>
            <div className="text-xs font-medium text-gray-500 capitalize">
              {key.replace(/_/g, ' ')}
            </div>
            <div className={`text-xs break-words font-mono ${isDifferent ? 'text-indigo-700 font-semibold' : 'text-gray-800'}`}>
              {value === null ? (
                <span className="text-gray-400 italic">null</span>
              ) : typeof value === 'boolean' ? (
                value ? 'true' : 'false'
              ) : (
                String(value)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export const AuditLogPanel = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const auditQuery = useQuery({
    queryKey: ["admin", "audit"],
    queryFn: fetchAuditLogs,
    refetchInterval: 30000,
    retry: 1,
  });

  useEffect(() => {
    if (auditQuery.error) {
      console.error("AuditLogPanel query error:", auditQuery.error);
    }
  }, [auditQuery.error]);

  const filteredLogs = useMemo(() => {
    const logs = auditQuery.data || [];
    if (!searchTerm.trim()) return logs;
    const needle = searchTerm.toLowerCase();
    return logs.filter((log) =>
      [
        log.action_type,
        log.table_name,
        log.user_type || "",
        log.user_email || "",
        log.record_id || "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [auditQuery.data, searchTerm]);

  return (
    <Card className="shadow-card h-full flex flex-col">
      <CardHeader className="pb-4 border-b flex-shrink-0">
        <CardTitle className="text-xl sm:text-2xl mb-3">Audit Trail</CardTitle>
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search audit logs"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8"
          />
        </div>
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
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs && filteredLogs.length > 0 ? (
                filteredLogs.map((log) => (
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
                    <TableCell>
                      {log.old_value || log.new_value ? (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                            <DialogHeader>
                              <DialogTitle>Audit Record Details</DialogTitle>
                            </DialogHeader>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                              <div>
                                <h4 className="font-semibold mb-2 text-sm">Previous Values</h4>
                                {renderRecord(log.old_value, log.new_value)}
                              </div>
                              <div>
                                <h4 className="font-semibold mb-2 text-sm">New Values</h4>
                                {renderRecord(log.new_value, log.old_value)}
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
