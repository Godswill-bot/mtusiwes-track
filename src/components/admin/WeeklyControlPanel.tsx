import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2 } from "lucide-react";

type WeekRecord = Database["public"]["Tables"]["weeks"]["Row"] & {
  student?: {
    full_name: string | null;
    matric_no: string;
  } | null;
};

const fetchWeeks = async () => {
  const { data, error } = await supabase
    .from("weeks")
    .select("*, student:students(full_name, matric_no)")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data as WeekRecord[];
};

export const WeeklyControlPanel = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingWeek, setEditingWeek] = useState<WeekRecord | null>(null);
  const [editData, setEditData] = useState<Partial<WeekRecord>>({});
  const [statusNote, setStatusNote] = useState("");

  const weeksQuery = useQuery({
    queryKey: ["admin", "weeks"],
    queryFn: fetchWeeks,
  });

  const updateWeekMutation = useMutation({
    mutationFn: async () => {
      if (!editingWeek) return;
      const updates = {
        monday_activity: editData.monday_activity ?? editingWeek.monday_activity,
        tuesday_activity: editData.tuesday_activity ?? editingWeek.tuesday_activity,
        wednesday_activity: editData.wednesday_activity ?? editingWeek.wednesday_activity,
        thursday_activity: editData.thursday_activity ?? editingWeek.thursday_activity,
        friday_activity: editData.friday_activity ?? editingWeek.friday_activity,
        saturday_activity: editData.saturday_activity ?? editingWeek.saturday_activity,
        comments: editData.comments ?? editingWeek.comments,
      };
      const { error } = await supabase.functions.invoke("admin-weekly", {
        body: {
          action: "update_week",
          week_id: editingWeek.id,
          updates,
        },
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast({ title: "Week updated" });
      setEditingWeek(null);
      setEditData({});
      queryClient.invalidateQueries({ queryKey: ["admin", "weeks"] });
    },
    onError: (error: Error) =>
      toast({ title: "Update failed", description: error.message, variant: "destructive" }),
  });

  const changeStatus = async (week: WeekRecord, status: WeekRecord["status"]) => {
    const { error } = await supabase.functions.invoke("admin-weekly", {
      body: {
        action: "set_week_status",
        week_id: week.id,
        status,
        rejection_reason: status === "rejected" ? statusNote : null,
        school_supervisor_comments: status === "approved" ? statusNote : null,
        forwarded_to_school: status === "submitted" ? true : undefined,
      },
    });
    if (error) {
      toast({ title: "Unable to update status", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Status updated" });
      setStatusNote("");
      queryClient.invalidateQueries({ queryKey: ["admin", "weeks"] });
    }
  };

  const deleteWeek = async (week: WeekRecord) => {
    if (!confirm("Delete this weekly report?")) return;
    const { error } = await supabase.functions.invoke("admin-weekly", {
      body: {
        action: "delete_week",
        week_id: week.id,
      },
    });
    if (error) {
      toast({ title: "Deletion failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Week deleted" });
      queryClient.invalidateQueries({ queryKey: ["admin", "weeks"] });
    }
  };

  return (
    <Card className="shadow-card h-full flex flex-col">
      <CardHeader className="pb-4 border-b flex-shrink-0">
        <CardTitle className="text-xl sm:text-2xl">Weekly Reports</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 pt-6 overflow-hidden flex flex-col min-h-0">
        <div className="overflow-x-auto overflow-y-auto flex-1 -mx-1 px-1">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="min-w-[120px]">Student</TableHead>
                <TableHead className="min-w-[80px]">Week</TableHead>
                <TableHead className="min-w-[100px]">Status</TableHead>
                <TableHead className="min-w-[150px]">Comments</TableHead>
                <TableHead className="text-right min-w-[200px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(weeksQuery.data && weeksQuery.data.length > 0) ? (
                weeksQuery.data.map((week) => (
                  <TableRow key={week.id}>
                    <TableCell className="max-w-[120px]">
                      <div className="font-medium break-words">{week.student?.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground break-words">{week.student?.matric_no}</div>
                    </TableCell>
                    <TableCell>Week {week.week_number}</TableCell>
                    <TableCell>
                      <Badge className="capitalize whitespace-nowrap">{week.status}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[150px]">
                      <div className="break-words text-sm">{week.comments || "—"}</div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap gap-1 justify-end">
                        <Button variant="outline" size="sm" onClick={() => {
                          setEditingWeek(week);
                          setEditData(week);
                        }} className="text-xs">
                          Edit
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => changeStatus(week, "approved")} className="text-xs">
                          Approve
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => changeStatus(week, "submitted")} className="text-xs">
                          Forward
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => changeStatus(week, "rejected")} className="text-xs">
                          Reject
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => deleteWeek(week)} className="text-xs">
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    {weeksQuery.isPending ? (
                      <div className="flex items-center justify-center">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading weekly reports...
                      </div>
                    ) : (
                      "No weekly reports found"
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={!!editingWeek} onOpenChange={(open) => {
        if (!open) {
          setEditingWeek(null);
          setEditData({});
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Weekly Report</DialogTitle>
            <DialogDescription>Override any field for this submission.</DialogDescription>
          </DialogHeader>
          {editingWeek && (
            <div className="space-y-4">
              {["monday", "tuesday", "wednesday", "thursday", "friday", "saturday"].map((day) => (
                <div key={day}>
                  <Label className="capitalize">{day}</Label>
                  <Textarea
                    value={(editData[`${day}_activity` as keyof WeekRecord] as string) ?? ""}
                    onChange={(e) =>
                      setEditData((prev) => ({
                        ...prev,
                        [`${day}_activity`]: e.target.value,
                      }))
                    }
                  />
                </div>
              ))}
              <div>
                <Label>Comments</Label>
                <Textarea
                  value={editData.comments ?? ""}
                  onChange={(e) =>
                    setEditData((prev) => ({ ...prev, comments: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Approval / Rejection Note</Label>
                <Textarea
                  value={statusNote}
                  onChange={(e) => setStatusNote(e.target.value)}
                  placeholder="Optional note for approval or rejection"
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={() => updateWeekMutation.mutate()} disabled={updateWeekMutation.isPending}>
                  {updateWeekMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
                <Button variant="outline" onClick={() => changeStatus(editingWeek, "approved")}>
                  Approve
                </Button>
                <Button variant="outline" onClick={() => changeStatus(editingWeek, "rejected")}>
                  Reject
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};


