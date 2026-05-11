import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { PageContent, PageHeader, PageShell } from '@/components/layout/page-shell';
import { SectionPanel } from '@/components/layout/section-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { permissionsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { ArrowLeft, Clock3, Lock, Pencil, Tag, Trash2 } from 'lucide-react';
import { usePermission } from '@/hooks/usePermission';

function DetailField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className={mono ? 'font-mono text-sm text-foreground' : 'text-sm font-medium text-foreground'}>{value}</p>
    </div>
  );
}

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
        variant: 'destructive',
        title: 'Error!',
        description: 'Gagal memuat data permission.',
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
        variant: 'success',
        title: 'Berhasil!',
        description: 'Permission berhasil dihapus.',
      });
      setTimeout(() => navigate('/permissions'), 500);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error!',
        description: error.response?.data?.error || 'Gagal menghapus permission.',
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
      minute: '2-digit',
    });
  };

  const parsedActions = useMemo(() => {
    if (!permission?.actions) return [] as string[];
    try {
      const actions = JSON.parse(permission.actions || '[]');
      return Array.isArray(actions) ? actions.filter((action): action is string => typeof action === 'string') : [];
    } catch {
      return [] as string[];
    }
  }, [permission]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Clock3 className="h-8 w-8 animate-pulse text-muted-foreground" />
      </div>
    );
  }

  if (!permission) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold">Permission tidak ditemukan</p>
          <Button onClick={() => navigate('/permissions')} className="mt-4">
            Kembali ke daftar permission
          </Button>
        </div>
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title={permission.name}
        description={permission.description || 'Permission ini belum memiliki deskripsi tambahan.'}
        icon={Lock}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => navigate('/permissions')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Kembali
            </Button>
            {canPerform('role_management', 'update') ? (
              <Button type="button" variant="outline" onClick={() => navigate(`/permissions/${id}/edit`)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            ) : null}
            {canPerform('role_management', 'delete') ? (
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
            icon={Lock}
            title="Identitas Permission"
            description="Informasi inti yang menentukan nama dan konteks permission di modul akses."
          >
            <div className="grid gap-5 md:grid-cols-2">
              <DetailField label="Nama Permission" value={permission.name || '-'} mono />
              <DetailField label="Module" value={permission.module || '-'} />
              <DetailField label="Category" value={permission.category || '-'} />
              <DetailField label="Deskripsi" value={permission.description || '-'} />
            </div>
          </SectionPanel>

          <SectionPanel
            icon={Tag}
            title="Aksi Yang Diizinkan"
            description="Aksi disimpan dalam bentuk array dan ditampilkan kembali sebagai ringkasan perilaku access control."
          >
            {parsedActions.length ? (
              <div className="flex flex-wrap gap-2">
                {parsedActions.map((action) => (
                  <Badge key={action} variant="outline" className="rounded-none px-3 py-1.5 text-[11px] uppercase tracking-[0.16em]">
                    {action}
                  </Badge>
                ))}
              </div>
            ) : (
              <div className="border border-dashed border-border/70 px-5 py-8 text-center text-sm text-muted-foreground">
                Permission ini belum memiliki aksi yang tercatat.
              </div>
            )}
          </SectionPanel>
        </div>

        <SectionPanel
          icon={Clock3}
          title="Audit Sistem"
          description="Metadata pembuatan dan perubahan terakhir untuk kebutuhan verifikasi administrasi."
        >
          <div className="grid gap-5 md:grid-cols-3">
            <DetailField label="ID Permission" value={`#${permission.id}`} mono />
            <DetailField label="Dibuat" value={formatDate(permission.created_at)} />
            <DetailField label="Terakhir Diperbarui" value={formatDate(permission.updated_at)} />
          </div>
        </SectionPanel>
      </PageContent>

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
    </PageShell>
  );
}
