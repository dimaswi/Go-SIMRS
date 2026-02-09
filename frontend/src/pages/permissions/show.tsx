import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { setPageTitle } from '@/lib/page-title';
import { Button } from '@/components/ui/button';
import { permissionsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ArrowLeft, Loader2, Pencil, Trash2 } from 'lucide-react';
import { usePermission } from '@/hooks/usePermission';

export default function PermissionShow() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const { canPerform } = usePermission();
  const [permission, setPermission] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    setPageTitle('Detail Permission');
    loadPermission();
  }, [id]);

  const loadPermission = async () => {
    try {
      const response = await permissionsApi.getById(Number(id));
      setPermission(response.data.data);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data permission.",
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
      await permissionsApi.delete(parseInt(id!));
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Permission berhasil dihapus.",
      });
      setTimeout(() => navigate('/permissions'), 500);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus permission.",
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

  if (!permission) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-lg font-semibold">Permission tidak ditemukan</p>
          <Button onClick={() => navigate('/permissions')} className="mt-4">
            Kembali ke Daftar Permission
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
            onClick={() => navigate('/permissions')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold font-mono">
              {permission.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {permission.description || 'Tidak ada deskripsi'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canPerform('role_management', 'update') && (
            <Button 
              variant="outline"
              size="sm"
              onClick={() => navigate(`/permissions/${id}/edit`)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
          {canPerform('role_management', 'delete') && (
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
          {/* Informasi Permission */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">INFORMASI PERMISSION</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="text-xs text-muted-foreground">Nama Permission</label>
                <p className="font-medium text-sm font-mono">{permission.name}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Deskripsi</label>
                <p className="font-medium text-sm">{permission.description || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Kategori</label>
                <p className="font-medium text-sm">
                  {permission.name ? permission.name.split('.')[0] : '-'}
                </p>
              </div>
            </div>
          </div>

          <hr className="border-border/50 my-6" />

          {/* Informasi Sistem */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-4">INFORMASI SISTEM</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="text-xs text-muted-foreground">ID Permission</label>
                <p className="font-medium text-sm">#{permission.id}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Dibuat</label>
                <p className="font-medium text-sm">{formatDate(permission.created_at)}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Terakhir Diperbarui</label>
                <p className="font-medium text-sm">{formatDate(permission.updated_at)}</p>
              </div>
            </div>
          </div>
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Hapus Permission"
        description="Apakah Anda yakin ingin menghapus permission ini? Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus"
        cancelText="Batal"
        variant="destructive"
      />
    </div>
  );
}
