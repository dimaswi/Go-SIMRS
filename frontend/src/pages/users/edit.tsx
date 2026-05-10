import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { PageContent, PageHeader, PageShell } from "@/components/layout/page-shell";
import { SectionPanel } from "@/components/layout/section-panel";
import { Button } from "@/components/ui/button";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { employeesApi, rolesApi, usersApi, type Employee } from "@/lib/api";
import { setPageTitle } from "@/lib/page-title";
import { ArrowLeft, Loader2, Shield, User, Users } from "lucide-react";

export default function UserEdit() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [roles, setRoles] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [formData, setFormData] = useState({
    full_name: "",
    role_id: "",
    employee_id: "",
    is_active: true,
  });

  useEffect(() => {
    setPageTitle("Edit User");
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [userRes, rolesRes, employeesRes] = await Promise.all([
        usersApi.getById(Number(id)),
        rolesApi.getAll(),
        employeesApi.getAll(),
      ]);
      const user = userRes.data.data;
      setFormData({
        full_name: user.full_name,
        role_id: String(user.role_id),
        employee_id: user.employee_id ? String(user.employee_id) : "",
        is_active: user.is_active,
      });
      setRoles(rolesRes.data.data);
      setEmployees(employeesRes.data.data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data user.",
      });
    } finally {
      setFetching(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      await usersApi.update(Number(id), {
        ...formData,
        role_id: parseInt(formData.role_id),
        employee_id: formData.employee_id ? parseInt(formData.employee_id) : null,
      });
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "User berhasil diperbarui.",
      });
      setTimeout(() => navigate("/users"), 500);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal memperbarui user.",
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

  if (fetching) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Edit User"
        description="Perbarui identitas user, role aktif, dan keterkaitan pegawai tanpa mengubah alur operasional akun."
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
              title="Profil User"
              description="Perbarui nama yang tampil di aplikasi untuk akun ini."
            >
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
            </SectionPanel>

            <div className="space-y-6">
              <SectionPanel
                icon={Shield}
                title="Akses Dan Keterkaitan"
                description="Sinkronkan role dan data pegawai yang terkait dengan akun ini."
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
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="border border-border/70 bg-muted/20 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Role Aktif</div>
                    <p className="mt-2 text-sm font-medium text-foreground">{selectedRole?.name || "Belum dipilih"}</p>
                  </div>
                  <div className="border border-border/70 bg-muted/20 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Pegawai Terkait</div>
                    <p className="mt-2 text-sm font-medium text-foreground">{selectedEmployee?.nama_lengkap || "Belum dihubungkan"}</p>
                  </div>
                </div>
              </SectionPanel>

              <SectionPanel
                icon={Users}
                title="Status Akun"
                description="Nonaktifkan akun jika tidak lagi dipakai untuk akses harian."
              >
                <div className="flex items-center justify-between gap-4 border border-border/70 bg-muted/10 px-4 py-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{formData.is_active ? "Akun aktif" : "Akun tidak aktif"}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Perubahan status tersimpan bersama update user ini.</p>
                  </div>
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData((current) => ({ ...current, is_active: checked }))}
                  />
                </div>
              </SectionPanel>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border/70 pt-4">
            <Button type="button" variant="outline" onClick={() => navigate("/users")}>
              Batal
            </Button>
            <Button type="submit" disabled={loading} className="min-w-28">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Update User
            </Button>
          </div>
        </form>
      </PageContent>
    </PageShell>
  );
}
