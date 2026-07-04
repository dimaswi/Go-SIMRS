import { useCallback, useEffect, useState } from "react";
import { setPageTitle } from "@/lib/page-title";
import { reportBpjsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Building2, Calendar, Download, Loader2 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  PageShell,
  PageContent,
  PageHeader as ShellPageHeader,
  FilterBar,
  FilterPill,
} from "@/components/layout/page-shell";
import {
  ReportKpiGrid,
  ReportPanel,
  REPORT_MONO_FAMILY,
} from "./report-ui";

const formatNumber = (v: number) => {
  if (v == null || Number.isNaN(Number(v))) return "-";
  return new Intl.NumberFormat("id-ID").format(Number(v));
};

const formatCurrency = (v: number) => {
  if (v == null || Number.isNaN(Number(v))) return "-";
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(Number(v));
};

function renderCellBadge(value: string | number | null | undefined, key: string) {
  const text = value == null ? "-" : String(value);
  const normalized = text.toLowerCase();
  const titleized = text
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

  if (key === "status" || key === "state") {
    if (normalized.includes("active") || normalized.includes("completed") || normalized.includes("success")) return <Badge className="rounded-none bg-emerald-600 hover:bg-emerald-600">Aktif</Badge>;
    if (normalized.includes("pending")) return <Badge variant="secondary" className="rounded-none">Pending</Badge>;
    if (normalized.includes("cancel") || normalized.includes("failed")) return <Badge variant="destructive" className="rounded-none">Batal</Badge>;
  }
  if (key === "jns_pelayanan" || key === "jenis_rawat") return <Badge variant="outline" className="rounded-none">{titleized}</Badge>;
  return null;
}

function getDefaultStart() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function getDefaultEnd() {
  return new Date().toISOString().slice(0, 10);
}

function InlineNav({
  items,
  value,
  onChange,
}: {
  items: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="border border-border/70 bg-background px-3 py-3">
      <FilterBar className="gap-2">
      {items.map((item) => (
        <FilterPill
          key={item.value}
          onClick={() => onChange(item.value)}
          active={value === item.value}
          className="min-h-[38px] px-3 py-2 text-[10px] leading-none"
        >
          {item.label}
        </FilterPill>
      ))}
      </FilterBar>
    </div>
  );
}

