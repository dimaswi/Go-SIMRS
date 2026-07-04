import { useCallback, useEffect, useState } from "react";
import { setPageTitle } from "@/lib/page-title";
import { reportVisitsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Calendar, Download, Loader2 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
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

const COLORS = ["#3b82f6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

const formatNumber = (v: number) => {
  if (v == null || Number.isNaN(Number(v))) return "-";
  return new Intl.NumberFormat("id-ID").format(Number(v));
};

const formatPercent = (v: number) => {
  if (v == null || Number.isNaN(Number(v))) return "-";
  return `${Number(v).toFixed(1)}%`;
};

function renderCellBadge(value: string | number | null | undefined, key: string) {
  const text = value == null ? "-" : String(value);
  const normalized = text.toLowerCase();
  const titleized = text
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

  if (key === "service_type") return <Badge variant="outline" className="rounded-none">{titleized}</Badge>;
  if (key === "metode_bayar") {
    if (normalized.includes("bpjs")) return <Badge variant="secondary" className="rounded-none border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-50">BPJS</Badge>;
    return <Badge variant="secondary" className="rounded-none">Umum</Badge>;
  }
  if (key === "kategori") return <Badge variant="secondary" className="rounded-none">{text}</Badge>;
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
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <ShellPageHeader
      title={title}
      actions={children}
      className="border-border/70 bg-background/95"
      badges={icon}
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

export default function ReportVisitsPage() {
  const [tab, setTab] = useState("daily");
  const [startDate, setStartDate] = useState(getDefaultStart());
  const [endDate, setEndDate] = useState(getDefaultEnd());
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    setPageTitle("Laporan Kunjungan & Pasien");
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      let res;
      switch (tab) {
        case "daily": res = await reportVisitsApi.daily(startDate, endDate); break;
        case "by-room": res = await reportVisitsApi.byRoom(startDate, endDate); break;
        case "by-doctor": res = await reportVisitsApi.byDoctor(startDate, endDate); break;
        case "demographics": res = await reportVisitsApi.demographics(startDate, endDate); break;
        case "regions": res = await reportVisitsApi.regions(startDate, endDate); break;
        case "top-diagnoses": res = await reportVisitsApi.topDiagnoses(startDate, endDate); break;
        case "new-vs-old": res = await reportVisitsApi.newVsOld(startDate, endDate); break;
        case "payment-methods": res = await reportVisitsApi.paymentMethods(startDate, endDate); break;
        case "referrals": res = await reportVisitsApi.referrals(startDate, endDate); break;
      }
      setData(res?.data?.data || []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [tab, startDate, endDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const exportExcel = () => reportVisitsApi.exportExcel(tab, startDate, endDate);

  const navItems = [
    { value: "daily", label: "Harian" },
    { value: "by-room", label: "Per Poli" },
    { value: "by-doctor", label: "Per Dokter" },
    { value: "demographics", label: "Demografi" },
    { value: "regions", label: "Wilayah" },
    { value: "top-diagnoses", label: "Diagnosa" },
    { value: "new-vs-old", label: "Baru vs Lama" },
    { value: "payment-methods", label: "Cara Bayar" },
    { value: "referrals", label: "Rujukan" },
  ];

  const normalizedData = Array.isArray(data)
    ? data.map((row: any) => ({
        ...row,
        service_type:
          row?.service_type === "rawat_jalan" ? "Rawat Jalan"
            : row?.service_type === "rawat_inap" ? "Rawat Inap"
              : row?.service_type === "gawat_darurat" ? "Gawat Darurat"
                : row?.service_type,
        nilai: row?.nilai === "Ã¢â€°Â¥ 65 tahun" || row?.nilai === "â‰¥ 65 tahun" ? "65+ tahun" : row?.nilai,
      }))
    : [];

  const demographicsGender = normalizedData.filter((r: any) => r.kategori === "Jenis Kelamin").map((r: any) => ({ name: r.nilai, value: Number(r.jumlah) || 0 }));
  const demographicsAge = normalizedData.filter((r: any) => r.kategori === "Kelompok Umur").map((r: any) => ({ name: r.nilai, value: Number(r.jumlah) || 0 }));
  const demographicsPayment = normalizedData.filter((r: any) => r.kategori === "Metode Pembayaran").map((r: any) => ({ name: r.nilai, value: Number(r.jumlah) || 0 }));

  const totalRows = normalizedData.length;
  const totalVisitCount = normalizedData.reduce((sum: number, row: any) => {
    const directValue = Number(row?.total ?? row?.jumlah ?? 0);
    return !Number.isNaN(directValue) && directValue > 0 ? sum + directValue : sum;
  }, 0);

  const visitKpis = [
    { label: "Tab", value: navItems.find((item) => item.value === tab)?.label || "-", hint: "" },
    { label: "Baris", value: formatNumber(totalRows), hint: "" },
    { label: "Total", value: formatNumber(totalVisitCount), hint: "" },
    { label: "Periode", value: `${startDate} s/d ${endDate}`, hint: "" },
  ];

  return (
    <PageShell>
      <PageContent className="space-y-4 px-4 pb-4 pt-4 md:px-6">
      <PageHeader icon={<TrendingUp className="h-5 w-5" />} title="Laporan Kunjungan & Pasien">
        <DateFilter startDate={startDate} endDate={endDate} onStartChange={setStartDate} onEndChange={setEndDate} onApply={fetchData} onExport={exportExcel} loading={loading} />
      </PageHeader>
      <ReportKpiGrid items={visitKpis} />
      <InlineNav items={navItems} value={tab} onChange={setTab} />

      <div className="pt-2">
        {tab === "daily" && (
          <div className="space-y-4">
            <ReportPanel eyebrow="Trend" title="Tren Harian">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={normalizedData}>
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
            <ReportPanel eyebrow="Data" title="Kunjungan Harian">
              <DataGrid
                columns={[
                  { key: "tanggal", label: "Tanggal", width: "1.1fr" },
                  { key: "rawat_jalan", label: "RJ", align: "right", format: formatNumber },
                  { key: "rawat_inap", label: "RI", align: "right", format: formatNumber },
                  { key: "igd", label: "IGD", align: "right", format: formatNumber },
                  { key: "total", label: "Total", align: "right", format: formatNumber },
                ]}
                data={normalizedData}
              />
            </ReportPanel>
          </div>
        )}

        {tab === "by-room" && (
          <ReportPanel eyebrow="Data" title="Per Poli">
            <DataGrid
              columns={[
                { key: "kode_ruangan", label: "Kode", width: "0.8fr" },
                { key: "nama_ruangan", label: "Poli", width: "1.3fr" },
                { key: "service_type", label: "Layanan", width: "1fr" },
                { key: "jumlah", label: "Total", align: "right", format: formatNumber },
                { key: "baru", label: "Baru", align: "right", format: formatNumber },
                { key: "lama", label: "Lama", align: "right", format: formatNumber },
              ]}
              data={normalizedData}
            />
          </ReportPanel>
        )}

        {tab === "by-doctor" && (
          <ReportPanel eyebrow="Data" title="Per Dokter">
            <DataGrid
              columns={[
                { key: "nama_dokter", label: "Dokter", width: "1.4fr" },
                { key: "spesialisasi", label: "Spesialisasi", width: "1fr" },
                { key: "jumlah", label: "Total", align: "right", format: formatNumber },
                { key: "rawat_jalan", label: "Rajal", align: "right", format: formatNumber },
                { key: "rawat_inap", label: "Ranap", align: "right", format: formatNumber },
                { key: "igd", label: "IGD", align: "right", format: formatNumber },
              ]}
              data={normalizedData}
            />
          </ReportPanel>
        )}

        {tab === "demographics" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <ReportPanel eyebrow="Mix" title="Jenis Kelamin" contentClassName="pt-4">
                  {demographicsGender.length > 0 ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={demographicsGender} cx="50%" cy="50%" innerRadius={42} outerRadius={64} dataKey="value" nameKey="name">
                          {demographicsGender.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 0, border: "1px solid #e5e7eb" }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <p className="py-4 text-center text-sm text-muted-foreground">Tidak ada data</p>}
              </ReportPanel>
              <ReportPanel eyebrow="Mix" title="Kelompok Umur" contentClassName="pt-4">
                  {demographicsAge.length > 0 ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={demographicsAge}>
                        <CartesianGrid strokeDasharray="2 4" stroke="#e5e7eb" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                        <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                        <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 0, border: "1px solid #e5e7eb" }} />
                        <Bar dataKey="value" fill="#0f766e" name="Jumlah" radius={[0, 0, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <p className="py-4 text-center text-sm text-muted-foreground">Tidak ada data</p>}
              </ReportPanel>
              <ReportPanel eyebrow="Mix" title="Metode Pembayaran" contentClassName="pt-4">
                  {demographicsPayment.length > 0 ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie data={demographicsPayment} cx="50%" cy="50%" innerRadius={42} outerRadius={64} dataKey="value" nameKey="name">
                          {demographicsPayment.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                        <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 0, border: "1px solid #e5e7eb" }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <p className="py-4 text-center text-sm text-muted-foreground">Tidak ada data</p>}
              </ReportPanel>
            </div>
            <ReportPanel eyebrow="Data" title="Demografi">
              <DataGrid
                columns={[
                  { key: "kategori", label: "Kategori", width: "1fr" },
                  { key: "nilai", label: "Nilai", width: "1.2fr" },
                  { key: "jumlah", label: "Jumlah", align: "right", format: formatNumber },
                ]}
                data={normalizedData}
              />
            </ReportPanel>
          </div>
        )}

        {tab === "regions" && (
          <ReportPanel eyebrow="Data" title="Wilayah">
            <DataGrid
              columns={[
                { key: "provinsi", label: "Provinsi", width: "1fr" },
                { key: "kabupaten", label: "Kabupaten", width: "1fr" },
                { key: "kecamatan", label: "Kecamatan", width: "1fr" },
                { key: "jumlah", label: "Jumlah Pasien", align: "right", format: formatNumber },
              ]}
              data={normalizedData}
            />
          </ReportPanel>
        )}

        {tab === "top-diagnoses" && (
          <div className="space-y-4">
            <ReportPanel eyebrow="Trend" title="Top Diagnosa">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={normalizedData.slice(0, 15)} layout="vertical">
                  <CartesianGrid strokeDasharray="2 4" stroke="#e5e7eb" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis dataKey="kode_icd10" type="category" width={76} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 0, border: "1px solid #e5e7eb" }} />
                  <Bar dataKey="jumlah" fill="#1d4ed8" name="Jumlah" radius={[0, 0, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </ReportPanel>
            <ReportPanel eyebrow="Data" title="Top Diagnosa">
              <DataGrid
                columns={[
                  { key: "kode_icd10", label: "Kode", width: "0.7fr" },
                  { key: "nama", label: "Diagnosa", width: "1.6fr" },
                  { key: "jumlah", label: "Jumlah", align: "right", format: formatNumber },
                ]}
                data={normalizedData}
              />
            </ReportPanel>
          </div>
        )}

        {tab === "new-vs-old" && (
          <div className="space-y-4">
            <ReportPanel eyebrow="Trend" title="Baru vs Lama">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={normalizedData}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="tanggal" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                  <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 0, border: "1px solid #e5e7eb" }} />
                  <Line type="monotone" dataKey="pasien_baru" stroke="#1d4ed8" name="Baru" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="pasien_lama" stroke="#0f766e" name="Lama" strokeWidth={2} dot={false} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </LineChart>
              </ResponsiveContainer>
            </ReportPanel>
            <ReportPanel eyebrow="Data" title="Baru vs Lama">
              <DataGrid
                columns={[
                  { key: "tanggal", label: "Tanggal", width: "1fr" },
                  { key: "pasien_baru", label: "Pasien Baru", align: "right", format: formatNumber },
                  { key: "pasien_lama", label: "Pasien Lama", align: "right", format: formatNumber },
                  { key: "total", label: "Total", align: "right", format: formatNumber },
                ]}
                data={normalizedData}
              />
            </ReportPanel>
          </div>
        )}

        {tab === "payment-methods" && (
          <div className="space-y-4">
            <ReportPanel eyebrow="Mix" title="Cara Bayar">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={normalizedData} cx="50%" cy="50%" innerRadius={50} outerRadius={74} dataKey="jumlah" nameKey="metode_bayar">
                    {normalizedData.map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <RechartsTooltip contentStyle={{ fontSize: 11, borderRadius: 0, border: "1px solid #e5e7eb" }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </ReportPanel>
            <ReportPanel eyebrow="Data" title="Cara Bayar">
              <DataGrid
                columns={[
                  { key: "metode_bayar", label: "Cara Bayar", width: "1.2fr" },
                  { key: "jumlah", label: "Jumlah", align: "right", format: formatNumber },
                  { key: "persentase", label: "%", align: "right", format: formatPercent },
                ]}
                data={normalizedData}
              />
            </ReportPanel>
          </div>
        )}

        {tab === "referrals" && (
          <ReportPanel eyebrow="Data" title="Rujukan">
            <DataGrid
              columns={[
                { key: "asal_rujukan", label: "Asal", width: "1fr" },
                { key: "nama_rujukan", label: "Perujuk", width: "1.5fr" },
                { key: "jumlah", label: "Jumlah", align: "right", format: formatNumber },
              ]}
              data={normalizedData}
            />
          </ReportPanel>
        )}
      </div>
      </PageContent>
    </PageShell>
  );
}
