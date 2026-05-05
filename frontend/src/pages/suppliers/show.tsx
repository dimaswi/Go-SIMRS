import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { suppliersApi, type Supplier } from "@/lib/api/suppliers";
import { usePermission } from "@/hooks/usePermission";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import {
  Loader2,
  Pencil,
  Building2,
  Phone,
  Mail,
  MapPin,
  User,
  CreditCard,
  FileText,
  AlertTriangle,
} from "lucide-react";

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
    <div className="flex flex-1 flex-col px-4">

      <div className="flex-1 space-y-6 [&_label]:tracking-[0.01em] [&_input]:h-11 [&_[role=combobox]]:h-11 mt-6">
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

      {/* Sticky Footer Actions */}
      <div className="shrink-0 sticky bottom-0 z-10 py-3 mt-4 flex items-center justify-between border-t bg-background">
        <Button variant="outline" onClick={() => navigate("/suppliers")}>
          Kembali
        </Button>
        <div className="flex gap-2">
          {hasPermission("suppliers.update") && (
            <Button
              variant="outline"
              onClick={() => navigate(`/suppliers/${id}/edit`)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
