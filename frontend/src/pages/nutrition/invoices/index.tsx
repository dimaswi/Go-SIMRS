import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Loader2 } from "lucide-react";

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
        title="Input Faktur Bahan Gizi"
        description="Pencatatan faktur pembelian bahan gizi berdasarkan master bahan tanpa pengaruh stok."
        count={items.length}
        actions={(
          <Button onClick={() => navigate("/nutrition/invoices/create")} size="sm">
            <Plus className="h-4 w-4" />
            Input Faktur
          </Button>
        )}
      />
      <PageContent>
        <div className="border border-border/70 bg-background">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Daftar Faktur Bahan
          </div>
          <div className="p-3 sm:p-4">
            <DataTable
              columns={columns}
              data={items}
              searchPlaceholder="Cari berdasarkan kode internal, nomor faktur, atau supplier..."
              pageSize={10}
              tableId="nutrition-invoices"
            />
          </div>
        </div>
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

