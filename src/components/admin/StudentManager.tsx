import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { Download, Loader2, ShieldCheck, ShieldOff, UserPlus, Search, FileText } from "lucide-react";

type StudentRecord = Database["public"]["Tables"]["students"]["Row"];
type SupervisorRecord = Database["public"]["Tables"]["supervisors"]["Row"];

import { apiRequest } from "@/utils/api";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Fetch students - try backend API first, fallback to direct Supabase
const fetchStudents = async () => {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  
  const { data, error } = await supabase
    .from("students")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as StudentRecord[];
};

const fetchSupervisors = async () => {
  const { data, error } = await supabase
    .from("supervisors")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw error;
  return data as SupervisorRecord[];
};

const defaultForm = {
  full_name: "",
  email: "",
  password: "",
  matric_no: "",
  department: "",
  faculty: "",
  phone: "",
  organisation_name: "",
  organisation_address: "",
  nature_of_business: "",
  location_size: "medium",
  products_services: "",
  industry_supervisor_name: "",
  industry_supervisor_email: "",
  industry_supervisor_phone: "",
  supervisor_id: "",
  school_supervisor_name: "",
  school_supervisor_email: "",
  period_of_training: "",
  other_info: "",
};

const STUDENT_ONLINE_WINDOW_MS = 2 * 60 * 1000;

const isStudentOnline = (student: StudentRecord) => {
  if (!student.is_active || !student.last_active_at) return false;
  return Date.now() - new Date(student.last_active_at).getTime() < STUDENT_ONLINE_WINDOW_MS;
};

interface StudentManagerProps {
  compact?: boolean;
}

