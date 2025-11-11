import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const PreSiwes = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    matric_no: "",
    department: "",
    faculty: "",
    organisation_name: "",
    organisation_address: "",
    nature_of_business: "",
    location_size: "medium" as "small" | "medium" | "large",
    products_services: "",
    industry_supervisor_name: "",
    industry_supervisor_email: "",
    industry_supervisor_phone: "",
    period_of_training: "",
    other_info: "",
    phone: "",
    email: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.from("students").insert({
        user_id: user?.id,
        ...formData,
      });

      if (error) throw error;

      toast.success("Registration completed successfully!");
      navigate("/student/dashboard");
    } catch (error: any) {
      toast.error(error.message || "Failed to submit registration");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="min-h-screen bg-gradient-light">
      <Navbar />
      
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <Card className="shadow-elevated">
            <CardHeader>
              <CardTitle className="text-2xl">Pre-SIWES Registration Form</CardTitle>
              <CardDescription>
                Complete this form before starting your industrial training
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="matric_no">Matriculation Number *</Label>
                    <Input
                      id="matric_no"
                      value={formData.matric_no}
                      onChange={(e) => handleChange("matric_no", e.target.value)}
                      required
                      placeholder="MTU/2023/0001"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="department">Department *</Label>
                    <Input
                      id="department"
                      value={formData.department}
                      onChange={(e) => handleChange("department", e.target.value)}
                      required
                      placeholder="Computer Science"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="faculty">Faculty *</Label>
                    <Input
                      id="faculty"
                      value={formData.faculty}
                      onChange={(e) => handleChange("faculty", e.target.value)}
                      required
                      placeholder="Faculty of Science"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => handleChange("phone", e.target.value)}
                      required
                      placeholder="+234 xxx xxx xxxx"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleChange("email", e.target.value)}
                      required
                      placeholder="student@mtu.edu.ng"
                    />
                  </div>
                </div>

                <div className="border-t pt-6 space-y-4">
                  <h3 className="font-semibold text-lg">Organisation Information</h3>

                  <div className="space-y-2">
                    <Label htmlFor="organisation_name">Organisation Name *</Label>
                    <Input
                      id="organisation_name"
                      value={formData.organisation_name}
                      onChange={(e) => handleChange("organisation_name", e.target.value)}
                      required
                      placeholder="ABC Company Limited"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="organisation_address">Full Address *</Label>
                    <Textarea
                      id="organisation_address"
                      value={formData.organisation_address}
                      onChange={(e) => handleChange("organisation_address", e.target.value)}
                      required
                      placeholder="123 Main Street, Lagos, Nigeria"
                      rows={3}
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="nature_of_business">Nature of Business *</Label>
                      <Input
                        id="nature_of_business"
                        value={formData.nature_of_business}
                        onChange={(e) => handleChange("nature_of_business", e.target.value)}
                        required
                        placeholder="Software Development"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="location_size">Location Size *</Label>
                      <Select
                        value={formData.location_size}
                        onValueChange={(value) => handleChange("location_size", value)}
                      >
                        <SelectTrigger id="location_size">
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

                  <div className="space-y-2">
                    <Label htmlFor="products_services">Products and Services *</Label>
                    <Textarea
                      id="products_services"
                      value={formData.products_services}
                      onChange={(e) => handleChange("products_services", e.target.value)}
                      required
                      placeholder="Web applications, mobile apps, consulting..."
                      rows={3}
                    />
                  </div>
                </div>

                <div className="border-t pt-6 space-y-4">
                  <h3 className="font-semibold text-lg">Industry Supervisor Information</h3>

                  <div className="space-y-2">
                    <Label htmlFor="industry_supervisor_name">Supervisor Name *</Label>
                    <Input
                      id="industry_supervisor_name"
                      value={formData.industry_supervisor_name}
                      onChange={(e) => handleChange("industry_supervisor_name", e.target.value)}
                      required
                      placeholder="Dr. John Doe"
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="industry_supervisor_email">Supervisor Email</Label>
                      <Input
                        id="industry_supervisor_email"
                        type="email"
                        value={formData.industry_supervisor_email}
                        onChange={(e) => handleChange("industry_supervisor_email", e.target.value)}
                        placeholder="supervisor@company.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="industry_supervisor_phone">Supervisor Phone</Label>
                      <Input
                        id="industry_supervisor_phone"
                        type="tel"
                        value={formData.industry_supervisor_phone}
                        onChange={(e) => handleChange("industry_supervisor_phone", e.target.value)}
                        placeholder="+234 xxx xxx xxxx"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="period_of_training">Period of Training *</Label>
                    <Input
                      id="period_of_training"
                      value={formData.period_of_training}
                      onChange={(e) => handleChange("period_of_training", e.target.value)}
                      required
                      placeholder="6 months (Jan - Jun 2025)"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="other_info">Other Information</Label>
                    <Textarea
                      id="other_info"
                      value={formData.other_info}
                      onChange={(e) => handleChange("other_info", e.target.value)}
                      placeholder="Any additional information..."
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex space-x-4">
                  <Button type="submit" disabled={loading} size="lg">
                    {loading ? "Submitting..." : "Submit Registration"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate("/student/dashboard")}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default PreSiwes;
