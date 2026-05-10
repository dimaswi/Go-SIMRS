import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageShell, PageHeader, FilterBar, FilterPill, PageContent } from "@/components/layout/page-shell";

import { DataTable } from "@/components/ui/data-table";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";
import { setPageTitle } from "@/lib/page-title";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  stockRequestsApi,
  type StockRequest,
} from "@/lib/api/stock-requests";
import { createStockRequestColumns } from "./columns";

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200",
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  approved: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  partial: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  completed: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
  cancelled: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400",
};

const priorityColors: Record<string, string> = {
  low: "bg-gray-100 text-gray-600",
  normal: "bg-blue-100 text-blue-600",
  high: "bg-orange-100 text-orange-600",
  urgent: "bg-red-100 text-red-600",
};

export default function StockRequestsIndex() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  
  const [_loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<StockRequest[]>([]);
  const [myRequests, setMyRequests] = useState<StockRequest[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<StockRequest[]>([]);
  const [activeView, setActiveView] = useState<"all" | "my" | "pending">("all");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const [allRes, myRes, pendingRes] = await Promise.all([
        stockRequestsApi.getAll({ limit: 100 }),
        stockRequestsApi.getMyRequests(),
        stockRequestsApi.getPendingApprovals(),
      ]);
      setRequests(allRes.data.data || []);
      setMyRequests(myRes.data.data || []);
      setPendingApprovals(pendingRes.data.data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data permintaan stok.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPageTitle("Permintaan Stok");
    loadData();
  }, []);

  const handleView = (id: number) => {
    navigate(`/stock-requests/${id}`);
  };

  const handleEdit = (id: number) => {
    navigate(`/stock-requests/${id}/edit`);
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await stockRequestsApi.delete(deleteId);
      toast({
        title: "Berhasil",
        description: "Permintaan stok berhasil dihapus.",
      });
      setDeleteId(null);
      loadData();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal menghapus permintaan stok.",
      });
    }
  };

  const handleApprove = (id: number) => {
    navigate(`/stock-requests/${id}/approve`);
  };

  const handleCancel = async (id: number) => {
    try {
      await stockRequestsApi.cancel(id);
      toast({
        variant: "success",
        title: "Berhasil",
        description: "Permintaan berhasil dibatalkan.",
      });
      loadData();
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal membatalkan permintaan.",
      });
    }
  };

  const displayData = useMemo(() => {
    if (activeView === "my") return myRequests;
    if (activeView === "pending") return pendingApprovals;
    return requests;
  }, [activeView, requests, myRequests, pendingApprovals]);

  const tableId = activeView === "my" ? "stock_requests_my" : activeView === "pending" ? "stock_requests_pending" : "stock_requests_all";

  const columns = createStockRequestColumns({
    onView: handleView,
    onEdit: handleEdit,
    onDelete: (id) => setDeleteId(id),
    onApprove: handleApprove,
    onCancel: handleCancel,
    statusColors,
    priorityColors,
    hasEditPermission: hasPermission("stock_request.update"),
    hasDeletePermission: hasPermission("stock_request.delete"),
  });

  if (_loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Permintaan Stok"
        description="Kelola permintaan barang dan obat antar ruangan"
        count={displayData.length}
        actions={
          hasPermission("stock_requests.create") ? (
            <Button onClick={() => navigate("/stock-requests/create")} size="sm">
              <Plus className="h-4 w-4" />
              Buat Permintaan
            </Button>
          ) : undefined
        }
      />
      <PageContent>
        <div className="border border-border/70 bg-background">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {activeView === "all" && "Daftar Permintaan Stok"}
            {activeView === "my" && "Permintaan Saya"}
            {activeView === "pending" && "Perlu Persetujuan"}
          </div>
          <div className="p-3 sm:p-4">
            <FilterBar>
              <FilterPill active={activeView === "all"} onClick={() => setActiveView("all")} count={requests.length}>
                Semua
              </FilterPill>
              <FilterPill active={activeView === "my"} onClick={() => setActiveView("my")} count={myRequests.length}>
                Permintaan Saya
              </FilterPill>
              <FilterPill active={activeView === "pending"} onClick={() => setActiveView("pending")} count={pendingApprovals.length}>
                Perlu Persetujuan
              </FilterPill>
            </FilterBar>
            <div className="mt-4">
              <DataTable
                columns={columns}
                data={displayData}
                searchPlaceholder="Cari nomor permintaan..."
                pageSize={10}
                tableId={tableId}
              />
            </div>
          </div>
        </div>
        <ConfirmDialog
          open={deleteId !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteId(null);
          }}
          onConfirm={handleDelete}
          title="Hapus Permintaan Stok?"
          description="Permintaan stok yang dihapus tidak dapat dikembalikan."
          confirmText="Hapus"
          cancelText="Batal"
          variant="destructive"
        />
      </PageContent>
    </PageShell>
  );
}

