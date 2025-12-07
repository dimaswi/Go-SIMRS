import { useState, useEffect, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { suppliersApi, type Supplier } from "@/lib/api/suppliers";
import { usePermission } from "@/hooks/usePermission";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import {
  ArrowLeft,
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
    <div className="flex flex-1 flex-col gap-4 p-6">
      <Card className="shadow-md">
        <CardHeader className="border-b bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigate("/suppliers")}
                className="h-9 w-9"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-base font-semibold">
                    {supplier.name}
                  </CardTitle>
                  <Badge
                    variant={supplier.is_active ? "default" : "secondary"}
                    className={
                      supplier.is_active
                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        : "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400"
                    }
                  >
                    {supplier.is_active ? "Aktif" : "Non-Aktif"}
                  </Badge>
                </div>
                <CardDescription>
                  Kode: {supplier.code}
                </CardDescription>
              </div>
            </div>
            {hasPermission("suppliers.update") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/suppliers/${id}/edit`)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Basic Info */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <div className="flex items-start gap-3">
              <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Nama Supplier</p>
                <p className="font-medium">{supplier.name}</p>
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

          <Separator className="my-6" />

          {/* Contact Person */}
          <h3 className="text-base font-semibold mb-4">Contact Person</h3>
          <div className="grid gap-4 md:grid-cols-2 mb-6">
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

          <Separator className="my-6" />

          {/* Bank Info */}
          <h3 className="text-base font-semibold mb-4">Informasi Bank</h3>
          <div className="grid gap-4 md:grid-cols-3 mb-6">
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

          {supplier.notes && (
            <>
              <Separator className="my-6" />
              <div className="p-4 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground mb-1">Catatan</p>
                <p className="text-sm">{supplier.notes}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
