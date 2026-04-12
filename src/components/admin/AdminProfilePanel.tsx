import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Eye, EyeOff, KeyRound, Loader2, Mail, Shield, ShieldCheck, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const API_BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "" : "http://localhost:3001");

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

type ChangeResponse = {
  success: boolean;
  verificationRequired: boolean;
  requestId?: string;
  newEmail?: string;
  message?: string;
  error?: string;
};

export const AdminProfilePanel = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [verificationRequired, setVerificationRequired] = useState(false);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const adminQuery = useQuery({
    queryKey: ["admin", "current-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;

      const { data, error } = await supabase
        .from("admins")
        .select("id, user_id, full_name, email, is_active, last_active_at, created_at, updated_at")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  const displayEmail = useMemo(() => adminQuery.data?.email || user?.email || "not available", [adminQuery.data?.email, user?.email]);

  useEffect(() => {
    if (user?.email) {
      setNewEmail(user.email === "admin@mtu.edu.ng" ? "" : user.email);
    }
  }, [user?.email]);

  const hasPasswordChange = newPassword.trim().length > 0;
  const hasEmailChange = newEmail.trim().length > 0 && newEmail.trim().toLowerCase() !== (user?.email || "").toLowerCase();
  const requiresRequest = hasEmailChange;

  const fetchAuthHeaders = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new Error("Session expired. Please sign in again.");
    return {
      Authorization: `Bearer ${token}`,
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentPassword) {
      setError("Enter your current password to continue.");
      return;
    }

    if (!hasEmailChange && !hasPasswordChange) {
      setError("Provide a new email or a new password.");
      return;
    }

    if (hasEmailChange && !isValidEmail(newEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    if (hasPasswordChange && newPassword !== confirmNewPassword) {
      setError("New passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const headers = await fetchAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/auth/admin/profile/request-change`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify({
          currentPassword,
          newEmail: hasEmailChange ? newEmail.trim() : undefined,
          newPassword: hasPasswordChange ? newPassword : undefined,
          confirmNewPassword: hasPasswordChange ? confirmNewPassword : undefined,
        }),
      });

      const data = (await response.json()) as ChangeResponse;
      if (!response.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      if (data.verificationRequired) {
        setRequestId(data.requestId || null);
        setPendingEmail(data.newEmail || newEmail.trim());
        setVerificationRequired(true);
        setOtp("");
        toast.success("Verification code sent to your new email.");
      } else {
        toast.success("Password updated successfully. Please sign in again.");
        await supabase.auth.signOut();
        navigate("/admin/login?access=mtu_admin_secure", { replace: true });
      }
    } catch (submitError: unknown) {
      const message = submitError instanceof Error ? submitError.message : "Failed to update profile";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    if (!requestId) {
      setError("No pending verification request found.");
      return;
    }

    if (!otp.trim()) {
      setError("Enter the verification code sent to your new email.");
      return;
    }

    setVerifying(true);
    setError(null);
    try {
      const headers = await fetchAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/api/auth/admin/profile/verify-change`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...headers,
        },
        body: JSON.stringify({
          requestId,
          otp: otp.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Verification failed");
      }

      toast.success("Profile updated successfully. Please sign in again.");
      await supabase.auth.signOut();
      navigate("/admin/login?access=mtu_admin_secure", { replace: true });
    } catch (verifyError: unknown) {
      const message = verifyError instanceof Error ? verifyError.message : "Verification failed";
      setError(message);
      toast.error(message);
    } finally {
      setVerifying(false);
    }
  };

  if (adminQuery.isLoading) {
    return (
      <Card className="shadow-card">
        <CardContent className="py-12 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Card className="border-border/60 shadow-card bg-card/80">
        <CardHeader className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                Admin Profile
              </CardTitle>
              <CardDescription>
                Update your admin email or password. Email changes are verified with a code sent to the new address.
              </CardDescription>
            </div>
            <Badge variant="outline" className="w-fit">
              <ShieldCheck className="h-3.5 w-3.5 mr-1" />
              {profile?.role || "admin"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Current Name</p>
              <p className="mt-1 font-medium">{adminQuery.data?.full_name || profile?.full_name || "Admin"}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Current Email</p>
              <p className="mt-1 font-medium break-all">{displayEmail}</p>
            </div>
          </div>

          <Alert className="border-blue-200 bg-blue-50 text-blue-900">
            <TriangleAlert className="h-4 w-4" />
            <AlertDescription>
              The bootstrap admin email can be changed to a real email address. If you update the email, a code will be sent to the new address and you must verify it before the change is saved.
            </AlertDescription>
          </Alert>

          {error && (
            <Alert variant="destructive">
              <TriangleAlert className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="current-password">Current Password</Label>
              <div className="relative">
                <Input
                  id="current-password"
                  type={showPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter your current password"
                  className="pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Separator />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="new-email">New Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="name@example.com"
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="new-password"
                      type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Leave blank to keep current password"
                    className="pl-9 pr-10"
                  />
                  <button
                    type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">Confirm New Password</Label>
              <Input
                id="confirm-new-password"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Re-enter the new password"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <Button type="submit" disabled={loading} className="w-full sm:w-auto">
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {requiresRequest ? "Sending Code..." : "Updating..."}
                  </>
                ) : requiresRequest ? "Send Verification Code" : "Update Password"}
              </Button>
              <p className="text-sm text-muted-foreground">
                Password updates happen immediately. Email updates require a verification code.
              </p>
            </div>
          </form>

          {verificationRequired && (
            <>
              <Separator />
              <div className="space-y-4 rounded-lg border border-border/60 bg-muted/20 p-4">
                <div>
                  <p className="font-medium flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Verification required
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Enter the code sent to {pendingEmail || newEmail}. The profile update is not complete until you confirm it.
                  </p>
                </div>

                <div className="space-y-2 max-w-sm">
                  <Label htmlFor="admin-profile-otp">Verification Code</Label>
                  <Input
                    id="admin-profile-otp"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="6-digit code"
                    inputMode="numeric"
                    maxLength={6}
                  />
                </div>

                <Button onClick={handleVerify} disabled={verifying || otp.length !== 6}>
                  {verifying ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Verify and Save Changes"
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
