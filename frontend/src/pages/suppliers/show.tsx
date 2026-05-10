import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { suppliersApi, type Supplier } from "@/lib/api/suppliers";
import { usePermission } from "@/hooks/usePermission";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";
import {
  Loader2,
  Pencil,
  Building2,
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  User,
  CreditCard,
  FileText,
  AlertTriangle,
} from "lucide-react";

function SummaryMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone: string;
}) {
  return (
    <div className={`border border-border/70 bg-gradient-to-br ${tone} px-4 py-3 shadow-sm`}>
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold text-foreground">{value}</div>
    </div>
  );
}

export default function SupplierShow() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [supplier, setSupplier] = useState<Supplier | null>(null);

  const loadData = useCallback(async () => {
    try {
      const response = await suppliersApi.getById(Number(id));
      setSupplier(response.data.data);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data supplier.",
      });
      navigate("/suppliers");
    } finally {
      setLoading(false);
    }
  }, [id, toast, navigate]);

  useEffect(() => {
    setPageTitle("Detail Supplier");
    loadData();
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!supplier) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <p className="text-muted-foreground">Data tidak ditemukan</p>
        <Button onClick={() => navigate("/suppliers")}>
          Kembali ke Daftar
        </Button>
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Detail Supplier"
        description="Tinjau identitas supplier, PIC, rekening, dan status dalam satu halaman yang lebih ringkas."
        icon={Building2}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/suppliers")}>
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Button>
            {hasPermission("suppliers.update") && (
              <Button variant="outline" size="sm" onClick={() => navigate(`/suppliers/${id}/edit`)}>
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
        }
      >
        <div className="flex flex-wrap gap-2 pb-3">
          <div className="border border-border/70 bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Profil supplier lengkap</div>
          <div className="border border-border/70 bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">PIC dan bank terhubung</div>
          <div className="border border-border/70 bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Aksi cepat di header</div>
        </div>
      </PageHeader>

      <PageContent className="flex-none pb-8">
        <div className="mb-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <SummaryMetric label="Status" tone="from-background via-background to-sky-50/40" value={<span className="text-sm">{supplier.is_active ? "Aktif" : "Non-Aktif"}</span>} />
          <SummaryMetric label="Telepon" tone="from-background via-background to-emerald-50/40" value={<span className="text-sm">{supplier.phone || "-"}</span>} />
          <SummaryMetric label="PIC" tone="from-background via-background to-amber-50/50" value={<span className="text-sm">{supplier.contact_person || "-"}</span>} />
          <SummaryMetric label="Email" tone="from-background via-background to-rose-50/40" value={<span className="text-sm">{supplier.email || "-"}</span>} />
        </div>

      <div className="flex-1 space-y-6 [&_label]:tracking-[0.01em] [&_input]:h-11 [&_[role=combobox]]:h-11">
        {/* Basic Info */}
        <div className="border border-border/70">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
            <Building2 className="h-3 w-3" />
            Informasi Dasar
          </div>
          <div className="p-3 sm:p-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
              <div className="flex items-start gap-3 md:col-span-2">
                <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm text-muted-foreground">Nama Supplier</p>
                    <Badge
                      variant={supplier.is_active ? "default" : "secondary"}
                      className={
                        supplier.is_active
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 h-5 text-[10px]"
                          : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 h-5 text-[10px]"
                      }
                    >
                      {supplier.is_active ? "Aktif" : "Non-Aktif"}
                    </Badge>
                  </div>
                  <p className="font-medium text-base">{supplier.name}</p>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">{supplier.code}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Telepon</p>
                  <p className="font-medium">{supplier.phone || "-"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{supplier.email || "-"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">NPWP</p>
                  <p className="font-medium">{supplier.npwp || "-"}</p>
                </div>
              </div>
            </div>

            {supplier.address && (
              <div className="flex items-start gap-3 mb-6 p-4 bg-muted/50 rounded-lg">
                <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Alamat</p>
                  <p className="font-medium">{supplier.address}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Contact Person */}
        <div className="border border-border/70">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
            <User className="h-3 w-3" />
            Contact Person
          </div>
          <div className="p-3 sm:p-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="flex items-start gap-3">
                <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Nama PIC</p>
                  <p className="font-medium">{supplier.contact_person || "-"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">No. HP PIC</p>
                  <p className="font-medium">{supplier.contact_phone || "-"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bank Info */}
        <div className="border border-border/70">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
            <CreditCard className="h-3 w-3" />
            Informasi Bank
          </div>
          <div className="p-3 sm:p-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-start gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Nama Bank</p>
                  <p className="font-medium">{supplier.bank_name || "-"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">No. Rekening</p>
                  <p className="font-medium">{supplier.bank_account || "-"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Atas Nama</p>
                  <p className="font-medium">{supplier.bank_account_name || "-"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {supplier.notes && (
          <div className="border border-border/70">
            <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
              <FileText className="h-3 w-3" />
              Catatan
            </div>
            <div className="p-3 sm:p-4">
              <p className="text-sm text-muted-foreground mb-1">Catatan</p>
              <p className="text-sm">{supplier.notes}</p>
            </div>
          </div>
        )}
      </div>
      </PageContent>
    </PageShell>
  );
}
