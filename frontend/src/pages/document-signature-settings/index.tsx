import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { signatureApi, type DocumentSignatureRule } from "@/lib/api/signature";
import { Loader2, Save } from "lucide-react";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DataTable } from "@/components/ui/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye } from "lucide-react";

type SignatureColumnOption = "doctor_dpjp" | "nurse" | "patient" | "none";

type RuleRow = DocumentSignatureRule & {
  key: string;
  column_1: SignatureColumnOption;
  column_2: SignatureColumnOption;
};

function getCoverageStatus(row: RuleRow): { label: string; variant: "default" | "secondary" | "outline" } {
  const dt = row.document_type;
  const hasTwoCols = row.column_1 !== "none" && row.column_2 !== "none";
  const hasThreeColFixedDPJP =
    dt === "dpjp_request" ||
    dt === "informed_consent_receipt";

  if (hasThreeColFixedDPJP) {
    return { label: "Dinamis 2 + DPJP Fixed", variant: "default" };
  }
  if (hasTwoCols) {
    return { label: "Dinamis 2 Kolom", variant: "secondary" };
  }
  return { label: "Single Signature", variant: "outline" };
}

function getSlotLabel(slot: SignatureColumnOption): string {
  switch (slot) {
    case "doctor_dpjp":
      return "DPJP";
    case "nurse":
      return "Perawat";
    case "patient":
      return "Pasien";
    default:
      return "Kosong";
  }
}

const COLUMN_OPTIONS: Array<{ value: SignatureColumnOption; label: string }> = [
  { value: "doctor_dpjp", label: "DPJP" },
  { value: "nurse", label: "Perawat" },
  { value: "patient", label: "Pasien" },
  { value: "none", label: "Kosong" },
];

function normalizeColumnSlot(slot?: string): SignatureColumnOption {
  switch ((slot || "").trim().toLowerCase()) {
    case "doctor_dpjp":
      return "doctor_dpjp";
    case "nurse":
      return "nurse";
    case "patient":
      return "patient";
    default:
      return "none";
  }
}

function buildSlotsFromColumns(col1: SignatureColumnOption, col2: SignatureColumnOption): string[] {
  const slots: string[] = [];
  if (col1 !== "none") slots.push(col1);
  if (col2 !== "none" && col2 !== col1) slots.push(col2);
  return slots;
}

