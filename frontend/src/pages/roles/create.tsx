import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { PageContent, PageHeader, PageShell } from '@/components/layout/page-shell';
import { PermissionDetailModal } from '@/components/permission-detail-modal';
import { RoleForm, type RoleFormValues } from '@/components/role-form';
import { Button } from '@/components/ui/button';
import { rolesApi, permissionsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, Shield } from 'lucide-react';

export default function RoleCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [groupedPermissions, setGroupedPermissions] = useState<Record<string, any[]>>({});
  const [selectedPermission, setSelectedPermission] = useState<any>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [formData, setFormData] = useState<RoleFormValues>({
    name: '',
    description: '',
    permission_ids: [],
  });

  useEffect(() => {
    setPageTitle('Tambah Role');
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      const response = await permissionsApi.getAll();
      const grouped = response.data.data.reduce((acc: Record<string, any[]>, permission: any) => {
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
        description: 'Failed to load permissions.',
      });
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);

    try {
      await rolesApi.create(formData);
      toast({
        variant: 'success',
        title: 'Success!',
        description: 'Role created successfully.',
      });
      setTimeout(() => navigate('/roles'), 500);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error!',
        description: error.response?.data?.error || 'Failed to create role.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Tambah Role"
        description="Buat role baru lalu centang aksi permission per modul."
        icon={Shield}
        onBack={() => navigate('/roles')}
        actions={
          <div className="flex items-center gap-1.5">
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => navigate('/roles')}>
              Batal
            </Button>
            <Button type="submit" form="role-form" size="sm" className="h-8 text-xs" disabled={loading}>
              {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Simpan Role
            </Button>
          </div>
        }
      />

      <PageContent noPadding className="flex-none">
        <RoleForm
          values={formData}
          onChange={setFormData}
          groupedPermissions={groupedPermissions}
          submitLabel="Simpan Role"
          loading={loading}
          onSubmit={handleSubmit}
          onCancel={() => navigate('/roles')}
          onShowPermissionInfo={(permission) => {
            setSelectedPermission(permission);
            setShowPermissionModal(true);
          }}
        />
      </PageContent>

      <PermissionDetailModal permission={selectedPermission} isOpen={showPermissionModal} onClose={() => setShowPermissionModal(false)} />
    </PageShell>
  );
}
