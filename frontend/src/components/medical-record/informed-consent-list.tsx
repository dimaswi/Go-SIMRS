import React, { useState } from "react";
import { Plus, Edit, Printer, Trash2, FileSignature, Loader2 } from "lucide-react";
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
        if (status === "menyetujui") return <Badge variant="default" className="rounded-none bg-emerald-600 h-5 text-[10px] py-0">Setuju</Badge>;
        if (status === "menolak") return <Badge variant="destructive" className="rounded-none h-5 text-[10px] py-0">Tolak</Badge>;
        return <Badge variant="outline" className="rounded-none h-5 text-[10px] py-0">Belum Ditentukan</Badge>;
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
              className="h-7 w-7 rounded-none"
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
                  className="h-7 w-7 rounded-none"
                >
                  <Edit className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => setDeleteId(ic.id)}
                  className="h-7 w-7 rounded-none text-destructive hover:text-destructive hover:bg-destructive/10"
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
    <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border-b border-neutral-200 dark:border-neutral-800">
      <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3">
        <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
            Persetujuan Tindakan (Informed Consent)
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Daftar dokumen persetujuan atau penolakan tindakan kedokteran pada kunjungan ini.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="border border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-900 px-2.5 py-1 text-[11px] font-mono text-muted-foreground">
            {consents.length} dokumen
          </span>
          {!readOnly && (
            <Button
              type="button"
              onClick={onCreateNew}
              className="h-8 rounded-none text-xs gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              <Plus className="w-3.5 h-3.5" />
              Buat Persetujuan
            </Button>
          )}
        </div>
      </div>

      <div className="p-4 sm:p-5">
        {isLoading ? (
          <div className="flex items-center justify-center h-36 border border-dashed border-neutral-300 dark:border-neutral-700 text-muted-foreground text-xs gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Memuat data persetujuan tindakan...
          </div>
        ) : consents.length === 0 ? (
          <div className="border border-dashed border-neutral-300 dark:border-neutral-700 py-8 px-4 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <FileSignature className="h-4 w-4 opacity-60 shrink-0" />
            <span>Belum ada persetujuan tindakan pada kunjungan ini.</span>
          </div>
        ) : (
          <div className="border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
            <DataTable
              columns={columns}
              data={consents}
              showPagination={false}
              showSearch={false}
              className="[&_td]:py-2.5 [&_th]:bg-neutral-50 dark:[&_th]:bg-neutral-900 [&_th]:text-[11px] [&_th]:uppercase [&_th]:tracking-wider [&_th]:font-semibold"
            />
          </div>
        )}
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent className="rounded-none border-neutral-200 dark:border-neutral-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm font-bold uppercase tracking-tight">
              Hapus Persetujuan Tindakan?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              Tindakan ini tidak dapat dibatalkan. Data persetujuan beserta tanda tangan yang sudah ada akan dihapus permanen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 rounded-none text-xs" disabled={isDeleting}>
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={isDeleting}
              className="h-8 rounded-none text-xs bg-destructive hover:bg-destructive/90"
            >
              {isDeleting ? "Menghapus..." : "Ya, Hapus"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
