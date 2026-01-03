import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, UserCog } from "lucide-react";

type SupervisorRecord = Database["public"]["Tables"]["supervisors"]["Row"];
type StudentRecord = Database["public"]["Tables"]["students"]["Row"];

import { apiRequest } from "@/utils/api";

type CombinedSupervisor = SupervisorRecord & {
  _isVirtual?: boolean;
  _students?: StudentRecord[];
  // Virtual entries won't have a hashed password; keep it optional to satisfy the type
  hashed_password?: string | null;
};

// Fetch supervisors - try backend API first, fallback to direct Supabase
const fetchSupervisors = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  // Try backend API first
  if (token) {
    try {
      const response = await apiRequest("/api/admin/supervisors", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const result = await response.json();
        return result.data as SupervisorRecord[];
      }
    } catch {
      // Backend unavailable, fall through to Supabase fallback
    }
  }

  // Fallback: Direct Supabase query
  const { data, error } = await supabase
    .from("supervisors")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return (data || []) as SupervisorRecord[];
};

// Fetch students - try backend API first, fallback to direct Supabase
const fetchStudents = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  // Try backend API first
  if (token) {
    try {
      const response = await apiRequest("/api/admin/students", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const result = await response.json();
        return result.data as StudentRecord[];
      }
    } catch {
      // Backend unavailable, fall through to Supabase fallback
    }
  }

  // Fallback: Direct Supabase query
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as StudentRecord[];
};

const defaultSupervisorForm = {
  name: "",
  email: "",
  password: "",
  phone: "",
  supervisor_type: "industry_supervisor" as "industry_supervisor" | "school_supervisor",
};

interface SupervisorManagerProps {
  compact?: boolean;
}

