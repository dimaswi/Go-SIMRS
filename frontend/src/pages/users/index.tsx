import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { PageShell, PageHeader, PageContent } from '@/components/layout/page-shell';

import { DataTable } from '@/components/ui/data-table';
import { createUserColumns } from './columns';
import { usersApi, type User } from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, Plus } from 'lucide-react';

export default function UsersPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      const usersRes = await usersApi.getAll();
      setUsers(usersRes.data.data);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error instanceof Error ? error.message : "Failed to load data.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setPageTitle('Users');
    loadData();
  }, [loadData]);

  const confirmDelete = async () => {
    if (!userToDelete) return;
    
    try {
      await usersApi.delete(userToDelete);
      toast({
        variant: "success",
        title: "Success!",
        description: "User deleted successfully.",
      });
      loadData();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error instanceof Error ? error.message : "Failed to delete user.",
      });
    } finally {
      setDeleteDialogOpen(false);
      setUserToDelete(null);
    }
  };


  const handleView = (id: number) => {
    navigate(`/users/${id}`);
  };

  const handleEdit = (id: number) => {
    navigate(`/users/${id}/edit`);
  };

  const handleDeleteUser = (id: number) => {
    setUserToDelete(id);
    setDeleteDialogOpen(true);
  };

  // Create columns
  const columns = createUserColumns({
    onView: handleView,
    onEdit: handleEdit,
    onDelete: handleDeleteUser,
    hasViewPermission: hasPermission('users.view'),
    hasEditPermission: hasPermission('users.update'),
    hasDeletePermission: hasPermission('users.delete'),
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Users"
        description="Manage system users and their permissions"
        count={users.length}
        actions={
          hasPermission('users.create') ? (
            <Button onClick={() => navigate('/users/create')} size="sm">
              <Plus className="h-4 w-4" />
              Add User
            </Button>
          ) : undefined
        }
      />
      <PageContent>
        <div className="border border-border/70 bg-background">
  <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
    Daftar Users
  </div>
  <div className="p-3 sm:p-4">
    <DataTable
          columns={columns}
          data={users}
          searchPlaceholder="Search users by name, username, or email..."
          pageSize={10}
          tableId="users"
        />
  </div>
</div>
      </PageContent>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Delete User"
        description="Are you sure you want to delete this user? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
      />
    </PageShell>
  );
}
