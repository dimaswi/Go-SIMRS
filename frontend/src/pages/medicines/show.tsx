import { useState, useEffect, useCallback, type ReactNode } from "react";
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
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";
import {
  Loader2,
  Pencil,
  Trash2,
  AlertTriangle,
  Database,
  DollarSign,
  Info,
  FileText,
  ArrowLeft,
  Pill,
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

function SummaryMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: ReactNode;
  tone: string;
}) {
  return (
    <div className={`border border-border/70 bg-gradient-to-br ${tone} px-4 py-3 shadow-sm`}>
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold text-foreground">{value}</div>
    </div>
  );
}

function DetailField({
  label,
  value,
  mono,
}: {
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="space-y-1 border-l border-border/70 pl-3 first:border-l-0 first:pl-0">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className={mono ? "font-mono text-sm font-medium text-foreground" : "text-sm font-medium text-foreground"}>{value}</div>
    </div>
  );
}

function NarrativeField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="space-y-1 border border-border/70 bg-background px-3 py-3">
      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="text-sm text-foreground whitespace-pre-wrap">{value}</div>
    </div>
  );
}

function SectionPanel({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Info;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="border border-border/70 bg-background/95 shadow-sm">
      <div className="border-b border-border/70 bg-muted/20 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="border border-border/70 bg-background p-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </div>
  );
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
  const dphoMapped = Boolean(medicine.dpho_kode_obat || medicine.dpho_nama_obat);

  return (
    <PageShell>
      <PageHeader
        title={medicine.name}
        description={`Kode ${medicine.code}${medicine.generic_name ? ` | Generik ${medicine.generic_name}` : ""}`}
        icon={Pill}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/medicines")}>
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Button>
            {hasPermission("medicines.update") && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/medicines/${medicine.id}/edit`)}>
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            )}
            {hasPermission("medicines.delete") && (
              <Button variant="destructive" size="sm" onClick={() => setDeleteDialogOpen(true)}>
                <Trash2 className="h-4 w-4" />
                Hapus
              </Button>
            )}
          </div>
        }
      >
        <div className="flex flex-wrap gap-2 pb-3">
          <Badge variant={medicine.is_active ? "default" : "secondary"}>{medicine.is_active ? "Aktif" : "Nonaktif"}</Badge>
          <Badge className={categoryColors[medicine.category]}>{medicineCategoryLabels[medicine.category]}</Badge>
          <Badge variant="outline" className={typeColors[medicine.type]}>{medicineTypeLabels[medicine.type]}</Badge>
          <Badge variant="outline">{medicineFormLabels[medicine.form]}</Badge>
        </div>
      </PageHeader>

      <PageContent className="flex-none pb-8">
        <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryMetric label="Stok Saat Ini" tone="from-background via-background to-sky-50/40" value={<>{currentStock} <span className="text-sm font-medium text-muted-foreground">{medicine.unit}</span></>} />
          <SummaryMetric label="Harga Beli" tone="from-background via-background to-emerald-50/40" value={formatCurrency(medicine.purchase_price)} />
          <SummaryMetric label="Harga Jual" tone="from-background via-background to-amber-50/50" value={formatCurrency(medicine.selling_price)} />
          <SummaryMetric label="Status DPHO" tone="from-background via-background to-rose-50/40" value={<span className="text-sm">{dphoMapped ? "Sudah terhubung ke DPHO" : "Belum dipetakan ke DPHO"}</span>} />
        </div>

        <div className="flex-1 space-y-6">
          <SectionPanel
            icon={Info}
            title="Informasi Dasar"
            description="Identitas utama obat yang paling sering dibutuhkan saat review detail master."
          >
            <div className="grid gap-4 md:grid-cols-4">
              <div className="md:col-span-2 space-y-1 border border-border/70 bg-background px-3 py-3">
                <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Nama Obat</div>
                <div className="text-sm font-semibold text-foreground">{medicine.name}</div>
                {medicine.generic_name && <div className="text-xs text-muted-foreground">Generik: {medicine.generic_name}</div>}
              </div>
              <DetailField label="Kode Obat" value={medicine.code} mono />
              <DetailField label="Status" value={<Badge variant={medicine.is_active ? "default" : "secondary"}>{medicine.is_active ? "Aktif" : "Nonaktif"}</Badge>} />
              <DetailField label="Kategori" value={<Badge className={categoryColors[medicine.category]}>{medicineCategoryLabels[medicine.category]}</Badge>} />
              <DetailField label="Golongan" value={<Badge variant="outline" className={typeColors[medicine.type]}>{medicineTypeLabels[medicine.type]}</Badge>} />
              <DetailField label="Bentuk Sediaan" value={medicineFormLabels[medicine.form]} />
              <DetailField label="Kekuatan" value={medicine.strength || "-"} />
              <DetailField label="Satuan" value={medicine.unit} />
              <DetailField label="Produsen" value={medicine.manufacturer || "-"} />
              <DetailField label="Butuh Resep" value={<Badge variant={medicine.require_recipe ? "destructive" : "secondary"}>{medicine.require_recipe ? "Ya" : "Tidak"}</Badge>} />
            </div>
          </SectionPanel>

          <SectionPanel
            icon={Database}
            title="Mapping BPJS DPHO"
            description="Keterhubungan obat dengan katalog DPHO untuk kebutuhan bridging dan validasi penjamin."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <DetailField label="Kode Obat DPHO" value={medicine.dpho_kode_obat || "-"} mono />
              <div className="md:col-span-2">
                <DetailField label="Nama Obat DPHO" value={medicine.dpho_nama_obat || "Belum dipetakan ke DPHO"} />
              </div>
            </div>
          </SectionPanel>

          <SectionPanel
            icon={DollarSign}
            title="Harga & Batas Stok"
            description="Ringkasan finansial dan ambang inventori yang memengaruhi pengadaan dan distribusi."
          >
            <div className="grid gap-4 md:grid-cols-4">
              <DetailField label="Harga Beli (HNA)" value={formatCurrency(medicine.purchase_price)} />
              <DetailField label="Harga Jual (HET)" value={formatCurrency(medicine.selling_price)} />
              <DetailField label="Stok Minimum" value={medicine.min_stock} />
              <DetailField label="Stok Maksimum" value={medicine.max_stock} />
              <DetailField label="Stok Saat Ini" value={`${currentStock} ${medicine.unit}`} />
            </div>
          </SectionPanel>

          <SectionPanel
            icon={AlertTriangle}
            title="Informasi Medis"
            description="Referensi klinis yang membantu penggunaan obat tetap aman dan terdokumentasi."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <NarrativeField label="Indikasi" value={medicine.indication || "-"} />
              <NarrativeField label="Kontraindikasi" value={medicine.contraindication || "-"} />
              <NarrativeField label="Dosis" value={medicine.dosage || "-"} />
              <NarrativeField label="Efek Samping" value={medicine.side_effects || "-"} />
              <NarrativeField label="Interaksi Obat" value={medicine.interaction || "-"} />
              <NarrativeField label="Penyimpanan" value={medicine.storage_info || "-"} />
            </div>
          </SectionPanel>

          {(medicine.description || medicine.notes) && (
            <SectionPanel
              icon={FileText}
              title="Informasi Tambahan"
              description="Konteks deskriptif yang membantu tim memahami catatan dan karakteristik obat di luar field inti."
            >
              <div className="grid gap-4">
                {medicine.description && <NarrativeField label="Deskripsi" value={medicine.description} />}
                {medicine.notes && <NarrativeField label="Catatan" value={medicine.notes} />}
              </div>
            </SectionPanel>
          )}
        </div>
      </PageContent>

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
    </PageShell>
  );
}