export const SupervisorManager = ({ compact = false }: SupervisorManagerProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [activeType, setActiveType] = useState<"industry_supervisor" | "school_supervisor">("industry_supervisor");
  const [selectedSupervisor, setSelectedSupervisor] = useState<SupervisorRecord | null>(null);
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [formState, setFormState] = useState(defaultSupervisorForm);

  const supervisorsQuery = useQuery({
    queryKey: ["admin", "supervisors"],
    queryFn: fetchSupervisors,
  });

  const studentsQuery = useQuery({
    queryKey: ["admin", "students-basic"],
    queryFn: fetchStudents,
  });

  const createSupervisorMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.functions.invoke("admin-supervisors", {
        body: {
          action: "create_supervisor",
          ...formState,
        },
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast({ title: "Supervisor created" });
      setCreateOpen(false);
      setFormState(defaultSupervisorForm);
      queryClient.invalidateQueries({ queryKey: ["admin", "supervisors"] });
    },
    onError: (error: Error) =>
      toast({ title: "Failed to create supervisor", description: error.message, variant: "destructive" }),
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (supervisor: SupervisorRecord) => {
      const { error } = await supabase.functions.invoke("admin-supervisors", {
        body: {
          action: "set_supervisor_status",
          supervisor_id: supervisor.id,
          is_active: !supervisor.is_active,
        },
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "supervisors"] }),
    onError: (error: Error) =>
      toast({ title: "Unable to update status", description: error.message, variant: "destructive" }),
  });

  const resetPassword = async (supervisor: SupervisorRecord) => {
    const newPassword = prompt("Enter new password for supervisor");
    if (!newPassword) return;
    if (newPassword.length < 8) {
      toast({ title: "Password too short", variant: "destructive" });
      return;
    }

    const { error } = await supabase.functions.invoke("admin-auth-sync", {
      body: {
        action: "reset_password",
        target_user_id: supervisor.user_id,
        target_role: supervisor.supervisor_type,
        new_password: newPassword,
      },
    });

    if (error) {
      toast({ title: "Reset failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password reset" });
    }
  };

  const deleteSupervisor = async (supervisor: SupervisorRecord) => {
    if (!confirm(`Delete supervisor ${supervisor.name}?`)) return;
    const { error } = await supabase.functions.invoke("admin-supervisors", {
      body: {
        action: "delete_supervisor",
        supervisor_id: supervisor.id,
        user_id: supervisor.user_id,
      },
    });
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Supervisor deleted" });
      queryClient.invalidateQueries({ queryKey: ["admin", "supervisors"] });
    }
  };

  const assignStudents = async () => {
    if (!selectedSupervisor) return;
    const { error } = await supabase.functions.invoke("admin-supervisors", {
      body: {
        action: "assign_students",
        supervisor_id: selectedSupervisor.id,
        supervisor_type: selectedSupervisor.supervisor_type,
        student_ids: selectedStudents,
      },
    });
    if (error) {
      toast({ title: "Assignment failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Students assigned" });
      setAssignOpen(false);
      setSelectedStudents([]);
      setSelectedSupervisor(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
    }
  };

  const filteredSupervisors = useMemo(
    () =>
      ((supervisorsQuery.data || []) as CombinedSupervisor[]).filter(
        (sup) => sup.supervisor_type === activeType,
      ),
    [supervisorsQuery.data, activeType],
  );

  // Create virtual industry supervisors from students' pre-registration form data
  const industrySupervisorsFromStudents = useMemo<CombinedSupervisor[]>(() => {
    const students = studentsQuery.data || [];
    const existingSupervisors = supervisorsQuery.data || [];
    
    // Group students by industry supervisor name/email to get unique supervisors
    const supervisorMap = new Map<string, {
      name: string;
      email: string | null;
      phone: string | null;
      students: typeof students;
    }>();

    students.forEach((student) => {
      if (student.industry_supervisor_name) {
        const key = student.industry_supervisor_name.toLowerCase().trim();
        
        // Check if this supervisor already exists in the supervisors table
        const existsInTable = existingSupervisors.some(
          (sup) => 
            sup.supervisor_type === "industry_supervisor" &&
            (sup.name?.toLowerCase().trim() === key || 
             sup.email?.toLowerCase() === student.industry_supervisor_email?.toLowerCase())
        );

        if (!existsInTable) {
          if (!supervisorMap.has(key)) {
            supervisorMap.set(key, {
              name: student.industry_supervisor_name,
              email: student.industry_supervisor_email || null,
              phone: student.industry_supervisor_phone || null,
              students: [],
            });
          }
          supervisorMap.get(key)?.students.push(student);
        }
      }
    });

    // Convert to array of "virtual" supervisor records
    return Array.from(supervisorMap.values()).map((sup, index) => ({
      id: `virtual-${index}-${sup.name.toLowerCase().replace(/\s+/g, '-')}`,
      user_id: null,
      name: sup.name,
      email: sup.email,
      phone: sup.phone,
      supervisor_type: "industry_supervisor" as const,
      is_active: true,
      created_at: new Date().toISOString(),
      hashed_password: null,
      _isVirtual: true, // Flag to identify virtual records
      _students: sup.students, // Attached students
    }));
  }, [studentsQuery.data, supervisorsQuery.data]);

  // Combine real supervisors with virtual ones for industry tab
  const combinedIndustrySupervisors = useMemo<CombinedSupervisor[]>(() => {
    if (activeType !== "industry_supervisor") return filteredSupervisors;
    return [...filteredSupervisors, ...industrySupervisorsFromStudents];
  }, [activeType, filteredSupervisors, industrySupervisorsFromStudents]);

  const studentPool = useMemo(() => studentsQuery.data || [], [studentsQuery.data]);

  if (compact) {
    return (
      <div className="h-full flex flex-col">
        <Tabs value={activeType} onValueChange={(value) => setActiveType(value as "industry_supervisor" | "school_supervisor")} className="flex-1 flex flex-col min-h-0">
          <TabsList className="mb-4 flex-shrink-0">
            <TabsTrigger value="industry_supervisor">Industry</TabsTrigger>
            <TabsTrigger value="school_supervisor">School</TabsTrigger>
          </TabsList>
          <TabsContent value="industry_supervisor" className="flex-1 flex flex-col min-h-0 mt-0">
            <SupervisorTable
              supervisors={combinedIndustrySupervisors}
              students={studentPool}
              loading={supervisorsQuery.isLoading}
              onResetPassword={resetPassword}
              onToggleStatus={(sup) => toggleStatusMutation.mutate(sup)}
              onDelete={deleteSupervisor}
              onAssign={(sup) => {
                const assigned = studentPool
                  .filter((student) =>
                    student.industry_supervisor_id === sup.id
                  )
                  .map((student) => student.id);
                setSelectedStudents(assigned);
                setSelectedSupervisor(sup);
                setAssignOpen(true);
              }}
              compact={compact}
              isIndustry={true}
            />
          </TabsContent>
          <TabsContent value="school_supervisor" className="flex-1 flex flex-col min-h-0 mt-0">
            <SupervisorTable
              supervisors={filteredSupervisors}
              students={studentPool}
              loading={supervisorsQuery.isLoading}
              onResetPassword={resetPassword}
              onToggleStatus={(sup) => toggleStatusMutation.mutate(sup)}
              onDelete={deleteSupervisor}
              onAssign={(sup) => {
                const assigned = studentPool
                  .filter((student) =>
                    student.supervisor_id === sup.id
                  )
                  .map((student) => student.id);
                setSelectedStudents(assigned);
                setSelectedSupervisor(sup);
                setAssignOpen(true);
              }}
              compact={compact}
              isIndustry={false}
            />
          </TabsContent>
        </Tabs>
      </div>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-4 border-b">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-xl sm:text-2xl">Supervisors</CardTitle>
            {!compact && (
              <p className="text-sm text-muted-foreground mt-1">
                Create, manage, and assign supervisors.
              </p>
            )}
          </div>
          {!compact && (
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto whitespace-nowrap">
                  <UserCog className="h-4 w-4 mr-2" />
                  Add Supervisor
                </Button>
              </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Supervisor</DialogTitle>
              <DialogDescription>Grant access to a new supervisor.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Name</Label>
                <Input
                  value={formState.name}
                  onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div>
                <Label>Email</Label>
                <Input
                  type="email"
                  value={formState.email}
                  onChange={(e) => setFormState((prev) => ({ ...prev, email: e.target.value }))}
                />
              </div>
              <div>
                <Label>Password</Label>
                <Input
                  type="password"
                  value={formState.password}
                  onChange={(e) => setFormState((prev) => ({ ...prev, password: e.target.value }))}
                />
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={formState.phone}
                  onChange={(e) => setFormState((prev) => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div>
                <Label>Type</Label>
                <select
                  aria-label="Select supervisor type"
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
                  value={formState.supervisor_type}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      supervisor_type: e.target.value as "industry_supervisor" | "school_supervisor",
                    }))
                  }
                >
                  <option value="industry_supervisor">Industry Supervisor</option>
                  <option value="school_supervisor">School Supervisor</option>
                </select>
              </div>
              <Button onClick={() => createSupervisorMutation.mutate()} disabled={createSupervisorMutation.isPending}>
                {createSupervisorMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create Supervisor
              </Button>
            </div>
            </DialogContent>
          </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        <Tabs value={activeType} onValueChange={(value) => setActiveType(value as "industry_supervisor" | "school_supervisor")}>
          <TabsList className="mb-4">
            <TabsTrigger value="industry_supervisor">Industry Supervisors</TabsTrigger>
            <TabsTrigger value="school_supervisor">School Supervisors</TabsTrigger>
          </TabsList>
          <TabsContent value="industry_supervisor" className="mt-0">
            <SupervisorTable
              supervisors={combinedIndustrySupervisors}
              students={studentPool}
              loading={supervisorsQuery.isLoading}
              onResetPassword={resetPassword}
              onToggleStatus={(sup) => toggleStatusMutation.mutate(sup)}
              onDelete={deleteSupervisor}
              onAssign={(sup) => {
                const assigned = studentPool
                  .filter((student) =>
                    student.industry_supervisor_id === sup.id
                  )
                  .map((student) => student.id);
                setSelectedStudents(assigned);
                setSelectedSupervisor(sup);
                setAssignOpen(true);
              }}
              compact={compact}
              isIndustry={true}
            />
          </TabsContent>
          <TabsContent value="school_supervisor" className="mt-0">
            <SupervisorTable
              supervisors={filteredSupervisors}
              students={studentPool}
              loading={supervisorsQuery.isLoading}
              onResetPassword={resetPassword}
              onToggleStatus={(sup) => toggleStatusMutation.mutate(sup)}
              onDelete={deleteSupervisor}
              onAssign={(sup) => {
                const assigned = studentPool
                  .filter((student) =>
                    student.supervisor_id === sup.id
                  )
                  .map((student) => student.id);
                setSelectedStudents(assigned);
                setSelectedSupervisor(sup);
                setAssignOpen(true);
              }}
              compact={compact}
              isIndustry={false}
            />
          </TabsContent>
        </Tabs>
      </CardContent>

      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Assign Students</DialogTitle>
            <DialogDescription>
              Select students that should report to {selectedSupervisor?.name}.
            </DialogDescription>
          </DialogHeader>
          {selectedSupervisor && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {studentPool.map((student) => (
                    <label
                      key={student.id}
                      className="flex items-center gap-2 rounded-md border border-border p-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={selectedStudents.includes(student.id)}
                        onChange={(e) => {
                          setSelectedStudents((prev) => {
                            if (e.target.checked) {
                              return Array.from(new Set([...prev, student.id]));
                            }
                            return prev.filter((id) => id !== student.id);
                          });
                        }}
                      />
                      <span>
                        {student.full_name ?? "Unnamed"}{" "}
                        <span className="text-xs text-muted-foreground">
                          ({student.matric_no})
                        </span>
                      </span>
                    </label>
                ))}
              </div>
              <Button onClick={assignStudents}>Save Assignments</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

interface SupervisorTableProps {
  supervisors: CombinedSupervisor[];
  students: StudentRecord[];
  loading: boolean;
  onResetPassword: (sup: SupervisorRecord) => void;
  onToggleStatus: (sup: SupervisorRecord) => void;
  onDelete: (sup: SupervisorRecord) => void;
  onAssign: (sup: SupervisorRecord) => void;
  compact?: boolean;
  isIndustry?: boolean;
}

const SupervisorTable = ({
  supervisors,
  students,
  loading,
  onResetPassword,
  onToggleStatus,
  onDelete,
  onAssign,
  compact = false,
  isIndustry = false,
}: SupervisorTableProps) => {
  // Get students assigned to each supervisor (industry supervisors from pre-reg form)
  const getAssignedStudents = (supervisor: SupervisorRecord & { _isVirtual?: boolean; _students?: StudentRecord[] }) => {
    // If virtual supervisor, use attached students
    if (supervisor._isVirtual && supervisor._students) {
      return supervisor._students;
    }
    
    if (isIndustry) {
      // For industry supervisors - match by name OR id
      return students.filter(s => 
        s.industry_supervisor_id === supervisor.id || 
        (s.industry_supervisor_name && s.industry_supervisor_name.toLowerCase() === supervisor.name?.toLowerCase())
      );
    }
    // For school supervisors - match by supervisor_id
    return students.filter(s => s.supervisor_id === supervisor.id);
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader className="bg-background">
          <TableRow>
            <TableHead className="min-w-[120px]">Name</TableHead>
            <TableHead className="min-w-[150px]">Email</TableHead>
            <TableHead className="min-w-[100px]">Phone</TableHead>
            {isIndustry && <TableHead className="min-w-[150px]">Assigned Students</TableHead>}
            <TableHead className="min-w-[80px]">Status</TableHead>
            {!compact && <TableHead className="text-right min-w-[180px]">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {supervisors.length > 0 ? (
            supervisors.map((sup) => {
              const assignedStudents = getAssignedStudents(sup);
              const isVirtual = (sup as { _isVirtual?: boolean })._isVirtual;
              return (
                <TableRow key={sup.id} className={isVirtual ? "bg-blue-50/50" : ""}>
                  <TableCell className="font-medium break-words max-w-[120px]">
                    <div className="flex items-center gap-2">
                      {sup.name}
                      {isVirtual && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 bg-blue-100 text-blue-700 border-blue-300">
                          Form
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="break-all max-w-[150px] text-sm">{sup.email || "—"}</TableCell>
                  <TableCell className="break-words text-sm">{sup.phone ?? "—"}</TableCell>
                  {isIndustry && (
                    <TableCell className="max-w-[150px]">
                      {assignedStudents.length > 0 ? (
                        <div className="space-y-0.5">
                          {assignedStudents.slice(0, 3).map(student => (
                            <div key={student.id} className="text-xs">
                              <span className="font-medium">{student.full_name || "Unnamed"}</span>
                              <span className="text-muted-foreground ml-1">({student.matric_no})</span>
                            </div>
                          ))}
                          {assignedStudents.length > 3 && (
                            <div className="text-xs text-muted-foreground">+{assignedStudents.length - 3} more</div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">No students</span>
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge variant={sup.is_active ? "default" : "secondary"} className="whitespace-nowrap text-xs">
                      {sup.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  {!compact && (
                    <TableCell className="text-right">
                      {isVirtual ? (
                        <span className="text-xs text-muted-foreground italic">From pre-registration</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 justify-end">
                          <Button variant="outline" size="sm" onClick={() => onAssign(sup)} className="text-xs">
                            Assign
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => onResetPassword(sup)} className="text-xs">
                            Reset
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => onToggleStatus(sup)} className="text-xs">
                            {sup.is_active ? "Off" : "On"}
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => onDelete(sup)} className="text-xs">
                            Delete
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })
          ) : (
            <TableRow>
              <TableCell colSpan={isIndustry ? (compact ? 5 : 6) : (compact ? 4 : 5)} className="text-center py-8 text-muted-foreground">
                {loading ? (
                  <div className="flex items-center justify-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading supervisors...
                  </div>
                ) : (
                  "No supervisors found"
                )}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
};