function DateFilter({
  startDate,
  endDate,
  onStartChange,
  onEndChange,
  onApply,
  onExport,
  loading,
}: {
  startDate: string;
  endDate: string;
  onStartChange: (v: string) => void;
  onEndChange: (v: string) => void;
  onApply: () => void;
  onExport?: () => void;
  loading?: boolean;
}) {
  return (
    <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto">
      <div className="flex items-center gap-1.5 border border-border/70 bg-background px-2 py-2">
        <Calendar className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
      <Input type="date" value={startDate} onChange={(e) => onStartChange(e.target.value)} className="h-9 w-[124px] rounded-none border-border/70 px-2 text-xs" />
      <span className="shrink-0 text-[11px] text-muted-foreground">/</span>
      <Input type="date" value={endDate} onChange={(e) => onEndChange(e.target.value)} className="h-9 w-[124px] rounded-none border-border/70 px-2 text-xs" />
      <Button onClick={onApply} disabled={loading} size="sm" className="h-9 shrink-0 rounded-none px-3 text-xs">
        {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}
        OK
      </Button>
      {onExport && (
        <Button variant="outline" size="sm" onClick={onExport} className="h-9 shrink-0 rounded-none border-border/70 px-3 text-xs">
          <Download className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}

function PageHeader({
  title,
  children,
}: {
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <ShellPageHeader
      title={title}
      actions={children}
      className="border-border/70 bg-background/95"
      badges={<Building2 className="h-5 w-5" />}
    />
  );
}

function DataGrid({
  columns,
  data,
}: {
  columns: { key: string; label: string; format?: (v: any) => string; align?: string; width?: string }[];
  data: any[];
}) {
  if (!data || data.length === 0) {
    return <p className="py-8 text-center text-muted-foreground">Tidak ada data untuk periode ini.</p>;
  }

  return (
    <div className="overflow-hidden border border-border/70 bg-background">
      <div
        className="hidden border-b border-border/70 bg-muted/20 px-4 py-3 md:grid"
        style={{ gridTemplateColumns: columns.map((col) => col.width || "minmax(0,1fr)").join(" ") }}
      >
        {columns.map((col) => (
          <div
            key={col.key}
            className={cn("px-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground", col.align === "right" && "text-right")}
            style={{ fontFamily: REPORT_MONO_FAMILY }}
          >
            {col.label}
          </div>
        ))}
      </div>
      <div className="divide-y divide-dashed divide-border/70">
        {data.map((row, i) => (
          <div
            key={i}
            className="grid gap-3 px-4 py-3 md:items-center"
            style={{ gridTemplateColumns: columns.map((col) => col.width || "minmax(0,1fr)").join(" ") }}
          >
            {columns.map((col) => (
              <div key={col.key} className={cn("min-w-0 px-2", col.align === "right" && "md:text-right")}>
                <div className="mb-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground md:hidden" style={{ fontFamily: REPORT_MONO_FAMILY }}>
                  {col.label}
                </div>
                <div className="truncate text-sm">
                  {renderCellBadge(row[col.key], col.key) ?? (col.format ? col.format(row[col.key]) : row[col.key] != null ? String(row[col.key]) : "-")}
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function KPICard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background px-4 py-4">
      <p className="text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground" style={{ fontFamily: REPORT_MONO_FAMILY }}>{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

export default function ReportBPJSPage() {
  const [tab, setTab] = useState("daily");
  const [startDate, setStartDate] = useState(getDefaultStart());
  const [endDate, setEndDate] = useState(getDefaultEnd());
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    setPageTitle("Laporan BPJS");
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      switch (tab) {
        case "daily": res = await reportBpjsApi.daily(startDate, endDate); break;
        case "sep": res = await reportBpjsApi.sep(startDate, endDate); break;
        case "surat-kontrol": res = await reportBpjsApi.suratKontrol(startDate, endDate); break;
        case "antrean": res = await reportBpjsApi.antrean(startDate, endDate); break;
        case "eklaim": res = await reportBpjsApi.eklaim(startDate, endDate); break;
        case "by-poli": res = await reportBpjsApi.byPoli(startDate, endDate); break;
      }
      setData(res?.data || null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [tab, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const exportExcel = () => reportBpjsApi.exportExcel(tab, startDate, endDate);
  const rows: any[] = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
  const summary = data?.summary || null;

  const navItems = [
    { value: "daily", label: "Harian" },
    { value: "sep", label: "SEP" },
    { value: "surat-kontrol", label: "Surat Kontrol" },
    { value: "antrean", label: "Antrean" },
    { value: "eklaim", label: "E-Klaim" },
    { value: "by-poli", label: "Per Poli" },
  ];

  const bpjsKpis = [
    { label: "Tab", value: navItems.find((item) => item.value === tab)?.label || "-", hint: "" },
    { label: "Baris", value: formatNumber(rows.length), hint: "" },
    { label: "Periode", value: `${startDate} s/d ${endDate}`, hint: "" },
    { label: "Data", value: summary ? "Summary" : "Rows", hint: "" },
  ];

  return (
    <PageShell>
      <PageContent className="space-y-4 px-4 pb-4 pt-4 md:px-6">
      <PageHeader title="Laporan BPJS">
        <DateFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} onApply={fetchData} onExport={exportExcel} loading={loading} />
      </PageHeader>
      <ReportKpiGrid items={bpjsKpis} />
      <InlineNav items={navItems} value={tab} onChange={setTab} />

      <div className="pt-2">
        {tab === "daily" && (
          <div className="space-y-4">
            <ReportPanel eyebrow="Trend" title="Kunjungan Harian">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={rows}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="tanggal" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 0, border: "1px solid #e5e7eb" }} />
                  <Bar dataKey="rawat_jalan" fill="#0f766e" name="RJ" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="rawat_inap" fill="#1d4ed8" name="RI" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="igd" fill="#dc2626" name="IGD" radius={[0, 0, 0, 0]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </BarChart>
              </ResponsiveContainer>
            </ReportPanel>
            <ReportPanel eyebrow="Data" title="Kunjungan">
              <DataGrid columns={[
                { key: "tanggal", label: "Tanggal", width: "1fr" },
                { key: "rawat_jalan", label: "RJ", align: "right", format: formatNumber },
                { key: "rawat_inap", label: "RI", align: "right", format: formatNumber },
                { key: "igd", label: "IGD", align: "right", format: formatNumber },
                { key: "total", label: "Total", align: "right", format: formatNumber },
              ]} data={rows} />
            </ReportPanel>
          </div>
        )}

        {tab === "sep" && (
          <ReportPanel eyebrow="Data" title="SEP">
            <DataGrid columns={[
              { key: "no_sep", label: "SEP", width: "1.2fr" },
              { key: "tgl_sep", label: "Tanggal", width: "0.9fr" },
              { key: "nama_pasien", label: "Pasien", width: "1.2fr" },
              { key: "jns_pelayanan", label: "Jenis", width: "0.7fr" },
              { key: "nama_poli", label: "Poli", width: "1fr" },
              { key: "nama_dpjp", label: "DPJP", width: "1.2fr" },
            ]} data={rows} />
          </ReportPanel>
        )}

        {tab === "surat-kontrol" && (
          <ReportPanel eyebrow="Data" title="Surat Kontrol">
            <DataGrid columns={[
              { key: "no_surat_kontrol", label: "Surat", width: "1.2fr" },
              { key: "tgl_rencana_kontrol", label: "Tgl", width: "0.9fr" },
              { key: "nama", label: "Pasien", width: "1.2fr" },
              { key: "nama_poli", label: "Poli", width: "1fr" },
              { key: "nama_dokter", label: "Dokter", width: "1.2fr" },
              { key: "status", label: "Status", width: "0.8fr" },
            ]} data={rows} />
          </ReportPanel>
        )}

        {tab === "antrean" && (
          <div className="space-y-4">
            <ReportPanel eyebrow="Trend" title="Antrean">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={rows}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="tanggal" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 0, border: "1px solid #e5e7eb" }} />
                  <Bar dataKey="total_booking" fill="#1d4ed8" name="Book" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="checkin" fill="#0f766e" name="Checkin" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="dilayani" fill="#d97706" name="Layan" radius={[0, 0, 0, 0]} />
                  <Bar dataKey="selesai" fill="#7c3aed" name="Selesai" radius={[0, 0, 0, 0]} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </BarChart>
              </ResponsiveContainer>
            </ReportPanel>
            <ReportPanel eyebrow="Data" title="Antrean">
              <DataGrid columns={[
                { key: "tanggal", label: "Tanggal", width: "1fr" },
                { key: "total_booking", label: "Booking", align: "right", format: formatNumber },
                { key: "checkin", label: "Check-in", align: "right", format: formatNumber },
                { key: "dilayani", label: "Dilayani", align: "right", format: formatNumber },
                { key: "selesai", label: "Selesai", align: "right", format: formatNumber },
              ]} data={rows} />
            </ReportPanel>
          </div>
        )}

        {tab === "eklaim" && (
          <div className="space-y-4">
            {summary && (
              <div className="grid gap-px bg-border/70 md:grid-cols-4">
                <KPICard label="Total Kasus" value={formatNumber(summary.total_kasus)} />
                <KPICard label="Total Tarif RS" value={formatCurrency(summary.total_tarif_rs)} />
                <KPICard label="Total INACBG" value={formatCurrency(summary.total_inacbg)} />
                <KPICard label="Total Selisih" value={formatCurrency(summary.total_selisih)} />
              </div>
            )}
            <ReportPanel eyebrow="Data" title="E-Klaim">
              <DataGrid columns={[
                { key: "no_sep", label: "SEP", width: "1.1fr" },
                { key: "nama_pasien", label: "Pasien", width: "1.2fr" },
                { key: "jenis_rawat", label: "Rawat", width: "0.8fr" },
                { key: "inacbg_code", label: "INACBG", width: "0.9fr" },
                { key: "total_tarif_rs", label: "Tarif RS", align: "right", format: formatCurrency },
                { key: "inacbg_tariff", label: "Tarif INACBG", align: "right", format: formatCurrency },
                { key: "selisih", label: "Selisih", align: "right", format: formatCurrency },
              ]} data={rows} />
            </ReportPanel>
          </div>
        )}

        {tab === "by-poli" && (
          <ReportPanel eyebrow="Data" title="Per Poli">
            <DataGrid columns={[
              { key: "kode_poli", label: "Kode", width: "0.8fr" },
              { key: "nama_poli", label: "Poli", width: "1.2fr" },
              { key: "jumlah", label: "Kunjungan", align: "right", format: formatNumber },
              { key: "sep_count", label: "Jumlah SEP", align: "right", format: formatNumber },
            ]} data={rows} />
          </ReportPanel>
        )}
      </div>
      </PageContent>
    </PageShell>
  );
}
