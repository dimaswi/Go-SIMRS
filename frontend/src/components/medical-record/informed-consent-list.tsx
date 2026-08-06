import React, { useState } from "react";
import { Plus, Edit, Printer, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { DataTable } from "@/components/ui/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface InformedConsentListProps {
  visitId: number;
  onCreateNew: () => void;
  onEdit: (id: number) => void;
  onSign: (id: number) => void;
  onPrint: (id: number) => void;
  readOnly?: boolean;
}

export function InformedConsentList({
  visitId,
  onCreateNew,
  onEdit,
  onSign,
  onPrint,
  readOnly,
}: InformedConsentListProps) {
  const { toast } = useToast();
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetcher = (url: string) => api.get(url).then(res => res.data);

  const { data: response, isLoading, mutate } = useSWR(
    visitId ? `/visits/${visitId}/informed-consents` : null,
    fetcher
  );

  const consents = response?.data || [];

  const handleDelete = async () => {
    if (!deleteId) return;
    setIsDeleting(true);
    try {
      await api.delete(`/visits/${visitId}/informed-consents/${deleteId}`);
      toast({
        title: "Berhasil",
        description: "Persetujuan tindakan berhasil dihapus",
      });
      mutate();
    } catch (error: any) {
      toast({
        title: "Gagal",
        description: error.response?.data?.error || "Gagal menghapus data",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  const columns: ColumnDef<any>[] = React.useMemo(() => [
    {
      accessorKey: "created_at",
      header: "Tanggal",
      cell: ({ row }) => (
        <div className="text-xs whitespace-nowrap">
          {format(new Date(row.original.created_at), "dd MMM yyyy, HH:mm", { locale: id })}
        </div>
      ),
    },
    {
      accessorKey: "judul_tindakan",
      header: "Judul",
      cell: ({ row }) => (
        <div>
          <div className="font-medium text-xs">{row.original.judul_tindakan || "INFORMED CONSENT"}</div>
        </div>
      ),
    },
    {
      accessorKey: "visit.doctor",
      header: "Dokter",
      cell: ({ row }) => (
        <div className="text-xs">
          {row.original.visit?.doctor?.nama_lengkap || "-"}
        </div>
      ),
    },
    {
      accessorKey: "persetujuan_tindakan",
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.persetujuan_tindakan;
        if (status === "menyetujui") return <Badge variant="default" className="bg-green-600 h-5 text-[10px] py-0">Setuju</Badge>;
        if (status === "menolak") return <Badge variant="destructive" className="h-5 text-[10px] py-0">Tolak</Badge>;
        return <Badge variant="outline" className="h-5 text-[10px] py-0">Belum Ditentukan</Badge>;
      }
    },
    {
      id: "actions",
      header: () => <div className="text-right">Aksi</div>,
      cell: ({ row }) => {
        const ic = row.original;
        return (
          <div className="flex items-center justify-end gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => onPrint(ic.id)}
              title="Cetak Form"
              className="h-7 w-7"
            >
              <Printer className="w-3.5 h-3.5" />
            </Button>
            {!readOnly && (
              <>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => onEdit(ic.id)}
                  title="Edit"
                  className="h-7 w-7"
                >
                  <Edit className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setDeleteId(ic.id)}
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 h-7 w-7"
                  title="Hapus"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </>
            )}
          </div>
        );
      }
    }
  ], [onSign, onPrint, onEdit, setDeleteId, readOnly]);

  return (
    <div className="rounded-lg border border-border/70 bg-background overflow-hidden">
      <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        <div className="flex items-center justify-between">
          <div>Persetujuan Tindakan (Informed COnsent)</div>
          {!readOnly && (
            <Button onClick={onCreateNew} variant="outline">
              <Plus className="w-4 h-4 text-black font-bold" />
            </Button>
          )}
        </div>
      </div>
      <div className="p-3 sm:p-4">
        {isLoading ? (
          <div className="flex items-center justify-center p-8 text-muted-foreground text-sm">
            Memuat data...
          </div>
        ) : consents.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground bg-slate-50/50 rounded-lg border border-dashed">
            Belum ada persetujuan tindakan.
            {!readOnly && (
              <div className="mt-3">
                <Button onClick={onCreateNew} variant="outline" size="sm">
                  Buat Persetujuan Pertama
                </Button>
              </div>
            )}
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={consents}
            showPagination={false}
            showSearch={false}
            className="[&_td]:py-2"
          />
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Persetujuan Tindakan?</AlertDialogTitle>
            <AlertDialogDescription>
              Tindakan ini tidak dapat dibatalkan. Data persetujuan beserta tanda tangan yang sudah ada akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isDeleting}
              className="bg-red-500 hover:bg-red-600 focus:ring-red-500"
            >
              {isDeleting ? "Menghapus..." : "Ya, Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
