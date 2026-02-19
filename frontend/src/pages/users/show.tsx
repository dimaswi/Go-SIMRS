import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usersApi } from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { 
  ArrowLeft, 
  Loader2, 
  Pencil, 
  Trash2
} from 'lucide-react';
import { setPageTitle } from '@/lib/page-title';

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
    setPageTitle('Detail User');
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
      setTimeout(() => navigate('/users'), 500);
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
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-lg font-semibold">User tidak ditemukan</p>
          <Button onClick={() => navigate('/users')} className="mt-4">
            Kembali ke Daftar User
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/users')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold">
              {user.full_name}
            </h1>
            <p className="text-sm text-muted-foreground">
              @{user.username} • {user.role?.name || 'No Role'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={user.is_active ? "default" : "secondary"}>
            {user.is_active ? 'Aktif' : 'Tidak Aktif'}
          </Badge>
          {hasPermission('users.update') && (
            <Button 
              variant="outline"
              size="sm"
              onClick={() => navigate(`/users/${id}/edit`)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
          {hasPermission('users.delete') && (
            <Button 
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Hapus
            </Button>
          )}
        </div>
      </div>
      <div className="rounded-lg border p-6">
          {/* Informasi User */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">INFORMASI USER</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div>
                <label className="text-xs text-muted-foreground">Nama Lengkap</label>
                <p className="font-medium text-sm">{user.full_name}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Username</label>
                <p className="font-medium text-sm">{user.username}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Email</label>
                <p className="font-medium text-sm">{user.email}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Pegawai Terkait</label>
                <p className="font-medium text-sm">
                  {user.employee ? user.employee.nama_lengkap : '-'}
                </p>
              </div>
            </div>
          </div>

          <hr className="border-border/50 my-6" />

          {/* Role */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">ROLE</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="text-xs text-muted-foreground">Nama Role</label>
                <p className="font-medium text-sm">{user.role?.name || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Deskripsi</label>
                <p className="font-medium text-sm">{user.role?.description || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Total Permission</label>
                <p className="font-medium text-sm">{user.role?.permissions?.length || 0} permission</p>
              </div>
            </div>
          </div>

          {/* Daftar Permission */}
          {user.role?.permissions && user.role.permissions.length > 0 && (
            <>
              <hr className="border-border/50 my-6" />
              <div className="mb-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-4">DAFTAR PERMISSION</h3>
                <div className="flex flex-wrap gap-2">
                  {user.role.permissions.map((perm: any) => (
                    <Badge key={perm.id} variant="outline" className="text-xs">
                      {perm.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </>
          )}

          <hr className="border-border/50 my-6" />

          {/* Informasi Sistem */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-4">INFORMASI SISTEM</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="text-xs text-muted-foreground">ID User</label>
                <p className="font-medium text-sm">#{user.id}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Dibuat</label>
                <p className="font-medium text-sm">{formatDate(user.created_at)}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Terakhir Diperbarui</label>
                <p className="font-medium text-sm">{formatDate(user.updated_at)}</p>
              </div>
            </div>
          </div>
      </div>

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
    </div>
  );
}
