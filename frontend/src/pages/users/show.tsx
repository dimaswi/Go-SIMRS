import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageContent, PageHeader, PageShell } from "@/components/layout/page-shell";
import { SectionPanel } from "@/components/layout/section-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePermission } from "@/hooks/usePermission";
import { useToast } from "@/hooks/use-toast";
import { usersApi } from "@/lib/api";
import { setPageTitle } from "@/lib/page-title";
import { ArrowLeft, Clock3, Pencil, Shield, Trash2, User } from "lucide-react";

function DetailField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className={mono ? "font-mono text-sm text-foreground" : "text-sm font-medium text-foreground"}>{value}</p>
    </div>
  );
}

export default function UserShow() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    setPageTitle("Detail User");
    loadUser();
  }, [id]);

  const loadUser = async () => {
    try {
      const response = await usersApi.getById(Number(id));
      setUser(response.data.data);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data user.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteDialogOpen(false);
    try {
      await usersApi.delete(parseInt(id!));
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "User berhasil dihapus.",
      });
      setTimeout(() => navigate("/users"), 500);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus user.",
      });
      setDeleting(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Clock3 className="h-8 w-8 animate-pulse text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold">User tidak ditemukan</p>
          <Button onClick={() => navigate("/users")} className="mt-4">
            Kembali ke daftar user
          </Button>
        </div>
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title={user.full_name}
        description={`@${user.username} · ${user.role?.name || "Tanpa role"}`}
        icon={User}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => navigate("/users")}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Kembali
            </Button>
            <Badge variant={user.is_active ? "default" : "secondary"} className="h-9 rounded-none px-3">
              {user.is_active ? "Aktif" : "Tidak Aktif"}
            </Badge>
            {hasPermission("users.update") ? (
              <Button type="button" variant="outline" onClick={() => navigate(`/users/${id}/edit`)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            ) : null}
            {hasPermission("users.delete") ? (
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={deleting}>
                <Trash2 className="mr-2 h-4 w-4" />
                Hapus
              </Button>
            ) : null}
          </div>
        }
      />

      <PageContent className="flex-none space-y-6 pb-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <SectionPanel
            icon={User}
            title="Profil User"
            description="Ringkasan identitas akun, username login, dan keterkaitan ke data pegawai."
          >
            <div className="grid gap-5 md:grid-cols-2">
              <DetailField label="Nama Lengkap" value={user.full_name || "-"} />
              <DetailField label="Username" value={user.username ? `@${user.username}` : "-"} mono />
              <DetailField label="NIP Pegawai" value={user.employee?.nip || "-"} />
              <DetailField label="Pegawai Terkait" value={user.employee?.nama_lengkap || "-"} />
            </div>
          </SectionPanel>

          <SectionPanel
            icon={Shield}
            title="Role Aktif"
            description="Role menentukan permission utama yang diterima user dari modul akses."
          >
            <div className="grid gap-5 md:grid-cols-2">
              <DetailField label="Nama Role" value={user.role?.name || "-"} />
              <DetailField label="Total Permission" value={`${user.role?.permissions?.length || 0} permission`} />
              <DetailField label="Deskripsi Role" value={user.role?.description || "-"} />
              <DetailField label="Status Akun" value={user.is_active ? "Aktif" : "Tidak Aktif"} />
            </div>
          </SectionPanel>
        </div>

        <SectionPanel
          icon={Shield}
          title="Permission Yang Diterima"
          description="Daftar hak akses yang diturunkan dari role user saat ini."
        >
          {user.role?.permissions?.length ? (
            <div className="flex flex-wrap gap-2">
              {user.role.permissions.map((permission: any) => (
                <Badge key={permission.id} variant="outline" className="rounded-none px-3 py-1.5 text-[11px] uppercase tracking-[0.16em]">
                  {permission.name}
                </Badge>
              ))}
            </div>
          ) : (
            <div className="border border-dashed border-border/70 px-5 py-8 text-center text-sm text-muted-foreground">
              Role ini belum memiliki permission.
            </div>
          )}
        </SectionPanel>

        <SectionPanel
          icon={Clock3}
          title="Audit Sistem"
          description="Waktu pembuatan dan perubahan terakhir untuk kebutuhan penelusuran administrasi."
        >
          <div className="grid gap-5 md:grid-cols-3">
            <DetailField label="ID User" value={`#${user.id}`} mono />
            <DetailField label="Dibuat" value={formatDate(user.created_at)} />
            <DetailField label="Terakhir Diperbarui" value={formatDate(user.updated_at)} />
          </div>
        </SectionPanel>
      </PageContent>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Hapus User"
        description="Apakah Anda yakin ingin menghapus user ini? Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus"
        cancelText="Batal"
        variant="destructive"
      />
    </PageShell>
  );
}
