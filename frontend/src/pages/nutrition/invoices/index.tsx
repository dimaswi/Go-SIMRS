import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Loader2, ReceiptText } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import { nutritionIngredientInvoiceApi, type NutritionIngredientInvoice } from "@/lib/api/nutrition";
import { createNutritionInvoiceColumns } from "./columns";

export default function NutritionInvoicesPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [items, setItems] = useState<NutritionIngredientInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      const response = await nutritionIngredientInvoiceApi.getAll({ limit: 200 });
      setItems(response.data.data || []);
    } catch {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data faktur bahan gizi.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setPageTitle("Input Faktur Bahan Gizi");
    loadData();
  }, [loadData]);

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await nutritionIngredientInvoiceApi.delete(itemToDelete);
      toast({ variant: "success", title: "Berhasil!", description: "Faktur berhasil dihapus." });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus faktur.",
      });
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const columns = createNutritionInvoiceColumns({
    onView: (id) => navigate(`/nutrition/invoices/${id}`),
    onEdit: (id) => navigate(`/nutrition/invoices/${id}/edit`),
    onDelete: (id) => {
      setItemToDelete(id);
      setDeleteDialogOpen(true);
    },
  });

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        icon={ReceiptText}
        title="Input Faktur Bahan Gizi"
        description="Pencatatan faktur pembelian bahan gizi berdasarkan master bahan tanpa pengaruh stok."
        count={items.length}
        actions={(
          <Button
            onClick={() => navigate("/nutrition/invoices/create")}
            size="sm"
            className="bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 rounded-none h-8 px-3 text-xs font-semibold gap-1.5 shadow-none"
          >
            <Plus className="h-3.5 w-3.5" />
            Input Faktur
          </Button>
        )}
      />
      <PageContent noPadding>
        <DataTable
          columns={columns}
          data={items}
          searchPlaceholder="Cari berdasarkan kode internal, nomor faktur, atau supplier..."
          pageSize={10}
          tableId="nutrition-invoices"
        />
      </PageContent>
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Hapus Faktur Bahan"
        description="Apakah Anda yakin ingin menghapus faktur ini?"
        confirmText="Hapus"
        cancelText="Batal"
        variant="destructive"
      />
    </PageShell>
  );
}