export default function DocumentSignatureSettingsPage() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rows, setRows] = useState<RuleRow[]>([]);
  const [previewRow, setPreviewRow] = useState<RuleRow | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string>("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await signatureApi.getDocumentSignatureSettings();
        const data = res.data?.data || [];
        setRows(
          data.map((r, i) => ({
            ...r,
            key: `${r.document_type}-${i}`,
            column_1: normalizeColumnSlot(r.slots?.[0]),
            column_2: normalizeColumnSlot(r.slots?.[1]),
          }))
        );
      } catch (error: any) {
        toast({ variant: "destructive", title: "Gagal", description: error?.response?.data?.error || "Gagal memuat konfigurasi TTD dokumen." });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [toast]);

  useEffect(() => {
    let active = true;
    let objectUrl = "";

    const loadPreview = async () => {
      if (!previewRow) {
        setPreviewUrl("");
        setPreviewError("");
        setPreviewLoading(false);
        return;
      }
      setPreviewLoading(true);
      setPreviewError("");
      try {
        const res = await signatureApi.getDocumentSignaturePreview({
          document_type: previewRow.document_type,
          column_1: previewRow.column_1,
          column_2: previewRow.column_2,
        });
        objectUrl = URL.createObjectURL(res.data as Blob);
        if (!active) return;
        setPreviewUrl(objectUrl);
      } catch (error: any) {
        if (!active) return;
        setPreviewError(error?.response?.data?.error || "Gagal memuat preview PDF.");
      } finally {
        if (active) setPreviewLoading(false);
      }
    };

    loadPreview();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [previewRow]);

  const canSave = useMemo(() => rows.length > 0 && rows.every((r) => r.required_signatures > 0), [rows]);
  const columns = useMemo<ColumnDef<RuleRow>[]>(
    () => [
      {
        accessorKey: "label",
        header: "Dokumen",
        cell: ({ row }) => <span className="font-medium">{row.original.label}</span>,
      },
      {
        accessorKey: "document_type",
        header: "Kode",
        cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.document_type}</span>,
      },
      {
        id: "column_1",
        header: "Kolom 1",
        cell: ({ row }) => (
          <Select value={row.original.column_1} onValueChange={(v) => handleColumnChange(row.original.key, "column_1", v as SignatureColumnOption)}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COLUMN_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ),
      },
      {
        id: "column_2",
        header: "Kolom 2",
        cell: ({ row }) => (
          <Select value={row.original.column_2} onValueChange={(v) => handleColumnChange(row.original.key, "column_2", v as SignatureColumnOption)}>
            <SelectTrigger className="h-9 w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COLUMN_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ),
      },
      {
        accessorKey: "layout_hint",
        header: "Lokasi TTD di PDF",
        cell: ({ row }) => {
          const r = row.original;
          return (
            <Button type="button" variant="outline" size="sm" className="h-7 px-2" onClick={() => setPreviewRow(r)}>
              <Eye className="h-3.5 w-3.5 mr-1" />
              Preview
            </Button>
          );
        },
      },
      {
        id: "coverage_status",
        header: "Status Implementasi",
        cell: ({ row }) => {
          const status = getCoverageStatus(row.original);
          return <Badge variant={status.variant}>{status.label}</Badge>;
        },
      },
      {
        id: "required_signatures",
        header: "TTD Wajib",
        cell: ({ row }) => (
          <Input
            className="h-9 w-[96px]"
            type="number"
            min={1}
            value={row.original.required_signatures}
            onChange={(e) => handleRequiredChange(row.original.key, e.target.value)}
          />
        ),
      },
    ],
    [rows]
  );

  const handleRequiredChange = (key: string, value: string) => {
    const num = Number(value);
    setRows((prev) =>
      prev.map((r) =>
        r.key === key
          ? {
              ...r,
              required_signatures: Number.isFinite(num) && num > 0 ? Math.floor(num) : 1,
            }
          : r
      )
    );
  };

  const handleColumnChange = (key: string, column: "column_1" | "column_2", value: SignatureColumnOption) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.key !== key) return r;
        const next = { ...r, [column]: value } as RuleRow;
        next.slots = buildSlotsFromColumns(next.column_1, next.column_2);
        return next;
      })
    );
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const payload: DocumentSignatureRule[] = rows.map(({ document_type, label, required_signatures, column_1, column_2, layout_hint }) => ({
        document_type,
        label,
        required_signatures,
        slots: buildSlotsFromColumns(column_1, column_2),
        layout_hint,
      }));
      await signatureApi.updateDocumentSignatureSettings(payload);
      toast({ variant: "success", title: "Tersimpan", description: "Konfigurasi TTD dokumen berhasil diperbarui." });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Gagal", description: error?.response?.data?.error || "Gagal menyimpan konfigurasi." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="TTD Dokumen"
        description="Halaman khusus untuk atur jumlah TTD wajib per jenis dokumen."
        actions={
          <Button onClick={handleSave} disabled={saving || loading || !canSave}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Simpan
          </Button>
        }
      />
      <PageContent>
        <div className="border border-border/70 bg-background">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Konfigurasi Signature
          </div>
          <div className="p-3 sm:p-4">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Memuat konfigurasi...
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">Belum ada aturan dokumen.</p>
            ) : (
              <DataTable
                tableId="document_signature_settings"
                columns={columns}
                data={rows}
                showSearch
                showPagination
                searchPlaceholder="Cari dokumen..."
                pageSize={25}
              />
            )}
          </div>
        </div>
        <Dialog open={!!previewRow} onOpenChange={(open) => !open && setPreviewRow(null)}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Preview Lokasi TTD PDF</DialogTitle>
            </DialogHeader>
            {previewRow && (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">{previewRow.label}</p>
                  <p className="text-xs text-muted-foreground font-mono">{previewRow.document_type}</p>
                </div>
                <div className="rounded border border-border overflow-hidden">
                  {previewLoading ? (
                    <div className="h-[70vh] w-full flex items-center justify-center text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Memuat preview PDF...
                    </div>
                  ) : previewError ? (
                    <div className="h-[70vh] w-full flex items-center justify-center text-sm text-destructive px-4 text-center">
                      {previewError}
                    </div>
                  ) : previewUrl ? (
                    <iframe
                      key={`${previewRow.document_type}:${previewRow.column_1}:${previewRow.column_2}`}
                      title={`Preview ${previewRow.document_type}`}
                      className="h-[70vh] w-full bg-white"
                      src={previewUrl}
                    />
                  ) : (
                    <div className="h-[70vh] w-full flex items-center justify-center text-sm text-muted-foreground">
                      Preview tidak tersedia.
                    </div>
                  )}
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </PageContent>
    </PageShell>
  );
}
