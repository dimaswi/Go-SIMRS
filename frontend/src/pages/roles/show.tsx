import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { setPageTitle } from '@/lib/page-title';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { rolesApi } from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { 
  ArrowLeft, 
  Loader2, 
  Pencil, 
  Trash2
} from 'lucide-react';

export default function RoleShow() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const [role, setRole] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    setPageTitle('Detail Role');
    loadRole();
  }, [id]);

  const loadRole = async () => {
    try {
      const response = await rolesApi.getById(Number(id));
      setRole(response.data.data);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data role.",
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
      await rolesApi.delete(parseInt(id!));
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Role berhasil dihapus.",
      });
      setTimeout(() => navigate('/roles'), 500);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus role.",
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

  if (!role) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-lg font-semibold">Role tidak ditemukan</p>
          <Button onClick={() => navigate('/roles')} className="mt-4">
            Kembali ke Daftar Role
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/roles')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold">
              {role.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {role.description || 'Tidak ada deskripsi'} • {role.permissions?.length || 0} permission
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasPermission('roles.update') && (
            <Button 
              variant="outline"
              size="sm"
              onClick={() => navigate(`/roles/${id}/edit`)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
          {hasPermission('roles.delete') && (
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
          {/* Informasi Role */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">INFORMASI ROLE</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="text-xs text-muted-foreground">Nama Role</label>
                <p className="font-medium text-sm">{role.name}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Deskripsi</label>
                <p className="font-medium text-sm">{role.description || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Total Permission</label>
                <p className="font-medium text-sm">{role.permissions?.length || 0} permission</p>
              </div>
            </div>
          </div>

          <hr className="border-border/50 my-6" />

          {/* Daftar Permission */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">DAFTAR PERMISSION</h3>
            {role.permissions && role.permissions.length > 0 ? (
              <div className="space-y-2">
                {role.permissions.map((perm: any, index: number) => (
                  <div 
                    key={perm.id} 
                    className="flex items-center justify-between py-2 border-b border-border/30 last:border-b-0"
                  >
                    <div>
                      <p className="text-sm font-mono font-medium">{perm.name}</p>
                      {perm.description && (
                        <p className="text-xs text-muted-foreground">{perm.description}</p>
                      )}
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {index + 1}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">Tidak ada permission yang diberikan</p>
                {hasPermission('roles.update') && (
                  <Button 
                    onClick={() => navigate(`/roles/${id}/edit`)}
                    variant="outline"
                    size="sm"
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Kelola Permission
                  </Button>
                )}
              </div>
            )}
          </div>

          <hr className="border-border/50 my-6" />

          {/* Informasi Sistem */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-4">INFORMASI SISTEM</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="text-xs text-muted-foreground">ID Role</label>
                <p className="font-medium text-sm">#{role.id}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Dibuat</label>
                <p className="font-medium text-sm">{formatDate(role.created_at)}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Terakhir Diperbarui</label>
                <p className="font-medium text-sm">{formatDate(role.updated_at)}</p>
              </div>
            </div>
          </div>
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Hapus Role"
        description="Apakah Anda yakin ingin menghapus role ini? Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus"
        cancelText="Batal"
        variant="destructive"
      />
    </div>
  );
}
