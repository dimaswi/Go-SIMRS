import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { rolesApi, usersApi, type Employee } from "@/lib/api";
import { Loader2, Lock } from "lucide-react";
import { Combobox } from "@/components/ui/combobox";

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee | null;
  onSuccess: () => void;
}

export function CreateUserModal({ isOpen, onClose, employee, onSuccess }: CreateUserModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [roles, setRoles] = useState<{ id: number; name: string }[]>([]);
  const [password, setPassword] = useState("");
  const [roleId, setRoleId] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadRoles();
      setPassword("");
      setRoleId("");
    }
  }, [isOpen]);

  const loadRoles = async () => {
    try {
      const res = await rolesApi.getAll();
      setRoles(res.data.data || []);
    } catch (error) {
      console.error("Failed to load roles:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;

    setLoading(true);
    try {
      const payload = {
        full_name: employee.nama_lengkap,
        username: employee.nip || employee.nik,
        email: employee.email || "",
        password: password,
        role_id: parseInt(roleId),
        employee_id: employee.id,
      };

      await usersApi.create(payload);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Akun user berhasil dibuat.",
      });
      onSuccess();
      onClose();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal Membuat Akun",
        description: error.response?.data?.error || "Terjadi kesalahan.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!employee) return null;

  const username = employee.nip || employee.nik;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5" />
              Buat Akun Pegawai
            </DialogTitle>
            <DialogDescription>
              Buat akun akses aplikasi untuk {employee.nama_lengkap}. NIP/NIK akan digunakan sebagai Username.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Nama Lengkap
              </Label>
              <div className="font-medium">{employee.nama_lengkap}</div>
            </div>
            <div className="grid gap-2">
              <Label className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Username (Otomatis)
              </Label>
              <div className="font-medium text-primary">{username}</div>
            </div>
            <div className="grid gap-2 mt-2">
              <Label htmlFor="role" className="text-xs font-medium">
                Pilih Role <span className="text-destructive">*</span>
              </Label>
              <Combobox
                options={roles.map(r => ({ value: r.id.toString(), label: r.name }))}
                value={roleId}
                onValueChange={setRoleId}
                placeholder="-- Pilih Role --"
                searchPlaceholder="Cari role..."
                emptyText="Role tidak ditemukan."
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password" className="text-xs font-medium">
                Password Akses <span className="text-destructive">*</span>
              </Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password awal"
                className="h-9"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Batal
            </Button>
            <Button type="submit" disabled={loading || !password || !roleId}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Buat Akun
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
