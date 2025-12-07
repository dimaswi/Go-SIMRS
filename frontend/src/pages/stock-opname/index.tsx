import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";
import { setPageTitle } from "@/lib/page-title";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  stockOpnameApi,
  type StockOpname,
} from "@/lib/api/stock-requests";
import { createStockOpnameColumns } from "./columns";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  in_progress: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  completed: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  cancelled: "bg-red-100 text-red-500 dark:bg-red-900 dark:text-red-400",
};

export default function StockOpnameIndex() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPermission } = usePermission();

  const [loading, setLoading] = useState(true);
  const [stockOpnames, setStockOpnames] = useState<StockOpname[]>([]);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await stockOpnameApi.getAll({ limit: 100 });
      setStockOpnames(response.data.data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data stock opname.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setPageTitle("Stock Opname");
    loadData();
  }, [loadData]);

  const handleView = (id: number) => {
    navigate(`/stock-opname/${id}`);
  };

  const handleEdit = (id: number) => {
    navigate(`/stock-opname/${id}/edit`);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await stockOpnameApi.delete(deleteId);
      toast({
        title: "Berhasil",
        description: "Stock opname berhasil dihapus.",
      });
      setDeleteId(null);
      loadData();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal menghapus stock opname.",
      });
    }
  };

  const handleComplete = async (id: number) => {
    try {
      await stockOpnameApi.complete(id);
      toast({
        title: "Berhasil",
        description: "Stock opname berhasil diselesaikan.",
      });
      loadData();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal menyelesaikan stock opname.",
      });
    }
  };

  const columns = createStockOpnameColumns({
    onView: handleView,
    onEdit: handleEdit,
    onDelete: (id) => setDeleteId(id),
    onComplete: handleComplete,
    statusColors,
    hasEditPermission: hasPermission("stock_opname.update"),
    hasDeletePermission: hasPermission("stock_opname.delete"),
    hasCompletePermission: hasPermission("stock_opname.complete"),
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
      <div className="grid gap-4">
        <Card className="shadow-md">
          <CardHeader className="border-b bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold">Stock Opname</CardTitle>
                <CardDescription>Pengecekan dan penyesuaian stok fisik</CardDescription>
              </div>
              {hasPermission("stock_opname.create") && (
                <Button onClick={() => navigate("/stock-opname/create")} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Buat Stock Opname
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <DataTable
              columns={columns}
              data={stockOpnames}
              searchPlaceholder="Cari nomor opname..."
              pageSize={10}
            />
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Hapus Stock Opname"
        description="Apakah Anda yakin ingin menghapus stock opname ini? Tindakan ini tidak dapat dibatalkan."
        onConfirm={handleDelete}
        confirmText="Hapus"
        variant="destructive"
      />
    </div>
  );
}
