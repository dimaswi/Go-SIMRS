import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { suppliersApi, type SupplierFormData } from "@/lib/api/suppliers";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import { Loader2, Save } from "lucide-react";

export default function SupplierCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<SupplierFormData>({
    code: "",
    name: "",
    address: "",
    phone: "",
    email: "",
    npwp: "",
    contact_person: "",
    contact_phone: "",
    bank_name: "",
    bank_account: "",
    bank_account_name: "",
    notes: "",
    is_active: true,
  });

  useEffect(() => {
    setPageTitle("Tambah Supplier");
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.code || !formData.name) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Kode dan Nama supplier wajib diisi.",
      });
      return;
    }

    setLoading(true);
    try {
      await suppliersApi.create(formData);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Supplier berhasil ditambahkan.",
      });
      navigate("/suppliers");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menambahkan supplier.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col px-4">

      <div className="flex-1 space-y-6 [&_label]:tracking-[0.01em] [&_input]:h-11 [&_[role=combobox]]:h-11">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 gap-6">
          {/* Basic Info */}
          <div className="border border-border/70">
            <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Informasi Dasar
            </div>
            <div className="p-3 sm:p-4 space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="code">
                    Kode Supplier <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="code"
                    name="code"
                    placeholder="SUP-001"
                    value={formData.code}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">
                    Nama Supplier <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="PT Supplier Indonesia"
                    value={formData.name}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">Alamat</Label>
                <Textarea
                  id="address"
                  name="address"
                  placeholder="Alamat lengkap supplier"
                  value={formData.address}
                  onChange={handleChange}
                  rows={3}
                />
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="phone">Telepon</Label>
                  <Input
                    id="phone"
                    name="phone"
                    placeholder="021-12345678"
                    value={formData.phone}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="supplier@example.com"
                    value={formData.email}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="npwp">NPWP</Label>
                  <Input
                    id="npwp"
                    name="npwp"
                    placeholder="XX.XXX.XXX.X-XXX.XXX"
                    value={formData.npwp}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Contact Person */}
          <div className="border border-border/70">
            <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Contact Person
            </div>
            <div className="p-3 sm:p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="contact_person">Nama PIC</Label>
                  <Input
                    id="contact_person"
                    name="contact_person"
                    placeholder="Nama contact person"
                    value={formData.contact_person}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact_phone">No. HP PIC</Label>
                  <Input
                    id="contact_phone"
                    name="contact_phone"
                    placeholder="08123456789"
                    value={formData.contact_phone}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Bank Info */}
          <div className="border border-border/70">
            <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Informasi Bank
            </div>
            <div className="p-3 sm:p-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="bank_name">Nama Bank</Label>
                  <Input
                    id="bank_name"
                    name="bank_name"
                    placeholder="Bank BCA"
                    value={formData.bank_name}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_account">No. Rekening</Label>
                  <Input
                    id="bank_account"
                    name="bank_account"
                    placeholder="1234567890"
                    value={formData.bank_account}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="bank_account_name">Atas Nama</Label>
                  <Input
                    id="bank_account_name"
                    name="bank_account_name"
                    placeholder="PT Supplier Indonesia"
                    value={formData.bank_account_name}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Notes and Status */}
          <div className="border border-border/70">
            <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              Status & Catatan
            </div>
            <div className="p-3 sm:p-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="notes">Catatan</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    placeholder="Catatan tambahan..."
                    value={formData.notes}
                    onChange={handleChange}
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <div className="flex items-center space-x-2 pt-2">
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) =>
                        setFormData((prev) => ({ ...prev, is_active: checked }))
                      }
                    />
                    <Label htmlFor="is_active" className="font-normal">
                      {formData.is_active ? "Aktif" : "Non-Aktif"}
                    </Label>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Sticky Footer Actions */}
          <div className="shrink-0 sticky bottom-0 z-10 py-3 mt-auto flex items-center justify-end gap-2 border-t bg-background">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/suppliers")}
            >
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Simpan
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
