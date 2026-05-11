import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { PageContent, PageHeader, PageShell } from '@/components/layout/page-shell';
import { SectionPanel } from '@/components/layout/section-panel';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { rolesApi } from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { ArrowLeft, Clock3, Pencil, Shield, Trash2 } from 'lucide-react';

interface RolePermission {
  id: number;
  name: string;
  module?: string;
  category?: string;
  description?: string;
}

function DetailField({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
      <p className={mono ? 'font-mono text-sm text-foreground' : 'text-sm font-medium text-foreground'}>{value}</p>
    </div>
  );
}

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
        variant: 'destructive',
        title: 'Error!',
        description: 'Gagal memuat data role.',
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
        variant: 'success',
        title: 'Berhasil!',
        description: 'Role berhasil dihapus.',
      });
      setTimeout(() => navigate('/roles'), 500);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error!',
        description: error.response?.data?.error || 'Gagal menghapus role.',
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

  const permissionsByModule = useMemo<[string, RolePermission[]][]>(() => {
    if (!role?.permissions?.length) return [];

    return Object.entries(
      role.permissions.reduce((acc: Record<string, RolePermission[]>, permission: RolePermission) => {
        const module = permission.module || 'Other';
        if (!acc[module]) {
          acc[module] = [];
        }
        acc[module].push(permission);
        return acc;
      }, {})
    );
  }, [role]);

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Clock3 className="h-8 w-8 animate-pulse text-muted-foreground" />
      </div>
    );
  }

  if (!role) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold">Role tidak ditemukan</p>
          <Button onClick={() => navigate('/roles')} className="mt-4">
            Kembali ke daftar role
          </Button>
        </div>
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title={role.name}
        description={role.description || 'Role ini belum memiliki deskripsi tambahan.'}
        icon={Shield}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" onClick={() => navigate('/roles')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Kembali
            </Button>
            <Badge variant="outline" className="h-9 rounded-none px-3 text-[11px] uppercase tracking-[0.16em]">
              {role.permissions?.length || 0} permission
            </Badge>
            {hasPermission('roles.update') ? (
              <Button type="button" variant="outline" onClick={() => navigate(`/roles/${id}/edit`)}>
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            ) : null}
            {hasPermission('roles.delete') ? (
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
            icon={Shield}
            title="Identitas Role"
            description="Ringkasan utama yang muncul saat role dipilih di modul user management."
          >
            <div className="grid gap-5 md:grid-cols-2">
              <DetailField label="Nama Role" value={role.name || '-'} />
              <DetailField label="Total Permission" value={`${role.permissions?.length || 0} permission`} />
              <DetailField label="Deskripsi" value={role.description || '-'} />
              <DetailField label="ID Role" value={`#${role.id}`} mono />
            </div>
          </SectionPanel>

          <SectionPanel
            icon={Clock3}
            title="Audit Sistem"
            description="Informasi waktu pembuatan dan pembaruan terakhir untuk kebutuhan pelacakan administratif."
          >
            <div className="grid gap-5 md:grid-cols-2">
              <DetailField label="Dibuat" value={formatDate(role.created_at)} />
              <DetailField label="Terakhir Diperbarui" value={formatDate(role.updated_at)} />
            </div>
          </SectionPanel>
        </div>

        <SectionPanel
          icon={Shield}
          title="Distribusi Permission"
          description="Permission dikelompokkan per modul agar cepat dipindai dan mudah diverifikasi."
        >
          {permissionsByModule.length ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {permissionsByModule.map(([module, permissions]) => (
                <div key={module} className="border border-border/70 bg-background/95">
                  <div className="border-b border-border/70 bg-muted/20 px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-sm font-semibold text-foreground">{module}</h4>
                      <Badge variant="outline" className="rounded-none text-[11px]">
                        {permissions.length}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-2 p-3">
                    {permissions.map((permission) => (
                      <div key={permission.id} className="border border-border/70 px-3 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-mono text-sm font-medium text-foreground">{permission.name}</p>
                          {permission.category ? (
                            <Badge variant="secondary" className="rounded-none text-[10px] uppercase tracking-[0.16em]">
                              {permission.category}
                            </Badge>
                          ) : null}
                        </div>
                        {permission.description ? <p className="mt-2 text-xs text-muted-foreground">{permission.description}</p> : null}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-dashed border-border/70 px-5 py-10 text-center">
              <p className="text-sm font-medium text-foreground">Belum ada permission pada role ini.</p>
              {hasPermission('roles.update') ? (
                <Button type="button" variant="outline" onClick={() => navigate(`/roles/${id}/edit`)} className="mt-4">
                  <Pencil className="mr-2 h-4 w-4" />
                  Kelola Permission
                </Button>
              ) : null}
            </div>
          )}
        </SectionPanel>
      </PageContent>

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
    </PageShell>
  );
}
