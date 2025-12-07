import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { usersApi, rolesApi, employeesApi, type Employee } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, User, Mail, Lock, Shield, Users } from "lucide-react";
import { setPageTitle } from "@/lib/page-title";

export default function UserCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState<{ id: number; name: string }[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    password: "",
    full_name: "",
    role_id: "",
    employee_id: "",
  });

  useEffect(() => {
    setPageTitle("Tambah User");
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [rolesRes, employeesRes] = await Promise.all([
        rolesApi.getAll(),
        employeesApi.getAll(),
      ]);
      setRoles(rolesRes.data.data);
      setEmployees(employeesRes.data.data || []);
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await usersApi.create({
        ...formData,
        role_id: parseInt(formData.role_id),
        employee_id: formData.employee_id ? parseInt(formData.employee_id) : undefined,
      });
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "User berhasil dibuat.",
      });
      setTimeout(() => navigate("/users"), 500);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal membuat user.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Convert employees to ComboboxOption format
  const employeeOptions: ComboboxOption[] = employees.map(emp => ({
    value: String(emp.id),
    label: `${emp.nama_lengkap} (${emp.nip || emp.nik})`,
  }));

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="grid gap-4">
        <Card className="shadow-md">
          <CardHeader className="border-b bg-muted/50">
            <div className="flex items-center gap-4">
              <div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => navigate("/users")}
                  className="h-9 w-9"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              </div>
              <div>
                <CardTitle className="text-base font-semibold">
                  Informasi User
                </CardTitle>
                <CardDescription>
                  Masukkan detail informasi user baru
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label
                    htmlFor="full_name"
                    className="text-xs font-medium flex items-center gap-2"
                  >
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    Nama Lengkap
                  </Label>
                  <Input
                    id="full_name"
                    required
                    placeholder="Masukkan nama lengkap"
                    value={formData.full_name}
                    onChange={(e) =>
                      setFormData({ ...formData, full_name: e.target.value })
                    }
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="username"
                    className="text-xs font-medium flex items-center gap-2"
                  >
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    Username
                  </Label>
                  <Input
                    id="username"
                    required
                    placeholder="Masukkan username"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label
                    htmlFor="email"
                    className="text-xs font-medium flex items-center gap-2"
                  >
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    placeholder="email@example.com"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="password"
                    className="text-xs font-medium flex items-center gap-2"
                  >
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    placeholder="Masukkan password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="role_id"
                  className="text-xs font-medium flex items-center gap-2"
                >
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                  Role
                </Label>
                <select
                  id="role_id"
                  required
                  value={formData.role_id}
                  onChange={(e) =>
                    setFormData({ ...formData, role_id: e.target.value })
                  }
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="">Pilih Role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="employee_id"
                  className="text-xs font-medium flex items-center gap-2"
                >
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  Pegawai Terkait
                  <span className="text-muted-foreground font-normal">(Opsional)</span>
                </Label>
                <Combobox
                  options={employeeOptions}
                  value={formData.employee_id}
                  onValueChange={(value) => setFormData({ ...formData, employee_id: value })}
                  placeholder="Pilih pegawai..."
                  searchPlaceholder="Cari pegawai..."
                  emptyText="Pegawai tidak ditemukan"
                  className="h-9"
                />
                <p className="text-xs text-muted-foreground">
                  Hubungkan user ini dengan data pegawai yang sudah ada
                </p>
              </div>

              <div className="flex gap-3 justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/users")}
                  className="h-9 text-sm"
                >
                  Batal
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="h-9 text-sm min-w-24"
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Simpan
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
