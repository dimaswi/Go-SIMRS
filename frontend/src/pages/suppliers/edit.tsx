import { useState, useEffect, useCallback, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  suppliersApi,
  type SupplierFormData,
} from "@/lib/api/suppliers";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import { Loader2, Save, Building2, ArrowLeft, User, CreditCard, FileText } from "lucide-react";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";

function SummaryCue({
  label,
  description,
  tone,
}: {
  label: string;
  description: string;
  tone: string;
}) {
  return (
    <div className={`border border-border/70 bg-gradient-to-br ${tone} px-4 py-3 shadow-sm`}>
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-medium text-foreground">{description}</div>
    </div>
  );
}

function SectionPanel({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof Building2;
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
      <div className="p-3 sm:p-4 space-y-6">{children}</div>
    </div>
  );
}

export default function SupplierEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
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

  const loadData = useCallback(async () => {
    try {
      const response = await suppliersApi.getById(Number(id));
      const supplier = response.data.data;
      setFormData({
        code: supplier.code,
        name: supplier.name,
        address: supplier.address || "",
        phone: supplier.phone || "",
        email: supplier.email || "",
        npwp: supplier.npwp || "",
        contact_person: supplier.contact_person || "",
        contact_phone: supplier.contact_phone || "",
        bank_name: supplier.bank_name || "",
        bank_account: supplier.bank_account || "",
        bank_account_name: supplier.bank_account_name || "",
        notes: supplier.notes || "",
        is_active: supplier.is_active,
      });
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
    setPageTitle("Edit Supplier");
    loadData();
  }, [loadData]);

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

    setSaving(true);
    try {
      await suppliersApi.update(Number(id), formData);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Supplier berhasil diperbarui.",
      });
      navigate("/suppliers");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal memperbarui supplier.",
      });
    } finally {
      setSaving(false);
    }
  };

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
        title="Edit Supplier"
        description="Perbarui identitas supplier, PIC, rekening, dan status tanpa berpindah dari halaman master."
        icon={Building2}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => navigate("/suppliers")}>
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Button>
            <Button type="submit" form="supplier-edit-form" size="sm" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Simpan Perubahan
            </Button>
          </div>
        }
      >
        <div className="flex flex-wrap gap-2 pb-3">
          <div className="border border-border/70 bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Edit supplier aktif</div>
          <div className="border border-border/70 bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">PIC dan rekening dapat diperbarui</div>
          <div className="border border-border/70 bg-background px-2 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Status langsung terkontrol</div>
        </div>
      </PageHeader>

      <PageContent className="flex-none pb-8">
        <div className="mb-4 grid gap-3 lg:grid-cols-3">
          <SummaryCue label="Review Cepat" description="Cek ulang identitas dan kode supplier sebelum menyimpan perubahan." tone="from-background via-background to-sky-50/40" />
          <SummaryCue label="Relasi Bisnis" description="Pastikan data PIC dan rekening tetap sesuai untuk transaksi berikutnya." tone="from-background via-background to-emerald-50/40" />
          <SummaryCue label="Kontrol Status" description="Status aktif dan catatan internal menjaga supplier tetap terdokumentasi." tone="from-background via-background to-amber-50/50" />
        </div>

        <div className="flex-1 space-y-6 [&_label]:tracking-[0.01em] [&_input]:h-11 [&_[role=combobox]]:h-11">
        <form id="supplier-edit-form" onSubmit={handleSubmit} className="flex flex-col flex-1 gap-6">
          {/* Basic Info */}
          <SectionPanel icon={Building2} title="Informasi Dasar" description="Identitas utama supplier dan kanal komunikasi dasar.">
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
          </SectionPanel>

          {/* Contact Person */}
          <SectionPanel icon={User} title="Contact Person" description="Penanggung jawab supplier untuk komunikasi operasional harian.">
            <div>
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
          </SectionPanel>

          {/* Bank Info */}
          <SectionPanel icon={CreditCard} title="Informasi Bank" description="Data rekening supplier untuk kebutuhan pembayaran dan administrasi.">
            <div>
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
          </SectionPanel>

          {/* Notes and Status */}
          <SectionPanel icon={FileText} title="Status & Catatan" description="Catatan internal dan status aktif supplier untuk kontrol operasional.">
            <div>
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
          </SectionPanel>

          {/* Sticky Footer Actions */}
          <div className="shrink-0 sticky bottom-0 z-10 py-3 mt-auto flex items-center justify-end gap-2 border-t border-border/70 bg-background/95 backdrop-blur">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate("/suppliers")}
            >
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? (
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
      </PageContent>
    </PageShell>
  );
}
