import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { CreditCard, Loader2, Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";

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
    <PageShell>
      <PageHeader
        icon={ShoppingCart}
        title="Pembelian"
        description="Kelola pembelian barang dan obat dari supplier"
        count={purchases.length}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate("/purchases/payables")}
              size="sm"
              className="rounded-none h-8 px-3 text-xs font-semibold gap-1.5 shadow-none"
            >
              <CreditCard className="h-3.5 w-3.5" />
              Hutang Supplier
            </Button>
            {hasPermission("purchases.create") ? (
              <Button
                onClick={() => navigate("/purchases/create")}
                size="sm"
                className="bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 rounded-none h-8 px-3 text-xs font-semibold gap-1.5 shadow-none"
              >
                <Plus className="h-3.5 w-3.5" />
                Buat Pembelian
              </Button>
            ) : undefined}
          </div>
        }
      />
      <PageContent noPadding>
        <DataTable
          columns={columns}
          data={purchases}
          searchPlaceholder="Cari nomor pembelian atau supplier..."
          pageSize={10}
          tableId="purchases"
        />
      </PageContent>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Hapus Pembelian"
        description="Apakah Anda yakin ingin menghapus pembelian ini? Tindakan ini tidak dapat dibatalkan."
        onConfirm={handleDelete}
        confirmText="Hapus"
        variant="destructive"
      />
    </PageShell>
  );
}
