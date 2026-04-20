import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

import { DataTable } from "@/components/ui/data-table";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";
import { setPageTitle } from "@/lib/page-title";
import {
  distributionsApi,
  type StockDistribution,
} from "@/lib/api/stock-requests";
import { createDistributionColumns } from "./columns";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  delivered: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  received: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

export default function DistributionsIndex() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPermission } = usePermission();

  const [loading, setLoading] = useState(true);
  const [distributions, setDistributions] = useState<StockDistribution[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await distributionsApi.getAll({ limit: 100 });
      setDistributions(response.data.data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data distribusi.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setPageTitle("Distribusi Stok");
    loadData();
  }, [loadData]);

  const handleView = (id: number) => {
    navigate(`/distributions/${id}`);
  };

  const handleReceive = async (id: number) => {
    try {
      await distributionsApi.receive(id);
      toast({
        variant: "success",
        title: "Berhasil",
        description: "Distribusi berhasil diterima.",
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menerima distribusi.",
      });
    }
  };

  const columns = createDistributionColumns({
    onView: handleView,
    onReceive: handleReceive,
    statusColors,
    hasReceivePermission: hasPermission("distributions.receive"),
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Distribusi Stok</h1>
          <p className="text-sm text-muted-foreground">Kelola distribusi barang dan obat antar ruangan</p>
        </div>
        {hasPermission("distributions.create") && (
          <Button onClick={() => navigate("/distributions/create")} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Buat Distribusi
          </Button>
        )}
      </div>
      <DataTable
        columns={columns}
        data={distributions}
        searchPlaceholder="Cari nomor distribusi..."
        pageSize={10}
        tableId="distributions"
      />
    </div>
  );
}
