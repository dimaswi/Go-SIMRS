import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { PageContent, PageHeader, PageShell } from '@/components/layout/page-shell';
import { PermissionDetailModal } from '@/components/permission-detail-modal';
import { RoleForm, type RoleFormValues } from '@/components/role-form';
import { Button } from '@/components/ui/button';
import { rolesApi, permissionsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, Shield } from 'lucide-react';

export default function RoleEdit() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [groupedPermissions, setGroupedPermissions] = useState<Record<string, any[]>>({});
  const [selectedPermission, setSelectedPermission] = useState<any>(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [formData, setFormData] = useState<RoleFormValues>({
    name: '',
    description: '',
    permission_ids: [],
  });

  useEffect(() => {
    setPageTitle('Edit Role');
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [roleRes, permsRes] = await Promise.all([rolesApi.getById(Number(id)), permissionsApi.getAll()]);
      const role = roleRes.data.data;

      setFormData({
        name: role.name,
        description: role.description,
        permission_ids: role.permissions?.map((permission: any) => permission.id) || [],
      });

      const grouped = permsRes.data.data.reduce((acc: Record<string, any[]>, permission: any) => {
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
        description={formData.name ? `Ubah identitas dan permission role ${formData.name}.` : 'Ubah identitas dan permission role.'}
        icon={Shield}
        onBack={() => navigate('/roles')}
        actions={
          <div className="flex items-center gap-1.5">
            <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => navigate('/roles')}>
              Batal
            </Button>
            <Button type="submit" form="role-form" size="sm" className="h-8 text-xs" disabled={loading}>
              {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Update Role
            </Button>
          </div>
        }
      />

      <PageContent noPadding className="flex-none">
        <RoleForm
          values={formData}
          onChange={setFormData}
          groupedPermissions={groupedPermissions}
          submitLabel="Update Role"
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
