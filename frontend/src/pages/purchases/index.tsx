import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

import { DataTable } from "@/components/ui/data-table";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";
import { setPageTitle } from "@/lib/page-title";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  purchasesApi,
  type Purchase,
} from "@/lib/api/stock-requests";
import { createPurchaseColumns } from "./columns";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  ordered: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  partial: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  received: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cancelled: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

export default function PurchasesIndex() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPermission } = usePermission();

  const [loading, setLoading] = useState(true);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await purchasesApi.getAll({ limit: 100 });
      setPurchases(response.data.data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data pembelian.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setPageTitle("Pembelian");
    loadData();
  }, [loadData]);

  const handleView = (id: number) => {
    navigate(`/purchases/${id}`);
  };

  const handleEdit = (id: number) => {
    navigate(`/purchases/${id}/edit`);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await purchasesApi.delete(deleteId);
      toast({
        title: "Berhasil",
        description: "Pembelian berhasil dihapus.",
      });
      setDeleteId(null);
      loadData();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal menghapus pembelian.",
      });
    }
  };

  const handleReceive = (id: number) => {
    navigate(`/purchases/${id}/receive`);
  };

  const columns = createPurchaseColumns({
    onView: handleView,
    onEdit: handleEdit,
    onDelete: (id) => setDeleteId(id),
    onReceive: handleReceive,
    statusColors,
    hasEditPermission: hasPermission("purchases.update"),
    hasDeletePermission: hasPermission("purchases.delete"),
    hasReceivePermission: hasPermission("purchases.receive"),
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
          <h1 className="text-lg font-semibold">Pembelian</h1>
          <p className="text-sm text-muted-foreground">Kelola pembelian barang dan obat dari supplier</p>
        </div>
        {hasPermission("purchases.create") && (
          <Button onClick={() => navigate("/purchases/create")} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Buat Pembelian
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        data={purchases}
        searchPlaceholder="Cari nomor pembelian atau supplier..."
        pageSize={10}
        tableId="purchases"
      />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Hapus Pembelian"
        description="Apakah Anda yakin ingin menghapus pembelian ini? Tindakan ini tidak dapat dibatalkan."
        onConfirm={handleDelete}
        confirmText="Hapus"
        variant="destructive"
      />
    </div>
  );
}