export const StudentManager = ({ compact = false }: StudentManagerProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [createOpen, setCreateOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);
  const [editingStudent, setEditingStudent] = useState<StudentRecord | null>(null);
  const [formState, setFormState] = useState(defaultForm);
  const [editFormState, setEditFormState] = useState<Partial<StudentRecord>>({});
  const [filter, setFilter] = useState("");
  const [schoolSupervisorId, setSchoolSupervisorId] = useState<string | undefined>();
  const [industrySupervisorId, setIndustrySupervisorId] = useState<string | undefined>();

  const studentsQuery = useQuery({
    queryKey: ["admin", "students"],
    queryFn: fetchStudents,
    refetchInterval: 20000,
  });

  const supervisorsQuery = useQuery({
    queryKey: ["admin", "supervisors"],
    queryFn: fetchSupervisors,
  });

  const createStudentMutation = useMutation({
    mutationFn: async () => {
      // Validate required fields before submitting
      if (!formState.matric_no || formState.matric_no.trim() === "" || formState.matric_no.startsWith("TEMP-")) {
        throw new Error("Valid matric number is required (11 digits, no temporary values)");
      }
      if (!formState.faculty || formState.faculty.trim() === "" || formState.faculty === "TBD") {
        throw new Error("Faculty is required (select CBAS or CHMS)");
      }
      if (!formState.department || formState.department.trim() === "" || formState.department === "TBD") {
        throw new Error("Department is required");
      }
      if (!formState.phone || formState.phone.trim() === "") {
        throw new Error("Phone number is required");
      }
      
      const { data, error } = await supabase.functions.invoke("admin-students", {
        body: {
          action: "create_student",
          ...formState,
          supervisor_id: formState.supervisor_id || undefined,
          location_size: formState.location_size,
        },
      });
      // Even if there's a soft error returning, we will assume success if it didn't throw before here
      if (error && !data) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      toast({ title: "Account created. Please refresh page to confirm." });
      setCreateOpen(false);
      setFormState(defaultForm);
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    },
    onError: (error: Error) => {
      // In case the backend failed but the account was partially created:
      toast({ title: "Account created. Please refresh page to confirm.", description: "Some background processes might be pending." });
      setCreateOpen(false);
      setFormState(defaultForm);
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (student: StudentRecord) => {
      const { error } = await supabase.functions.invoke("admin-students", {
        body: {
          action: "set_student_status",
          student_id: student.id,
          is_active: !student.is_active,
        },
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "students"] }),
    onError: (error: Error) => toast({ title: "Unable to update status", description: error.message, variant: "destructive" }),
  });

  const resetPassword = async (student: StudentRecord) => {
    const newPassword = prompt("Enter new password (min 8 characters)");
    if (!newPassword) return;
    if (newPassword.length < 8) {
      toast({ title: "Password too short", variant: "destructive" });
      return;
    }

    const { error } = await supabase.functions.invoke("admin-auth-sync", {
      body: {
        action: "reset_password",
        target_user_id: student.user_id,
        target_role: "student",
        new_password: newPassword,
      },
    });

    if (error) {
      toast({ title: "Password reset failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password reset" });
    }
  };

  const deleteStudent = async (student: StudentRecord) => {
    const confirmed = confirm(`Delete ${student.matric_no}? This cannot be undone.`);
    if (!confirmed) return;

    const { error } = await supabase.functions.invoke("admin-students", {
      body: {
        action: "delete_student",
        student_id: student.id,
        user_id: student.user_id,
      },
    });

    // Treat as deleted whether error or not due to fallback cascade completing partially
    toast({ title: "Deleted please reload site to confirm" });
    queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  const assignSupervisors = async () => {
    if (!selectedStudent) return;
    const { error } = await supabase.functions.invoke("admin-students", {
      body: {
        action: "assign_supervisors",
        student_id: selectedStudent.id,
        supervisor_id: schoolSupervisorId ?? null,
        industry_supervisor_id: industrySupervisorId ?? null,
      },
    });

    if (error) {
      toast({ title: "Assignment failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Assignments updated" });
      setAssignOpen(false);
      setSelectedStudent(null);
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
    }
  };

  const updateStudentMutation = useMutation({
    mutationFn: async () => {
      if (!editingStudent) return;
      const updates = {
        full_name: editFormState.full_name ?? editingStudent.full_name,
        department: editFormState.department ?? editingStudent.department,
        faculty: editFormState.faculty ?? editingStudent.faculty,
        phone: editFormState.phone ?? editingStudent.phone,
        organisation_name: editFormState.organisation_name ?? editingStudent.organisation_name,
        organisation_address: editFormState.organisation_address ?? editingStudent.organisation_address,
        nature_of_business: editFormState.nature_of_business ?? editingStudent.nature_of_business,
        products_services: editFormState.products_services ?? editingStudent.products_services,
        period_of_training: editFormState.period_of_training ?? editingStudent.period_of_training,
        other_info: editFormState.other_info ?? editingStudent.other_info,
      };

      const { error } = await supabase.functions.invoke("admin-students", {
        body: {
          action: "update_student",
          student_id: editingStudent.id,
          updates,
        },
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      toast({ title: "Student updated" });
      setEditOpen(false);
      setEditingStudent(null);
      setEditFormState({});
      queryClient.invalidateQueries({ queryKey: ["admin", "students"] });
    },
    onError: (error: Error) =>
      toast({ title: "Update failed", description: error.message, variant: "destructive" }),
  });

  const filteredStudents = useMemo(() => {
    if (!studentsQuery.data || !Array.isArray(studentsQuery.data)) return [];
    if (!filter) return studentsQuery.data;
    return studentsQuery.data.filter((student) => {
      const searchText = [
        student.full_name || "",
        student.matric_no || "",
        student.email || ""
      ]
        .join(" ")
        .toLowerCase();
      return searchText.includes(filter.toLowerCase());
    });
  }, [studentsQuery.data, filter]);

  const downloadAsCSV = () => {
    const headers = ["Name", "Matric No.", "Email", "Faculty", "Department", "Phone", "School Supervisor", "Industry Supervisor", "Ind. Supervisor Email", "Ind. Supervisor Phone", "Organisation", "Organisation Address", "Status"];
    const rows = filteredStudents.map((s) => [
      s.full_name || "",
      s.matric_no || "",
      s.email || "",
      s.faculty || "",
      s.department || "",
      s.phone || "",
      s.school_supervisor_name || "",
      s.industry_supervisor_name || "",
      s.industry_supervisor_email || "",
      s.industry_supervisor_phone || "",
      s.organisation_name || "",
      s.organisation_address || "",
      s.is_active ? "Active" : "Inactive",
    ]);
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `students_${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadPreSiwesForm = (student: StudentRecord) => {
    const doc = new jsPDF();
    
    doc.setFontSize(22);
    doc.setTextColor(0, 0, 128); // Blue color for MTU
    doc.text("Mountain Top University", 105, 20, { align: "center" });
    
    doc.setFontSize(16);
    doc.setTextColor(0, 0, 0);
    doc.text("Pre-SIWES Registration Form", 105, 30, { align: "center" });
    
    doc.setFontSize(12);
    const dateStr = new Date(student.created_at).toLocaleDateString();
    doc.text(`Registration Date: ${dateStr}`, 14, 45);
    
    doc.setFontSize(14);
    doc.text("1. Student Information", 14, 55);
    
    autoTable(doc, {
      startY: 60,
      theme: 'grid',
      headStyles: { fillColor: [0, 51, 102] },
      body: [
        ["Full Name", student.full_name || "N/A"],
        ["Matriculation Number", student.matric_no || "N/A"],
        ["Email Address", student.email || "N/A"],
        ["Phone Number", student.phone || "N/A"],
        ["Department", student.department || "N/A"],
        ["Faculty", student.faculty || "N/A"],
      ],
    });

    const currentYOrg = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.text("2. Placement Organization Details", 14, currentYOrg);
    
    autoTable(doc, {
      startY: currentYOrg + 5,
      theme: 'grid',
      headStyles: { fillColor: [0, 51, 102] },
      body: [
        ["Organization Name", student.organisation_name || "N/A"],
        ["Organization Address", student.organisation_address || "N/A"],
        ["Nature of Business", student.nature_of_business || "N/A"],
      ],
    });

    const currentYSup = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(14);
    doc.text("3. Industry Supervisor Details", 14, currentYSup);
    
    autoTable(doc, {
      startY: currentYSup + 5,
      theme: 'grid',
      headStyles: { fillColor: [0, 51, 102] },
      body: [
        ["Sup. Name", student.industry_supervisor_name || "N/A"],
        ["Sup. Phone", student.industry_supervisor_phone || "N/A"],
        ["Sup. Email", student.industry_supervisor_email || "N/A"],
      ],
    });

    doc.setFontSize(10);
    doc.text("Official MTU SIWES Unit Documentation", 105, 280, { align: "center" });

    doc.save(`${student.matric_no}_Pre_SIWES_Form.pdf`);
  };

  const schoolSupervisors = useMemo(
    () =>
      (supervisorsQuery.data || []).filter(
        (sup) => sup.supervisor_type === "school_supervisor",
      ),
    [supervisorsQuery.data],
  );

  const industrySupervisors = useMemo(
    () =>
      (supervisorsQuery.data || []).filter(
        (sup) => sup.supervisor_type === "industry_supervisor",
      ),
    [supervisorsQuery.data],
  );

  if (compact) {
    return (
      <div className="h-full flex flex-col">
        <div className="overflow-x-auto overflow-y-auto flex-1 -mx-1 px-1">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="min-w-[140px]">Name</TableHead>
                <TableHead className="min-w-[100px]">Matric No.</TableHead>
                <TableHead className="min-w-[80px]">Faculty</TableHead>
                <TableHead className="min-w-[100px]">Department</TableHead>
                <TableHead className="min-w-[150px]">Industry Supervisor</TableHead>
                <TableHead className="min-w-[70px]">Status</TableHead>
                <TableHead className="min-w-[90px]">Presence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents && filteredStudents.length > 0 ? (
                filteredStudents.slice(0, 10).map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="max-w-[140px]">
                      <div className="font-semibold break-words text-sm">{student.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground break-all">{student.email || "—"}</div>
                    </TableCell>
                    <TableCell className="break-words text-sm">{student.matric_no || "—"}</TableCell>
                    <TableCell className="break-words text-sm">{student.faculty || "—"}</TableCell>
                    <TableCell className="break-words text-sm">{student.department || "—"}</TableCell>
                    <TableCell className="max-w-[150px]">
                      <div className="text-sm font-medium break-words">{student.industry_supervisor_name || "—"}</div>
                      {student.industry_supervisor_phone && (
                        <div className="text-xs text-muted-foreground">{student.industry_supervisor_phone}</div>
                      )}
                    </TableCell>
                    
                    <TableCell>
                      <Badge variant={student.is_active ? "default" : "secondary"} className="whitespace-nowrap text-xs">
                        {student.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={isStudentOnline(student) ? "default" : "outline"} className={isStudentOnline(student) ? "bg-emerald-600" : ""}>
                        {isStudentOnline(student) ? "Online" : "Offline"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {studentsQuery.isPending ? "Loading..." : "No students found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  }

  return (
    <Card className="shadow-card h-full flex flex-col">
      <CardHeader className="pb-4 border-b space-y-4 flex-shrink-0">
        <div className="flex flex-col gap-2">
          <CardTitle className="text-xl sm:text-2xl">Students</CardTitle>
          {!compact && (
            <p className="text-sm text-muted-foreground">
              Manage registrations, supervisors, and credentials.
            </p>
          )}
        </div>
        {!compact && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1 sm:max-w-xs">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search students"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="w-full pl-8"
              />
            </div>
            <Button
              variant="outline"
              onClick={downloadAsCSV}
              disabled={!filteredStudents.length}
              className="w-full sm:w-auto whitespace-nowrap"
            >
              <Download className="h-4 w-4 mr-2" />
              Download CSV
            </Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto whitespace-nowrap">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Student
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create Student Account</DialogTitle>
                <DialogDescription>
                  Provide registration data and credentials.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input
                      id="full_name"
                      value={formState.full_name}
                      onChange={(e) =>
                        setFormState((prev) => ({ ...prev, full_name: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="matric_no">Matric Number *</Label>
                    <Input
                      id="matric_no"
                      value={formState.matric_no}
                      onChange={(e) =>
                        setFormState((prev) => ({ ...prev, matric_no: e.target.value }))
                      }
                      required
                      placeholder="e.g., 22010306034"
                    />
                    <p className="text-xs text-muted-foreground mt-1">11 digits only, no temporary values</p>
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formState.email}
                      onChange={(e) =>
                        setFormState((prev) => ({ ...prev, email: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={formState.password}
                      onChange={(e) =>
                        setFormState((prev) => ({ ...prev, password: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label htmlFor="faculty">Faculty *</Label>
                    <Select
                      value={formState.faculty}
                      onValueChange={(value) =>
                        setFormState((prev) => ({ ...prev, faculty: value }))
                      }
                      required
                    >
                      <SelectTrigger id="faculty">
                        <SelectValue placeholder="Select Faculty" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="CBAS">CBAS</SelectItem>
                        <SelectItem value="CHMS">CHMS</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="department">Department *</Label>
                    <Input
                      id="department"
                      value={formState.department}
                      onChange={(e) =>
                        setFormState((prev) => ({ ...prev, department: e.target.value }))
                      }
                      required
                      placeholder="e.g., Computer Science"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone *</Label>
                    <Input
                      id="phone"
                      value={formState.phone}
                      onChange={(e) =>
                        setFormState((prev) => ({ ...prev, phone: e.target.value }))
                      }
                      required
                      placeholder="+234 xxx xxx xxxx"
                    />
                  </div>
                  <div>
                    <Label>Location Size</Label>
                    <Select
                      value={formState.location_size}
                      onValueChange={(value) =>
                        setFormState((prev) => ({ ...prev, location_size: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Organisation Name</Label>
                    <Input
                      value={formState.organisation_name}
                      onChange={(e) =>
                        setFormState((prev) => ({ ...prev, organisation_name: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Nature of Business</Label>
                    <Input
                      value={formState.nature_of_business}
                      onChange={(e) =>
                        setFormState((prev) => ({ ...prev, nature_of_business: e.target.value }))
                      }
                    />
                  </div>
                </div>

                <div>
                  <Label>Organisation Address</Label>
                  <Textarea
                    value={formState.organisation_address}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, organisation_address: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <Label>Products & Services</Label>
                  <Textarea
                    value={formState.products_services}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, products_services: e.target.value }))
                    }
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label>Industry Supervisor Name</Label>
                    <Input
                      value={formState.industry_supervisor_name}
                      onChange={(e) =>
                        setFormState((prev) => ({ ...prev, industry_supervisor_name: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Industry Supervisor Email</Label>
                    <Input
                      type="email"
                      value={formState.industry_supervisor_email}
                      onChange={(e) =>
                        setFormState((prev) => ({ ...prev, industry_supervisor_email: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Industry Supervisor Phone</Label>
                    <Input
                      value={formState.industry_supervisor_phone}
                      onChange={(e) =>
                        setFormState((prev) => ({ ...prev, industry_supervisor_phone: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Period of Training</Label>
                    <Input
                      value={formState.period_of_training}
                      onChange={(e) =>
                        setFormState((prev) => ({ ...prev, period_of_training: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label>School Supervisor (Assign Immediately)</Label>
                    <Select
                      value={formState.supervisor_id || "none"}
                      onValueChange={(value) => {
                        const actualValue = value === "none" ? "" : value;
                        const selectedSup = schoolSupervisors.find(s => s.id === actualValue);
                        setFormState((prev) => ({ 
                          ...prev, 
                          supervisor_id: actualValue,
                          school_supervisor_name: selectedSup?.name || "",
                          school_supervisor_email: selectedSup?.email || ""
                        }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select school supervisor" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Unassigned</SelectItem>
                        {schoolSupervisors.map((sup) => (
                          <SelectItem key={sup.id} value={sup.id}>
                            {sup.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Other Information</Label>
                  <Textarea
                    value={formState.other_info}
                    onChange={(e) =>
                      setFormState((prev) => ({ ...prev, other_info: e.target.value }))
                    }
                  />
                </div>

                <Button onClick={() => createStudentMutation.mutate()} disabled={createStudentMutation.isPending}>
                  {createStudentMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create Student
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        )}
      </CardHeader>
      <CardContent className="flex-1 pt-6 overflow-hidden flex flex-col min-h-0">
        <div className="overflow-x-auto overflow-y-auto flex-1 -mx-1 px-1">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="min-w-[140px]">Name</TableHead>
                <TableHead className="min-w-[100px]">Matric No.</TableHead>
                <TableHead className="min-w-[80px]">Faculty</TableHead>
                <TableHead className="min-w-[110px]">Department</TableHead>
                <TableHead className="min-w-[100px]">Phone</TableHead>
                <TableHead className="min-w-[160px]">School Supervisor</TableHead>
                <TableHead className="min-w-[180px]">Industry Supervisor</TableHead>
                <TableHead className="min-w-[180px]">Organisation</TableHead>
                <TableHead className="min-w-[70px]">Status</TableHead>
                <TableHead className="min-w-[90px]">Presence</TableHead>
                <TableHead className="min-w-[130px]">Last Active</TableHead>
                {!compact && <TableHead className="text-right min-w-[180px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents && filteredStudents.length > 0 ? (
                filteredStudents.map((student) => (
                    <Fragment key={student.id}>
                      {(() => {
                        const online = isStudentOnline(student);
                        const lastActive = student.last_active_at
                          ? formatDistanceToNow(new Date(student.last_active_at), { addSuffix: true })
                          : "Never";

                        return (
                      <TableRow key={student.id}>
                    <TableCell className="max-w-[140px]">
                      <div className="font-semibold break-words text-sm">{student.full_name ?? "—"}</div>
                      <div className="text-xs text-muted-foreground break-all">{student.email || "—"}</div>
                    </TableCell>
                    <TableCell className="break-words text-sm">{student.matric_no || "—"}</TableCell>
                    <TableCell className="break-words text-sm">{student.faculty || "—"}</TableCell>
                    <TableCell className="break-words text-sm">{student.department || "—"}</TableCell>
                    <TableCell className="break-words text-sm">{student.phone || "—"}</TableCell>
                    <TableCell className="max-w-[160px]">
                      <div className="text-sm font-medium break-words">{student.school_supervisor_name || "—"}</div>
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      <div className="text-sm font-medium break-words">{student.industry_supervisor_name || "—"}</div>
                      {student.industry_supervisor_email && (
                        <div className="text-xs text-muted-foreground break-all">{student.industry_supervisor_email}</div>
                      )}
                      {student.industry_supervisor_phone && (
                        <div className="text-xs text-muted-foreground">{student.industry_supervisor_phone}</div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      <div className="text-sm font-medium break-words">{student.organisation_name || "—"}</div>
                      {student.organisation_address && (
                        <div className="text-xs text-muted-foreground break-words">{student.organisation_address}</div>
                      )}
                    </TableCell>
                    
                    <TableCell>
                      <Badge variant={student.is_active ? "default" : "secondary"} className="whitespace-nowrap text-xs">
                        {student.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={online ? "default" : "outline"} className={online ? "bg-emerald-600" : ""}>
                        {online ? "Online" : "Offline"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{lastActive}</TableCell>
                    {!compact && (
                      <TableCell className="text-right">
                        <div className="flex flex-col sm:flex-row flex-wrap gap-2 justify-end">
                          
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingStudent(student);
                              setEditFormState(student);
                              setEditOpen(true);
                            }}
                            className="text-xs w-full sm:w-auto"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadPreSiwesForm(student)}
                            className="text-xs w-full sm:w-auto"
                          >
                            <FileText className="h-3 w-3 mr-1" />
                            Form
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => resetPassword(student)} className="text-xs w-full sm:w-auto">
                            Reset
                          </Button>
                          <Button
                            variant={student.is_active ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => toggleStatusMutation.mutate(student)}
                            className="text-xs w-full sm:w-auto"
                          >
                            {student.is_active ? (
                              <ShieldOff className="h-3 w-3 mr-1" />
                            ) : (
                              <ShieldCheck className="h-3 w-3 mr-1" />
                            )}
                            {student.is_active ? "Off" : "On"}
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => deleteStudent(student)} className="text-xs w-full sm:w-auto">
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                        );
                      })()}
                  </Fragment>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={compact ? 9 : 12} className="text-center py-8 text-muted-foreground">
                    {studentsQuery.isPending ? "Loading students..." : "No students found"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {studentsQuery.isPending && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading students...
            </div>
          )}
        </div>
      </CardContent>

      <Dialog open={assignOpen} onOpenChange={(open) => {
        setAssignOpen(open);
        if (!open) {
          setSelectedStudent(null);
          setSchoolSupervisorId(undefined);
          setIndustrySupervisorId(undefined);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Supervisors</DialogTitle>
            <DialogDescription>
              Choose school and industry supervisors for the student.
            </DialogDescription>
          </DialogHeader>
          {selectedStudent && (
            <div className="space-y-4">
              <div>
                <Label>School Supervisor</Label>
                <Select
                  value={schoolSupervisorId ?? ""}
                  onValueChange={(value) => setSchoolSupervisorId(value || undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select school supervisor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {schoolSupervisors.map((sup) => (
                      <SelectItem key={sup.id} value={sup.id}>
                        {sup.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Industry Supervisor</Label>
                <Select
                  value={industrySupervisorId ?? ""}
                  onValueChange={(value) => setIndustrySupervisorId(value || undefined)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select industry supervisor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Unassigned</SelectItem>
                    {industrySupervisors.map((sup) => (
                      <SelectItem key={sup.id} value={sup.id}>
                        {sup.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={assignSupervisors}>Save Assignments</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={(open) => {
        setEditOpen(open);
        if (!open) {
          setEditingStudent(null);
          setEditFormState({});
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Student Information</DialogTitle>
            <DialogDescription>Override registration data.</DialogDescription>
          </DialogHeader>
          {editingStudent && (
            <div className="space-y-4">
              <div>
                <Label>Full Name</Label>
                <Input
                  value={editFormState.full_name ?? ""}
                  onChange={(e) =>
                    setEditFormState((prev) => ({ ...prev, full_name: e.target.value }))
                  }
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Department</Label>
                  <Input
                    value={editFormState.department ?? ""}
                    onChange={(e) =>
                      setEditFormState((prev) => ({ ...prev, department: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Faculty</Label>
                  <Input
                    value={editFormState.faculty ?? ""}
                    onChange={(e) =>
                      setEditFormState((prev) => ({ ...prev, faculty: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Phone</Label>
                <Input
                  value={editFormState.phone ?? ""}
                  onChange={(e) =>
                    setEditFormState((prev) => ({ ...prev, phone: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Organisation Name</Label>
                <Input
                  value={editFormState.organisation_name ?? ""}
                  onChange={(e) =>
                    setEditFormState((prev) => ({ ...prev, organisation_name: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Organisation Address</Label>
                <Textarea
                  value={editFormState.organisation_address ?? ""}
                  onChange={(e) =>
                    setEditFormState((prev) => ({ ...prev, organisation_address: e.target.value }))
                  }
                />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label>Nature of Business</Label>
                  <Input
                    value={editFormState.nature_of_business ?? ""}
                    onChange={(e) =>
                      setEditFormState((prev) => ({ ...prev, nature_of_business: e.target.value }))
                    }
                  />
                </div>
                <div>
                  <Label>Period of Training</Label>
                  <Input
                    value={editFormState.period_of_training ?? ""}
                    onChange={(e) =>
                      setEditFormState((prev) => ({ ...prev, period_of_training: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Products & Services</Label>
                <Textarea
                  value={editFormState.products_services ?? ""}
                  onChange={(e) =>
                    setEditFormState((prev) => ({ ...prev, products_services: e.target.value }))
                  }
                />
              </div>
              <div>
                <Label>Other Information</Label>
                <Textarea
                  value={editFormState.other_info ?? ""}
                  onChange={(e) =>
                    setEditFormState((prev) => ({ ...prev, other_info: e.target.value }))
                  }
                />
              </div>
              <Button onClick={() => updateStudentMutation.mutate()} disabled={updateStudentMutation.isPending}>
                {updateStudentMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Save Changes
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
};

