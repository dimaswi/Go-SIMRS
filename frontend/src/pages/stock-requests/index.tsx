import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [activeTab, setActiveTab] = useState("all");
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
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="grid gap-4">
        <Card className="shadow-md">
          <CardHeader className="border-b bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold">Permintaan Stok</CardTitle>
                <CardDescription>Kelola permintaan barang dan obat antar ruangan</CardDescription>
              </div>
              {hasPermission("stock_requests.create") && (
                <Button onClick={() => navigate("/stock-requests/create")} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Buat Permintaan
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="all">
                  Semua ({requests.length})
                </TabsTrigger>
                <TabsTrigger value="my">
                  Permintaan Saya ({myRequests.length})
                </TabsTrigger>
                <TabsTrigger value="pending">
                  Perlu Persetujuan ({pendingApprovals.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="all" className="mt-4">
                <DataTable
                  columns={columns}
                  data={requests}
                  searchPlaceholder="Cari nomor permintaan..."
                  pageSize={10}
                />
              </TabsContent>

              <TabsContent value="my" className="mt-4">
                <DataTable
                  columns={columns}
                  data={myRequests}
                  searchPlaceholder="Cari nomor permintaan..."
                  pageSize={10}
                />
              </TabsContent>

              <TabsContent value="pending" className="mt-4">
                <DataTable
                  columns={columns}
                  data={pendingApprovals}
                  searchPlaceholder="Cari nomor permintaan..."
                  pageSize={10}
                />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Hapus Permintaan Stok"
        description="Apakah Anda yakin ingin menghapus permintaan stok ini? Tindakan ini tidak dapat dibatalkan."
        onConfirm={handleDelete}
        confirmText="Hapus"
        variant="destructive"
      />
    </div>
  );
}
