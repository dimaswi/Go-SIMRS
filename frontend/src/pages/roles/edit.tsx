import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { PageContent, PageHeader, PageShell } from '@/components/layout/page-shell';
import { SectionPanel } from '@/components/layout/section-panel';
import { PermissionAssignmentPanel } from '@/components/permission-assignment-panel';
import { PermissionDetailModal } from '@/components/permission-detail-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { rolesApi, permissionsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { ArrowLeft, CheckSquare, FileText, Loader2, Shield } from 'lucide-react';

export default function RoleEdit() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [groupedPermissions, setGroupedPermissions] = useState<Record<string, any[]>>({});
  const [selectedPermission, setSelectedPermission] = useState<any>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permission_ids: [] as number[],
  });

  useEffect(() => {
    setPageTitle('Edit Role');
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [roleRes, permsRes] = await Promise.all([rolesApi.getById(Number(id)), permissionsApi.getAll()]);
      const role = roleRes.data.data;
      const allPermissions = permsRes.data.data;

      setFormData({
        name: role.name,
        description: role.description,
        permission_ids: role.permissions?.map((permission: any) => permission.id) || [],
      });

      const grouped = allPermissions.reduce((acc: Record<string, any[]>, permission: any) => {
        const module = permission.module || 'Other';
        if (!acc[module]) {
          acc[module] = [];
        }
        acc[module].push(permission);
        return acc;
      }, {});

      setGroupedPermissions(grouped);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error!',
        description: 'Failed to load role data.',
      });
      navigate('/roles');
    } finally {
      setFetching(false);
    }
  };

  const handlePermissionToggle = (permissionId: number) => {
    setFormData((current) => ({
      ...current,
      permission_ids: current.permission_ids.includes(permissionId)
        ? current.permission_ids.filter((id) => id !== permissionId)
        : [...current.permission_ids, permissionId],
    }));
  };

  const handleReplaceSelection = (permissionIds: number[]) => {
    setFormData((current) => ({ ...current, permission_ids: permissionIds }));
  };

  const handleShowPermissionInfo = (permission: any) => {
    setSelectedPermission(permission);
    setShowPermissionModal(true);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      await rolesApi.update(Number(id), formData);
      toast({
        variant: 'success',
        title: 'Success!',
        description: 'Role updated successfully.',
      });
      setTimeout(() => navigate('/roles'), 500);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error!',
        description: error.response?.data?.error || 'Failed to update role.',
      });
    } finally {
      setLoading(false);
    }
  };

  const moduleCount = Object.keys(groupedPermissions).length;
  const selectedModuleCount = useMemo(
    () => Object.values(groupedPermissions).filter((permissions) => permissions.some((permission) => formData.permission_ids.includes(permission.id))).length,
    [formData.permission_ids, groupedPermissions]
  );

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
        title="Edit Role"
        description="Perbarui identitas role dan sesuaikan permission per modul dengan panel assign yang lebih lapang."
        icon={Shield}
        actions={
          <Button type="button" variant="outline" onClick={() => navigate('/roles')}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali
          </Button>
        }
      />

      <PageContent className="flex-none space-y-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
            <div className="space-y-6">
              <SectionPanel
                icon={Shield}
                title="Identitas Role"
                description="Pastikan nama dan deskripsi role tetap menjelaskan konteks akses yang diberikan."
              >
                <div className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Nama Role
                    </Label>
                    <Input
                      id="name"
                      required
                      placeholder="Contoh: Admin Rawat Jalan"
                      value={formData.name}
                      onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description" className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      Deskripsi
                    </Label>
                    <Textarea
                      id="description"
                      placeholder="Jelaskan ruang lingkup dan tujuan role ini..."
                      value={formData.description}
                      onChange={(event) => setFormData((current) => ({ ...current, description: event.target.value }))}
                      className="min-h-[120px]"
                    />
                  </div>
                </div>
              </SectionPanel>

              <SectionPanel
                icon={FileText}
                title="Ringkasan Akses"
                description="Cek distribusi permission yang aktif sebelum perubahan disimpan ke role ini."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="border border-border/70 bg-muted/20 px-4 py-3">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Total Modul</div>
                    <p className="mt-2 text-2xl font-semibold text-foreground">{moduleCount}</p>
                  </div>
                  <div className="border border-border/70 bg-foreground px-4 py-3 text-background">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-background/70">Permission Dipilih</div>
                    <p className="mt-2 text-2xl font-semibold">{formData.permission_ids.length}</p>
                  </div>
                  <div className="border border-border/70 bg-background px-4 py-3 sm:col-span-2">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Modul Yang Sudah Aktif</div>
                    <p className="mt-2 text-sm font-medium text-foreground">{selectedModuleCount ? `${selectedModuleCount} modul sudah terisi permission` : 'Belum ada modul yang dipilih'}</p>
                  </div>
                </div>
              </SectionPanel>
            </div>

            <SectionPanel
              icon={CheckSquare}
              title="Assign Permission"
              description="Cari cepat, pilih per modul, dan gunakan aksi massal untuk mempercepat penyesuaian role."
              contentClassName="p-0"
            >
              <PermissionAssignmentPanel
                groupedPermissions={groupedPermissions}
                selectedPermissionIds={formData.permission_ids}
                onTogglePermission={handlePermissionToggle}
                onReplaceSelection={handleReplaceSelection}
                onShowPermissionInfo={handleShowPermissionInfo}
                className="p-4 sm:p-5"
              />
            </SectionPanel>
          </div>

          <div className="sticky bottom-0 z-20 -mx-4 -mb-4 mt-8 border-t border-border/70 bg-background/80 p-4 backdrop-blur-xl md:-mx-6 md:-mb-6">
            <div className="flex flex-wrap items-center justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => navigate('/roles')}>
                Batal
              </Button>
              <Button type="submit" disabled={loading} className="min-w-28 shadow-md">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Update Role
              </Button>
            </div>
          </div>
        </form>
      </PageContent>

      <PermissionDetailModal permission={selectedPermission} isOpen={showPermissionModal} onClose={() => setShowPermissionModal(false)} />
    </PageShell>
  );
}
