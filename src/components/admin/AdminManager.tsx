import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShieldCheck, ShieldOff, UserPlus, Search, Loader2, Activity, Users, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";

type AdminRecord = Database["public"]["Tables"]["admins"]["Row"];

const fetchAdmins = async () => {
  const { data, error } = await supabase
    .from("admins")
    .select("id, user_id, full_name, email, is_active, last_active_at, created_at, updated_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data || []) as AdminRecord[];
};

const defaultForm = {
  full_name: "",
  email: "",
  password: "",
};

const isOnline = (admin: AdminRecord) => {
  if (!admin.is_active || !admin.last_active_at) return false;
  const lastActive = new Date(admin.last_active_at).getTime();
  return Date.now() - lastActive < 5 * 60 * 1000;
};

export const AdminManager = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [formState, setFormState] = useState(defaultForm);

  const adminsQuery = useQuery({
    queryKey: ["admin", "admins"],
    queryFn: fetchAdmins,
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const touchPresence = async () => {
      const now = new Date().toISOString();
      await supabase
        .from("admins")
        .update({ last_active_at: now })
        .eq("user_id", user.id);

      if (!cancelled) {
        queryClient.invalidateQueries({ queryKey: ["admin", "admins"] });
      }
    };

    touchPresence();
    const intervalId = window.setInterval(touchPresence, 45000);

    const handleFocus = () => {
      touchPresence();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [queryClient, user]);

  const createAdminMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-admins", {
        body: {
          action: "create_admin",
          ...formState,
        },
      });

      if (error && !data) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      toast.success("Admin account created. Share credentials securely.");
      setCreateOpen(false);
      setFormState(defaultForm);
      queryClient.invalidateQueries({ queryKey: ["admin", "admins"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "audit"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create admin account");
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (admin: AdminRecord) => {
      const { error } = await supabase.functions.invoke("admin-admins", {
        body: {
          action: "set_admin_status",
          admin_id: admin.id,
          is_active: !admin.is_active,
        },
      });

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "admins"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "audit"] });
    },
    onError: (error: Error) => {
      toast.error(error.message || "Unable to update admin status");
    },
  });

  const filteredAdmins = useMemo(() => {
    const admins = adminsQuery.data || [];
    if (!searchTerm.trim()) return admins;

    const needle = searchTerm.toLowerCase();
    return admins.filter((admin) =>
      [admin.full_name || "", admin.email || "", admin.user_id || ""]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [adminsQuery.data, searchTerm]);

  const totalAdmins = adminsQuery.data?.length || 0;
  const activeAdmins = adminsQuery.data?.filter((admin) => admin.is_active).length || 0;
  const onlineAdmins = adminsQuery.data?.filter((admin) => isOnline(admin)).length || 0;
  const inactiveAdmins = totalAdmins - activeAdmins;

  return (
    <div className="space-y-6">
      <Card className="border-border/60 shadow-card bg-card/80">
        <CardHeader className="space-y-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <CardTitle className="text-2xl">Admin Accounts</CardTitle>
              <CardDescription>
                Create new admins, review active accounts, and track who is online.
              </CardDescription>
            </div>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button className="w-full lg:w-auto">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Create Admin
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-xl">
                <DialogHeader>
                  <DialogTitle>Create Admin Account</DialogTitle>
                  <DialogDescription>
                    Enter the invited admin email and a secure password to create the account.
                  </DialogDescription>
                </DialogHeader>

                <Alert className="border-amber-200 bg-amber-50 text-amber-900">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Keep admin credentials private. Do not share passwords through chats, screenshots, or unsecured notes.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="admin-full-name">Full Name</Label>
                    <Input
                      id="admin-full-name"
                      value={formState.full_name}
                      onChange={(e) => setFormState((prev) => ({ ...prev, full_name: e.target.value }))}
                      placeholder="Admin full name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-email">Email</Label>
                    <Input
                      id="admin-email"
                      type="email"
                      value={formState.email}
                      onChange={(e) => setFormState((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="admin@mtu.edu.ng"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="admin-password">Preferred Password</Label>
                    <Input
                      id="admin-password"
                      type="password"
                      value={formState.password}
                      onChange={(e) => setFormState((prev) => ({ ...prev, password: e.target.value }))}
                      placeholder="Minimum 8 characters"
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>
                      Cancel
                    </Button>
                    <Button
                      type="button"
                      onClick={() => createAdminMutation.mutate()}
                      disabled={createAdminMutation.isPending || !formState.email || !formState.password || !formState.full_name}
                    >
                      {createAdminMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Account"
                      )}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <Card className="border border-border/60">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{totalAdmins}</p>
                </div>
                <Users className="h-8 w-8 text-primary/70" />
              </CardContent>
            </Card>
            <Card className="border border-border/60">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Active</p>
                  <p className="text-2xl font-bold">{activeAdmins}</p>
                </div>
                <ShieldCheck className="h-8 w-8 text-emerald-600" />
              </CardContent>
            </Card>
            <Card className="border border-border/60">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Online</p>
                  <p className="text-2xl font-bold">{onlineAdmins}</p>
                </div>
                <Activity className="h-8 w-8 text-blue-600" />
              </CardContent>
            </Card>
            <Card className="border border-border/60">
              <CardContent className="p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">Inactive</p>
                  <p className="text-2xl font-bold">{inactiveAdmins}</p>
                </div>
                <ShieldOff className="h-8 w-8 text-muted-foreground" />
              </CardContent>
            </Card>
          </div>

          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search admin accounts"
              className="pl-9"
            />
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Presence</TableHead>
                  <TableHead>Last Active</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adminsQuery.isPending ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      Loading admin accounts...
                    </TableCell>
                  </TableRow>
                ) : filteredAdmins.length > 0 ? (
                  filteredAdmins.map((admin) => {
                    const online = isOnline(admin);
                    const lastActive = admin.last_active_at
                      ? formatDistanceToNow(new Date(admin.last_active_at), { addSuffix: true })
                      : "Never";

                    return (
                      <TableRow key={admin.id}>
                        <TableCell>
                          <div className="font-medium">{admin.full_name}</div>
                          <div className="text-xs text-muted-foreground break-all">{admin.user_id}</div>
                        </TableCell>
                        <TableCell className="break-all">{admin.email}</TableCell>
                        <TableCell>
                          <Badge variant={admin.is_active ? "default" : "secondary"}>
                            {admin.is_active ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={online ? "default" : "outline"} className={online ? "bg-emerald-600" : ""}>
                            {online ? "Online" : "Offline"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{lastActive}</TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleStatusMutation.mutate(admin)}
                            disabled={toggleStatusMutation.isPending || admin.user_id === user?.id}
                          >
                            {admin.is_active ? (
                              <>
                                <ShieldOff className="h-4 w-4 mr-2" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <ShieldCheck className="h-4 w-4 mr-2" />
                                Activate
                              </>
                            )}
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No admin accounts found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
