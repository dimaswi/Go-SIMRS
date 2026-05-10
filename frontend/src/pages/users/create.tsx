import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { PageContent, PageHeader, PageShell } from "@/components/layout/page-shell";
import { SectionPanel } from "@/components/layout/section-panel";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { employeesApi, rolesApi, usersApi, type Employee } from "@/lib/api";
import { setPageTitle } from "@/lib/page-title";
import { ArrowLeft, Loader2, Lock, Mail, Shield, User, Users } from "lucide-react";

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
      const [rolesRes, employeesRes] = await Promise.all([rolesApi.getAll(), employeesApi.getAll()]);
      setRoles(rolesRes.data.data);
      setEmployees(employeesRes.data.data || []);
    } catch (error) {
      console.error("Failed to load data:", error);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
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

  const employeeOptions: ComboboxOption[] = employees.map((employee) => ({
    value: String(employee.id),
    label: `${employee.nama_lengkap} (${employee.nip || employee.nik})`,
  }));

  const selectedRole = roles.find((role) => String(role.id) === formData.role_id);
  const selectedEmployee = employees.find((employee) => String(employee.id) === formData.employee_id);

  return (
    <PageShell>
      <PageHeader
        title="Tambah User"
        description="Susun akun baru untuk staf operasional, tentukan peran, lalu hubungkan ke data pegawai bila diperlukan."
        icon={User}
        actions={
          <Button type="button" variant="outline" onClick={() => navigate("/users")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali
          </Button>
        }
      />

      <PageContent className="flex-none space-y-6 pb-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <SectionPanel
              icon={User}
              title="Profil Akun"
              description="Isi identitas dasar dan kredensial yang dipakai user untuk masuk ke aplikasi."
            >
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="full_name" className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Nama Lengkap
                  </Label>
                  <Input
                    id="full_name"
                    required
                    placeholder="Masukkan nama lengkap"
                    value={formData.full_name}
                    onChange={(event) => setFormData((current) => ({ ...current, full_name: event.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username" className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Username
                  </Label>
                  <Input
                    id="username"
                    required
                    placeholder="Masukkan username"
                    value={formData.username}
                    onChange={(event) => setFormData((current) => ({ ...current, username: event.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    placeholder="email@example.com"
                    value={formData.email}
                    onChange={(event) => setFormData((current) => ({ ...current, email: event.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    Password Awal
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    placeholder="Masukkan password"
                    value={formData.password}
                    onChange={(event) => setFormData((current) => ({ ...current, password: event.target.value }))}
                  />
                </div>
              </div>
            </SectionPanel>

            <SectionPanel
              icon={Shield}
              title="Akses Dan Keterkaitan"
              description="Tentukan role utama, lalu hubungkan ke data pegawai agar identitas operasional tetap sinkron."
              contentClassName="space-y-5"
            >
              <div className="space-y-2">
                <Label htmlFor="role_id" className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Role
                </Label>
                <select
                  id="role_id"
                  required
                  value={formData.role_id}
                  onChange={(event) => setFormData((current) => ({ ...current, role_id: event.target.value }))}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                >
                  <option value="">Pilih role</option>
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="employee_id" className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Pegawai Terkait
                </Label>
                <Combobox
                  options={employeeOptions}
                  value={formData.employee_id}
                  onValueChange={(value) => setFormData((current) => ({ ...current, employee_id: value }))}
                  placeholder="Pilih pegawai..."
                  searchPlaceholder="Cari pegawai..."
                  emptyText="Pegawai tidak ditemukan"
                />
                <p className="text-xs leading-5 text-muted-foreground">Opsional. Gunakan bila akun ini merepresentasikan pegawai yang sudah terdaftar di SIMRS.</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="border border-border/70 bg-muted/20 px-4 py-3">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <Shield className="h-3.5 w-3.5" /> Role Terpilih
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground">{selectedRole?.name || "Belum dipilih"}</p>
                </div>

                <div className="border border-border/70 bg-muted/20 px-4 py-3">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <Users className="h-3.5 w-3.5" /> Pegawai Terkait
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground">{selectedEmployee?.nama_lengkap || "Belum dihubungkan"}</p>
                </div>

                <div className="border border-border/70 bg-background px-4 py-3">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" /> Kontak Login
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground">{formData.email || "Belum diisi"}</p>
                </div>

                <div className="border border-border/70 bg-background px-4 py-3">
                  <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" /> Kredensial
                  </div>
                  <p className="mt-2 text-sm font-medium text-foreground">{formData.password ? "Password siap digunakan" : "Belum diisi"}</p>
                </div>
              </div>
            </SectionPanel>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border/70 pt-4">
            <Button type="button" variant="outline" onClick={() => navigate("/users")}>
              Batal
            </Button>
            <Button type="submit" disabled={loading} className="min-w-28">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Simpan User
            </Button>
          </div>
        </form>
      </PageContent>
    </PageShell>
  );
}
