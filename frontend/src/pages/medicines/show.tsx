import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  medicinesApi,
  type Medicine,
  type MedicineCategory,
  type MedicineType,
  medicineCategoryLabels,
  medicineTypeLabels,
  medicineFormLabels,
} from "@/lib/api/medicines";
import { usePermission } from "@/hooks/usePermission";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { setPageTitle } from "@/lib/page-title";
import {
  Loader2,
  Pencil,
  Trash2,
  AlertTriangle,
  Database,
  DollarSign,
  Info,
  FileText,
} from "lucide-react";

const categoryColors: Record<MedicineCategory, string> = {
  generic: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  patent: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  herbal: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  traditional: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  biological: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
};

const typeColors: Record<MedicineType, string> = {
  otc: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  limited: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  hard: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  narcotic: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  psychotrope: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(value);
}

export default function MedicineShow() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [medicine, setMedicine] = useState<Medicine | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const response = await medicinesApi.getById(Number(id));
      setMedicine(response.data.data);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data obat.",
      });
      navigate("/medicines");
    } finally {
      setLoading(false);
    }
  }, [id, toast, navigate]);

  useEffect(() => {
    setPageTitle("Detail Obat");
    loadData();
  }, [loadData]);

  const handleDelete = async () => {
    if (!medicine) return;
    try {
      await medicinesApi.delete(medicine.id);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Obat berhasil dihapus.",
      });
      navigate("/medicines");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus obat.",
      });
    }
    setDeleteDialogOpen(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!medicine) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Obat tidak ditemukan.</p>
      </div>
    );
  }
  const currentStock = medicine.current_stock ?? 0;

  return (
    <div className="flex flex-1 flex-col px-4">

      <div className="flex-1 space-y-6 [&_label]:tracking-[0.01em] [&_input]:h-11 [&_[role=combobox]]:h-11">
        {/* Basic Info */}
        <div className="border border-border/70">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
            <Info className="h-3 w-3" />
            Informasi Dasar
          </div>
          <div className="p-3 sm:p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <p className="text-xs text-muted-foreground">Nama Obat</p>
                <p className="text-sm font-medium">{medicine.name}</p>
                {medicine.generic_name && (
                  <p className="text-xs text-muted-foreground mt-0.5">Generik: {medicine.generic_name}</p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Kode Obat</p>
                <p className="text-sm font-medium font-mono">{medicine.code}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Status</p>
                <Badge variant={medicine.is_active ? "default" : "secondary"}>
                  {medicine.is_active ? "Aktif" : "Nonaktif"}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Kategori</p>
                <Badge className={categoryColors[medicine.category]}>
                  {medicineCategoryLabels[medicine.category]}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Golongan</p>
                <Badge variant="outline" className={typeColors[medicine.type]}>
                  {medicineTypeLabels[medicine.type]}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Bentuk Sediaan</p>
                <p className="text-sm font-medium">
                  {medicineFormLabels[medicine.form]}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Kekuatan</p>
                <p className="text-sm font-medium">
                  {medicine.strength || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Satuan</p>
                <p className="text-sm font-medium">{medicine.unit}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Produsen</p>
                <p className="text-sm font-medium">
                  {medicine.manufacturer || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Butuh Resep</p>
                <Badge variant={medicine.require_recipe ? "destructive" : "secondary"}>
                  {medicine.require_recipe ? "Ya" : "Tidak"}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        <div className="border border-border/70">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
            <Database className="h-3 w-3" />
            Mapping BPJS DPHO
          </div>
          <div className="p-3 sm:p-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs text-muted-foreground">Kode Obat DPHO</p>
                <p className="text-sm font-medium font-mono">{medicine.dpho_kode_obat || "-"}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs text-muted-foreground">Nama Obat DPHO</p>
                <p className="text-sm font-medium">{medicine.dpho_nama_obat || "Belum dipetakan ke DPHO"}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Price & Stock Info */}
        <div className="border border-border/70">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
            <DollarSign className="h-3 w-3" />
            Harga & Batas Stok
          </div>
          <div className="p-3 sm:p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Harga Beli (HNA)</p>
                <p className="text-sm font-medium">
                  {formatCurrency(medicine.purchase_price)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Harga Jual (HET)</p>
                <p className="text-sm font-medium">
                  {formatCurrency(medicine.selling_price)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Stok Minimum</p>
                <p className="text-sm font-medium">{medicine.min_stock}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Stok Maksimum</p>
                <p className="text-sm font-medium">{medicine.max_stock}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Stok Saat Ini</p>
                <p className="text-sm font-medium">{currentStock} {medicine.unit}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Medical Info */}
        <div className="border border-border/70">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
            <AlertTriangle className="h-3 w-3" />
            Informasi Medis
          </div>
          <div className="p-3 sm:p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Indikasi</p>
                <p className="text-sm whitespace-pre-wrap">
                  {medicine.indication || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Kontraindikasi</p>
                <p className="text-sm whitespace-pre-wrap">
                  {medicine.contraindication || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Dosis</p>
                <p className="text-sm whitespace-pre-wrap">
                  {medicine.dosage || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Efek Samping</p>
                <p className="text-sm whitespace-pre-wrap">
                  {medicine.side_effects || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Interaksi Obat</p>
                <p className="text-sm whitespace-pre-wrap">
                  {medicine.interaction || "-"}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Penyimpanan</p>
                <p className="text-sm whitespace-pre-wrap">
                  {medicine.storage_info || "-"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {(medicine.description || medicine.notes) && (
          <div className="border border-border/70">
            <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
              <FileText className="h-3 w-3" />
              Informasi Tambahan
            </div>
            <div className="p-3 sm:p-4">
              <div className="grid grid-cols-1 gap-4">
                {medicine.description && (
                  <div>
                    <p className="text-xs text-muted-foreground">Deskripsi</p>
                    <p className="text-sm whitespace-pre-wrap">
                      {medicine.description}
                    </p>
                  </div>
                )}
                {medicine.notes && (
                  <div>
                    <p className="text-xs text-muted-foreground">Catatan</p>
                    <p className="text-sm whitespace-pre-wrap">
                      {medicine.notes}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky Footer Actions */}
      <div className="shrink-0 sticky bottom-0 z-10 py-3 mt-4 flex items-center justify-between border-t bg-background">
        <Button variant="outline" onClick={() => navigate("/medicines")}>
          Kembali
        </Button>
        <div className="flex gap-2">
          {hasPermission("medicines.update") && (
            <Button
              variant="outline"
              onClick={() => navigate(`/medicines/${medicine.id}/edit`)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
          {hasPermission("medicines.delete") && (
            <Button
              variant="destructive"
              onClick={() => setDeleteDialogOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Hapus
            </Button>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={handleDelete}
        title="Hapus Obat"
        description={`Apakah Anda yakin ingin menghapus obat "${medicine.name}"? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Hapus"
        cancelText="Batal"
        variant="destructive"
      />
    </div>
  );
}
