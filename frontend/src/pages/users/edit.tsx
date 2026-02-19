import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { usersApi, rolesApi, employeesApi, type Employee } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, User, Shield, Users } from 'lucide-react';
import { setPageTitle } from '@/lib/page-title';

export default function UserEdit() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [roles, setRoles] = useState<any[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [formData, setFormData] = useState({
    full_name: '',
    role_id: '',
    employee_id: '',
    is_active: true,
  });

  useEffect(() => {
    setPageTitle('Edit User');
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
        employee_id: user.employee_id ? String(user.employee_id) : '',
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      setTimeout(() => navigate('/users'), 500);
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

  // Convert employees to ComboboxOption format
  const employeeOptions: ComboboxOption[] = employees.map(emp => ({
    value: String(emp.id),
    label: `${emp.nama_lengkap} (${emp.nip || emp.nik})`,
  }));

  if (fetching) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col p-4">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => navigate("/users")}
          className="h-9 w-9"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold">
            Informasi User
          </h1>
          <p className="text-sm text-muted-foreground">
            Update detail informasi user
          </p>
        </div>
      </div>
      <div className="rounded-lg border p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="full_name" className="text-xs font-medium flex items-center gap-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  Nama Lengkap
                </Label>
                <Input
                  id="full_name"
                  required
                  placeholder="Masukkan nama lengkap"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="role_id" className="text-xs font-medium flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                  Role
                </Label>
                <select
                  id="role_id"
                  required
                  value={formData.role_id}
                  onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {roles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="employee_id" className="text-xs font-medium flex items-center gap-2">
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

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label htmlFor="is_active" className="text-xs font-medium cursor-pointer">
                    Status Akun
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {formData.is_active ? 'Akun aktif' : 'Akun tidak aktif'}
                  </p>
                </div>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>

              <div className="flex gap-3 justify-end">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => navigate('/users')}
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
                  Update
                </Button>
              </div>
            </form>
      </div>
    </div>
  );
}
