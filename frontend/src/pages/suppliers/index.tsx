import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

import { DataTable } from "@/components/ui/data-table";
import { createSupplierColumns } from "./columns";
import { suppliersApi, type Supplier } from "@/lib/api/suppliers";
import { usePermission } from "@/hooks/usePermission";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { setPageTitle } from "@/lib/page-title";
import { Loader2, Plus } from "lucide-react";

export default function SuppliersIndex() {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      const response = await suppliersApi.getAll({ limit: 100 });
      setSuppliers(response.data.data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error instanceof Error ? error.message : "Gagal memuat data supplier.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setPageTitle("Master Supplier");
    loadData();
  }, [loadData]);

  const confirmDelete = async () => {
    if (!supplierToDelete) return;

    try {
      await suppliersApi.delete(supplierToDelete);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Supplier berhasil dihapus.",
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus supplier.",
      });
    } finally {
      setDeleteDialogOpen(false);
      setSupplierToDelete(null);
    }
  };

  const handleView = (id: number) => {
    navigate(`/suppliers/${id}`);
  };

  const handleEdit = (id: number) => {
    navigate(`/suppliers/${id}/edit`);
  };

  const handleDelete = (id: number) => {
    setSupplierToDelete(id);
    setDeleteDialogOpen(true);
  };

  const columns = createSupplierColumns({
    onView: handleView,
    onEdit: handleEdit,
    onDelete: handleDelete,
    hasViewPermission: hasPermission("suppliers.view"),
    hasEditPermission: hasPermission("suppliers.update"),
    hasDeletePermission: hasPermission("suppliers.delete"),
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Master Supplier</h1>
          <p className="text-sm text-muted-foreground">Kelola data supplier untuk pembelian barang dan obat</p>
        </div>
        {hasPermission("suppliers.create") && (
          <Button onClick={() => navigate("/suppliers/create")} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Tambah Supplier
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        data={suppliers}
        searchPlaceholder="Cari supplier berdasarkan kode atau nama..."
        pageSize={10}
        tableId="suppliers"
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Hapus Supplier"
        description="Apakah Anda yakin ingin menghapus supplier ini? Data terkait pembelian mungkin akan terpengaruh."
        confirmText="Hapus"
        cancelText="Batal"
        variant="destructive"
      />
    </div>
  );
}
