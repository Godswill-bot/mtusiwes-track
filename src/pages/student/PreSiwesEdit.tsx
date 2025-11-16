import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PreSiwesEdit = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    matric_no: "",
    department: "",
    faculty: "",
    email: "",
    phone: "",
    organisation_name: "",
    organisation_address: "",
    nature_of_business: "",
    products_services: "",
    location_size: "medium" as "small" | "medium" | "large",
    industry_supervisor_name: "",
    industry_supervisor_email: "",
    industry_supervisor_phone: "",
    school_supervisor_name: "",
    period_of_training: "",
    other_info: "",
  });

  useEffect(() => {
    if (user) {
      fetchStudentData();
    }
  }, [user]);

  const fetchStudentData = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("students")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          matric_no: data.matric_no,
          department: data.department,
          faculty: data.faculty,
          email: data.email,
          phone: data.phone,
          organisation_name: data.organisation_name,
          organisation_address: data.organisation_address,
          nature_of_business: data.nature_of_business,
          products_services: data.products_services,
          location_size: data.location_size,
          industry_supervisor_name: data.industry_supervisor_name,
          industry_supervisor_email: data.industry_supervisor_email || "",
          industry_supervisor_phone: data.industry_supervisor_phone || "",
          school_supervisor_name: data.school_supervisor_name || "",
          period_of_training: data.period_of_training,
          other_info: data.other_info || "",
        });
      }
    } catch (error: any) {
      toast.error("Error loading data");
      console.error(error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("students")
        .update(formData)
        .eq("user_id", user.id);

      if (error) throw error;

      toast.success("Information updated successfully");
      navigate("/student/dashboard");
    } catch (error: any) {
      toast.error("Error updating information");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <Card>
            <CardHeader>
              <CardTitle>Edit Pre-SIWES Information</CardTitle>
              <CardDescription>Update your registration details</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="matric_no">Matric Number</Label>
                    <Input
                      id="matric_no"
                      value={formData.matric_no}
                      onChange={(e) => setFormData({ ...formData, matric_no: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="department">Department</Label>
                    <Input
                      id="department"
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="faculty">Faculty</Label>
                    <Input
                      id="faculty"
                      value={formData.faculty}
                      onChange={(e) => setFormData({ ...formData, faculty: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold">Organisation Details</h3>
                  <div>
                    <Label htmlFor="organisation_name">Organisation Name</Label>
                    <Input
                      id="organisation_name"
                      value={formData.organisation_name}
                      onChange={(e) => setFormData({ ...formData, organisation_name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="organisation_address">Organisation Address</Label>
                    <Textarea
                      id="organisation_address"
                      value={formData.organisation_address}
                      onChange={(e) => setFormData({ ...formData, organisation_address: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="nature_of_business">Nature of Business</Label>
                      <Input
                        id="nature_of_business"
                        value={formData.nature_of_business}
                        onChange={(e) => setFormData({ ...formData, nature_of_business: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="location_size">Location Size</Label>
                      <Select
                        value={formData.location_size}
                        onValueChange={(value: "small" | "medium" | "large") =>
                          setFormData({ ...formData, location_size: value })
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
                  <div>
                    <Label htmlFor="products_services">Products/Services</Label>
                    <Textarea
                      id="products_services"
                      value={formData.products_services}
                      onChange={(e) => setFormData({ ...formData, products_services: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold">Supervisor Details</h3>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="industry_supervisor_name">Industry Supervisor Name</Label>
                      <Input
                        id="industry_supervisor_name"
                        value={formData.industry_supervisor_name}
                        onChange={(e) => setFormData({ ...formData, industry_supervisor_name: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="industry_supervisor_email">Industry Supervisor Email</Label>
                      <Input
                        id="industry_supervisor_email"
                        type="email"
                        value={formData.industry_supervisor_email}
                        onChange={(e) => setFormData({ ...formData, industry_supervisor_email: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="industry_supervisor_phone">Industry Supervisor Phone</Label>
                      <Input
                        id="industry_supervisor_phone"
                        value={formData.industry_supervisor_phone}
                        onChange={(e) => setFormData({ ...formData, industry_supervisor_phone: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="school_supervisor_name">School Supervisor Name</Label>
                      <Input
                        id="school_supervisor_name"
                        value={formData.school_supervisor_name}
                        onChange={(e) => setFormData({ ...formData, school_supervisor_name: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label htmlFor="period_of_training">Period of Training</Label>
                  <Input
                    id="period_of_training"
                    value={formData.period_of_training}
                    onChange={(e) => setFormData({ ...formData, period_of_training: e.target.value })}
                    placeholder="e.g., 6 months"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="other_info">Other Information</Label>
                  <Textarea
                    id="other_info"
                    value={formData.other_info}
                    onChange={(e) => setFormData({ ...formData, other_info: e.target.value })}
                  />
                </div>

                <Button type="submit" disabled={loading}>
                  {loading ? "Saving..." : "Save Changes"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default PreSiwesEdit;
