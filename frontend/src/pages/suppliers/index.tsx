import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PageShell, PageHeader, PageContent } from '@/components/layout/page-shell';
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createSupplierColumns } from "./columns";
import { suppliersApi, type Supplier } from "@/lib/api/suppliers";
import { usePermission } from "@/hooks/usePermission";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { setPageTitle } from "@/lib/page-title";
import { Loader2, Plus, Search, X } from "lucide-react";

type SupplierStatusFilter = "active" | "inactive" | "all";

export default function SuppliersIndex() {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState<SupplierStatusFilter>("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<number | null>(null);
  const hasLoadedRef = useRef(false);
  const requestSequenceRef = useRef(0);

  const loadData = useCallback(async () => {
    const requestId = ++requestSequenceRef.current;
    const isInitialLoad = !hasLoadedRef.current;

    if (isInitialLoad) {
      setLoading(true);
    } else {
      setIsRefreshing(true);
    }

    try {
      const response = await suppliersApi.getAll({
        limit: 1000,
        search: debouncedSearchQuery.trim() || undefined,
        status:
          statusFilter === "all"
            ? undefined
            : statusFilter === "active"
              ? "active"
              : "inactive",
      });
      if (requestId === requestSequenceRef.current) {
        setSuppliers(response.data.data || []);
      }
    } catch (error) {
      if (requestId === requestSequenceRef.current) {
        toast({
          variant: "destructive",
          title: "Error!",
          description: error instanceof Error ? error.message : "Gagal memuat data supplier.",
        });
      }
    } finally {
      if (requestId === requestSequenceRef.current) {
        if (isInitialLoad) {
          setLoading(false);
          hasLoadedRef.current = true;
        } else {
          setIsRefreshing(false);
        }
      }
    }
  }, [debouncedSearchQuery, statusFilter, toast]);

  useEffect(() => {
    setPageTitle("Master Supplier");
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [searchQuery]);

  useEffect(() => {
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
    <PageShell>
      <PageHeader
        title="Master Supplier"
        description="Kelola data supplier untuk pembelian barang dan obat"
        count={suppliers.length}
        actions={
          hasPermission("suppliers.create") ? (
            <Button onClick={() => navigate("/suppliers/create")} size="sm">
              <Plus className="h-4 w-4" />
              Tambah Supplier
            </Button>
          ) : undefined
        }
      />
      <PageContent>
        <div className="border border-border/70 bg-background">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Daftar Supplier
          </div>
          <div className="p-3 sm:p-4">
            <DataTable
              columns={columns}
              data={suppliers}
              showSearch={false}
              pageSize={10}
              tableId="suppliers"
              searchSlot={
                <>
                  <div className="relative w-full max-w-[280px] min-w-0">
                    <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="Cari supplier berdasarkan kode atau nama..."
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      className="h-7 w-full bg-background pl-7 pr-12 text-xs"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        aria-label="Hapus pencarian"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                    {isRefreshing && (
                      <Loader2 className="pointer-events-none absolute right-7 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin text-muted-foreground" />
                    )}
                  </div>
                  <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as SupplierStatusFilter)}>
                    <SelectTrigger className="h-7 w-[150px] bg-background text-xs">
                      <SelectValue placeholder="Status supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Hanya aktif</SelectItem>
                      <SelectItem value="all">Semua status</SelectItem>
                      <SelectItem value="inactive">Hanya nonaktif</SelectItem>
                    </SelectContent>
                  </Select>
                </>
              }
            />
          </div>
        </div>
      </PageContent>

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
    </PageShell>
  );
}
