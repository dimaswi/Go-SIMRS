import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

import { DataTable } from "@/components/ui/data-table";
import { createCounterColumns } from "./columns";
import { counterApi, type Counter } from "@/lib/api/counters";
import { usePermission } from "@/hooks/usePermission";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { setPageTitle } from "@/lib/page-title";
import { Loader2, Plus } from "lucide-react";

export default function CounterIndex() {
  const { hasPermission } = usePermission();
  const hasCreatePermission = hasPermission("counters.create");
  const { toast } = useToast();
  const [counters, setCounters] = useState<Counter[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await counterApi.getCounters();
      setCounters(data);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data loket.",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPageTitle("Master Loket");
    loadData();
  }, []);

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      await counterApi.deleteCounter(deleteId);
      toast({
        title: "Berhasil!",
        description: "Loket berhasil dihapus.",
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus loket.",
      });
    } finally {
      setDeleteId(null);
    }
  };

  const columns = createCounterColumns({
    onDelete: setDeleteId,
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
          <h1 className="text-lg font-semibold">Master Loket</h1>
          <p className="text-sm text-muted-foreground">Kelola data loket pelayanan</p>
        </div>
        {hasCreatePermission && (
          <Link to="/counters/create">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Tambah Loket
            </Button>
          </Link>
        )}
      </div>
      <DataTable columns={columns} data={counters} />

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        onConfirm={handleDelete}
        title="Hapus Loket"
        description="Apakah Anda yakin ingin menghapus loket ini? Tindakan ini tidak dapat dibatalkan."
      />
    </div>
  );
}
