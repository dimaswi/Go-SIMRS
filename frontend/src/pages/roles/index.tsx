import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { setPageTitle } from '@/lib/page-title';
import { Button } from '@/components/ui/button';

import { DataTable } from '@/components/ui/data-table';
import { createRoleColumns } from './columns';
import { rolesApi, type Role } from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Loader2, Plus } from 'lucide-react';

export default function RolesPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const { toast } = useToast();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roleToDelete, setRoleToDelete] = useState<number | null>(null);

  useEffect(() => {
    setPageTitle('Roles');
    loadRoles();
  }, []);

  const loadRoles = async () => {
    try {
      const response = await rolesApi.getAll();
      setRoles(response.data.data);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Failed to load roles.",
      });
    } finally {
      setLoading(false);
    }
  };

  const confirmDelete = async () => {
    if (!roleToDelete) return;
    
    try {
      await rolesApi.delete(roleToDelete);
      toast({
        variant: "success",
        title: "Success!",
        description: "Role deleted successfully.",
      });
      loadRoles();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Failed to delete role.",
      });
    } finally {
      setDeleteDialogOpen(false);
      setRoleToDelete(null);
    }
  };

  // Handle actions
  const handleView = (id: number) => {
    navigate(`/roles/${id}`);
  };

  const handleEdit = (id: number) => {
    navigate(`/roles/${id}/edit`);
  };

  const handleDeleteClick = (id: number) => {
    setRoleToDelete(id);
    setDeleteDialogOpen(true);
  };

  // Create columns
  const columns = createRoleColumns({
    onView: handleView,
    onEdit: handleEdit,
    onDelete: handleDeleteClick,
    hasViewPermission: hasPermission('roles.view'),
    hasEditPermission: hasPermission('roles.update'),
    hasDeletePermission: hasPermission('roles.delete'),
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Roles</h1>
          <p className="text-sm text-muted-foreground">Manage roles and permissions</p>
        </div>
        {hasPermission('roles.create') && (
          <Button onClick={() => navigate('/roles/create')} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Role
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        data={roles}
        searchPlaceholder="Search roles by name or description..."
        pageSize={10}
        tableId="roles"
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Delete Role"
        description="Are you sure you want to delete this role? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />
    </div>
  );
}
