import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  ArrowLeft,
  Loader2,
  Pencil,
  Trash2,
  AlertTriangle,
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

  const isLowStock = medicine.current_stock <= medicine.min_stock;

  return (
    <div className="flex flex-1 flex-col px-4">
      <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => window.history.back()}
                  className="h-9 w-9"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <div className="flex items-center gap-2">
                      <h1 className="text-lg font-semibold">
                        {medicine.name}
                      </h1>
                      <Badge variant={medicine.is_active ? "default" : "secondary"}>
                        {medicine.is_active ? "Aktif" : "Nonaktif"}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <span className="font-mono">{medicine.code}</span>
                      {medicine.generic_name && (
                        <>
                          <span>â€¢</span>
                          <span>{medicine.generic_name}</span>
                        </>
                      )}
                    </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {hasPermission("medicines.update") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/medicines/${medicine.id}/edit`)}
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    Edit
                  </Button>
                )}
                {hasPermission("medicines.delete") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeleteDialogOpen(true)}
                    className="text-red-600 hover:text-red-600"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Hapus
                  </Button>
                )}
              </div>
      </div>
      <div className="rounded-lg border p-6">
            <div className="grid gap-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground border-b pb-2 flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Informasi Dasar
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

              <Separator />

              {/* Price & Stock Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground border-b pb-2 flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Harga & Stok
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
                    <p className="text-xs text-muted-foreground">Stok Saat Ini</p>
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium ${isLowStock ? "text-red-600" : ""}`}>
                        {medicine.current_stock} {medicine.unit}
                      </p>
                      {isLowStock && (
                        <Badge variant="destructive" className="text-xs">Low Stock</Badge>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Stok Minimum</p>
                    <p className="text-sm font-medium">{medicine.min_stock}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Stok Maksimum</p>
                    <p className="text-sm font-medium">{medicine.max_stock}</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Medical Info */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground border-b pb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Informasi Medis
                </h3>
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

              {(medicine.description || medicine.notes) && (
                <>
                  <Separator />
                  {/* Additional Info */}
                  <div className="space-y-4">
                    <h3 className="text-sm font-medium text-muted-foreground border-b pb-2 flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      Informasi Tambahan
                    </h3>
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
                </>
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
