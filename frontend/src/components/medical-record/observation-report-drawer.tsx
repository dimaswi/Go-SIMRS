import { useEffect, useMemo, useState } from "react";
import { differenceInCalendarDays, eachDayOfInterval, format, parseISO, subDays } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Droplets, Loader2, NotebookPen, Pill } from "lucide-react";
import { cpptApi, fluidBalanceApi, medicineOrdersApi, visitsApi } from "@/lib/api";
import type { CPPT, FluidBalance } from "@/lib/api/inpatient";
import type { MedicalRecordSummary } from "@/lib/api/medical-records";
import type { Visit } from "@/lib/api/visits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

type ObservationRange = "24h" | "3d" | "7d" | "30d" | "all";

interface ObservationReportDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  visitId: number;
  patientId?: number;
  patientName?: string;
  visitStartAt?: string;
  summary?: MedicalRecordSummary | null;
}

interface VitalTrendPoint {
  time: string;
  heart_rate: number | null;
  respiratory_rate: number | null;
  oxygen_saturation: number | null;
  temperature: number | null;
}

type VitalMetricKey = "heart_rate" | "respiratory_rate" | "oxygen_saturation" | "temperature";

interface FluidTrendPoint {
  time: string;
  intake: number;
  output: number;
  balance: number;
}

interface TimesheetTrendPoint {
  date: string;
  given: number;
  held: number;
  skipped: number;
  scheduled: number;
  total: number;
}

const RANGE_OPTIONS: Array<{ value: ObservationRange; label: string }> = [
  { value: "24h", label: "24 Jam" },
  { value: "3d", label: "3 Hari" },
  { value: "7d", label: "7 Hari" },
  { value: "30d", label: "30 Hari" },
  { value: "all", label: "Semua" },
];

const MAX_TIMESHEET_LOOKBACK_DAYS = 60;
const MAX_TIMESHEET_VISITS = 24;

const chunkArray = <T,>(input: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < input.length; index += size) {
    chunks.push(input.slice(index, index + size));
  }
  return chunks;
};

const uniqueVisitIds = (visits: Visit[]): number[] => {
  const ids = visits
    .map((visit) => visit.id)
    .filter((id) => Number.isFinite(id));
  return Array.from(new Set(ids));
};

const toNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const normalized = String(value).replace(",", ".").trim();
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const parseDateSafe = (value?: string) => {
  if (!value) return null;
  const parsed = parseISO(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const formatProfession = (value?: string) => {
  if (!value) return "-";
  const normalized = value.replace(/[_-]+/g, " ").trim();
  if (!normalized) return "-";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

const getPaddedDomain = (
  values: number[],
  fallbackMin: number,
  fallbackMax: number,
  padding: number
): [number, number] => {
  if (!values.length) return [fallbackMin, fallbackMax];
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  if (minValue === maxValue) return [minValue - padding, maxValue + padding];
  return [minValue - padding, maxValue + padding];
};

export function ObservationReportDrawer({
  open,
  onOpenChange,
  visitId,
  patientId,
  patientName,
  visitStartAt,
  summary,
}: ObservationReportDrawerProps) {
  const [range, setRange] = useState<ObservationRange>("all");
  const [loading, setLoading] = useState(false);
  const [cpptRecords, setCpptRecords] = useState<CPPT[]>([]);
  const [fluidRecords, setFluidRecords] = useState<FluidBalance[]>([]);
  const [timesheetTrend, setTimesheetTrend] = useState<TimesheetTrendPoint[]>([]);
  const [timesheetMedicineCount, setTimesheetMedicineCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hasHistoricalDataOutsideRange, setHasHistoricalDataOutsideRange] = useState(false);
  const [scopedVisitCount, setScopedVisitCount] = useState(1);
  const [timesheetVisitLimitInfo, setTimesheetVisitLimitInfo] = useState<{
    limited: boolean;
    used: number;
    total: number;
  }>({ limited: false, used: 0, total: 0 });

  const dateRange = useMemo(() => {
    const end = new Date();
    let start: Date;
    if (range === "24h") start = subDays(end, 1);
    else if (range === "3d") start = subDays(end, 2);
    else if (range === "7d") start = subDays(end, 6);
    else if (range === "30d") start = subDays(end, 29);
    else {
      const parsedStart = parseDateSafe(visitStartAt);
      start = parsedStart || subDays(end, 60);
    }

    const totalDays = Math.max(1, differenceInCalendarDays(end, start) + 1);
    const shouldLimitTimesheet = totalDays > MAX_TIMESHEET_LOOKBACK_DAYS;
    const timesheetStart = shouldLimitTimesheet
      ? subDays(end, MAX_TIMESHEET_LOOKBACK_DAYS - 1)
      : start;

    return {
      start,
      end,
      timesheetStart,
      totalDays,
      isTimesheetLimited: shouldLimitTimesheet,
      startDate: format(start, "yyyy-MM-dd"),
      endDate: format(end, "yyyy-MM-dd"),
      timesheetStartDate: format(timesheetStart, "yyyy-MM-dd"),
    };
  }, [range, visitStartAt]);

  useEffect(() => {
    if (!open || !visitId) return;

    let isMounted = true;

    const loadObservationData = async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const patientVisits = patientId
          ? await visitsApi.getAll({ patient_id: patientId }).catch(() => null)
          : null;
        const scopedVisitIds = patientVisits?.data?.length
          ? uniqueVisitIds(patientVisits.data)
          : [visitId];
        const visitIds = scopedVisitIds.length > 0 ? scopedVisitIds : [visitId];

        if (isMounted) {
          setScopedVisitCount(visitIds.length);
        }

        const requestParams =
          range === "all"
            ? undefined
            : {
                start_date: dateRange.startDate,
                end_date: dateRange.endDate,
              };

        const cpptData: CPPT[] = [];
        for (const idChunk of chunkArray(visitIds, 6)) {
          const cpptResults = await Promise.all(
            idChunk.map((scopedVisitId) => cpptApi.getAll(scopedVisitId, requestParams).catch(() => null))
          );
          for (const result of cpptResults) {
            if (result?.data?.data?.length) {
              cpptData.push(...result.data.data);
            }
          }
        }

        const fluidData: FluidBalance[] = [];
        for (const idChunk of chunkArray(visitIds, 6)) {
          const fluidResults = await Promise.all(
            idChunk.map((scopedVisitId) => fluidBalanceApi.getAll(scopedVisitId, requestParams).catch(() => null))
          );
          for (const result of fluidResults) {
            if (result?.data?.data?.length) {
              fluidData.push(...result.data.data);
            }
          }
        }

        const inRoomVisitIds: number[] = [];
        for (const idChunk of chunkArray(visitIds, 6)) {
          const orderResults = await Promise.all(
            idChunk.map((scopedVisitId) =>
              medicineOrdersApi
                .getAll({ source_visit_id: scopedVisitId, fulfillment_type: "in_room" })
                .catch(() => null)
            )
          );

          orderResults.forEach((result, index) => {
            const scopedVisitId = idChunk[index];
            const orders = Array.isArray(result?.data)
              ? result.data.filter((order) => order?.status !== "cancelled")
              : [];
            if (orders.length > 0) {
              inRoomVisitIds.push(scopedVisitId);
            }
          });
        }

        const limitedTimesheetVisitIds = inRoomVisitIds.slice(0, MAX_TIMESHEET_VISITS);
        if (isMounted) {
          setTimesheetVisitLimitInfo({
            limited: inRoomVisitIds.length > MAX_TIMESHEET_VISITS,
            used: limitedTimesheetVisitIds.length,
            total: inRoomVisitIds.length,
          });
        }

        const dayRange = eachDayOfInterval({ start: dateRange.timesheetStart, end: dateRange.end });
        const timesheetResults = limitedTimesheetVisitIds.length
          ? await Promise.all(
              dayRange.map(async (date) => {
                const rawDate = format(date, "yyyy-MM-dd");
                const dayEntries: Array<{ status: string; medicine_order_item_id?: number }> = [];
                const dayItemIds = new Set<number>();

                for (const idChunk of chunkArray(limitedTimesheetVisitIds, 6)) {
                  const perVisitDayResult = await Promise.all(
                    idChunk.map((scopedVisitId) =>
                      medicineOrdersApi.getTimesheet(scopedVisitId, rawDate).catch(() => null)
                    )
                  );
                  for (const result of perVisitDayResult) {
                    const entries = result?.data?.entries || [];
                    dayEntries.push(
                      ...entries.map((entry) => ({
                        status: entry.status,
                        medicine_order_item_id: entry.medicine_order_item_id,
                      }))
                    );
                    for (const entry of entries) {
                      if (Number.isFinite(entry.medicine_order_item_id)) {
                        dayItemIds.add(entry.medicine_order_item_id);
                      }
                    }

                    const items = result?.data?.items || [];
                    for (const item of items) {
                      if (Number.isFinite(item.order_item_id)) {
                        dayItemIds.add(item.order_item_id);
                      }
                    }
                  }
                }

                return {
                  date: rawDate,
                  entries: dayEntries,
                  itemIds: Array.from(dayItemIds),
                };
              })
            )
          : [];

        if (!isMounted) return;

        setCpptRecords(cpptData);
        setFluidRecords(fluidData);
        setTimesheetTrend(
          timesheetResults.map((item) => {
            const statusCount = {
              given: 0,
              held: 0,
              skipped: 0,
              scheduled: 0,
            };

            for (const entry of item.entries) {
              if (entry.status === "given") statusCount.given += 1;
              else if (entry.status === "held") statusCount.held += 1;
              else if (entry.status === "skipped") statusCount.skipped += 1;
              else statusCount.scheduled += 1;
            }

            const parsedDate = parseDateSafe(`${item.date}T00:00:00`);
            return {
              date: parsedDate
                ? format(parsedDate, "EEE dd/MM", { locale: localeId })
                : item.date,
              given: statusCount.given,
              held: statusCount.held,
              skipped: statusCount.skipped,
              scheduled: statusCount.scheduled,
              total: item.entries.length,
            };
          })
        );

        const uniqueTimesheetItemIds = new Set<number>();
        for (const day of timesheetResults) {
          for (const itemId of day.itemIds) {
            uniqueTimesheetItemIds.add(itemId);
          }
        }
        setTimesheetMedicineCount(uniqueTimesheetItemIds.size);

        const hasTimesheetData = timesheetResults.some((item) => item.entries.length > 0);
        const hasTimesheetItems = timesheetResults.some((item) => item.itemIds.length > 0);
        const hasDataInCurrentRange =
          cpptData.length > 0 || fluidData.length > 0 || hasTimesheetData || hasTimesheetItems;

        if (!hasDataInCurrentRange && range !== "all") {
          let historicalCpptCount = 0;
          let historicalFluidCount = 0;

          for (const idChunk of chunkArray(visitIds, 6)) {
            const [chunkCppt, chunkFluid] = await Promise.all([
              Promise.all(idChunk.map((scopedVisitId) => cpptApi.getAll(scopedVisitId).catch(() => null))),
              Promise.all(idChunk.map((scopedVisitId) => fluidBalanceApi.getAll(scopedVisitId).catch(() => null))),
            ]);

            historicalCpptCount += chunkCppt.reduce(
              (sum, item) => sum + (item?.data?.data?.length || 0),
              0
            );
            historicalFluidCount += chunkFluid.reduce(
              (sum, item) => sum + (item?.data?.data?.length || 0),
              0
            );
          }

          if (!isMounted) return;
          const hasAnyHistoricalData = historicalCpptCount > 0 || historicalFluidCount > 0;
          setHasHistoricalDataOutsideRange(hasAnyHistoricalData);
        } else {
          setHasHistoricalDataOutsideRange(false);
        }
      } catch {
        if (!isMounted) return;
        setErrorMessage("Data observasi tidak dapat dimuat saat ini.");
        setCpptRecords([]);
        setFluidRecords([]);
        setTimesheetTrend([]);
        setTimesheetMedicineCount(0);
        setHasHistoricalDataOutsideRange(false);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadObservationData();

    return () => {
      isMounted = false;
    };
  }, [
    open,
    visitId,
    dateRange.end,
    dateRange.endDate,
    dateRange.startDate,
    dateRange.timesheetStart,
    range,
  ]);

  const summaryVitals = useMemo(() => {
    const triage = summary?.triage;
    const physicalExam = summary?.physical_exam;

    const bloodPressure =
      physicalExam?.blood_pressure ||
      (physicalExam?.blood_pressure_systolic && physicalExam?.blood_pressure_diastolic
        ? `${physicalExam.blood_pressure_systolic}/${physicalExam.blood_pressure_diastolic}`
        : triage?.blood_pressure || "-");

    return {
      bloodPressure,
      heartRate: toNumber(physicalExam?.heart_rate) ?? toNumber(triage?.heart_rate),
      respiratoryRate: toNumber(physicalExam?.respiratory_rate) ?? toNumber(triage?.respiratory_rate),
      oxygenSaturation:
        toNumber(physicalExam?.oxygen_saturation) ?? toNumber(triage?.oxygen_saturation),
      temperature: toNumber(physicalExam?.temperature) ?? toNumber(triage?.temperature),
    };
  }, [summary]);

  const vitalTrendData = useMemo((): VitalTrendPoint[] => {
    const points = [...cpptRecords]
      .sort((a, b) => {
        const aTime = parseDateSafe(a.record_date)?.getTime() || 0;
        const bTime = parseDateSafe(b.record_date)?.getTime() || 0;
        return aTime - bTime;
      })
      .map((record) => {
        const recordDate = parseDateSafe(record.record_date);
        const hasMultipleDays = range !== "24h";
        const label = recordDate
          ? format(recordDate, hasMultipleDays ? "dd/MM HH:mm" : "HH:mm", { locale: localeId })
          : "-";
        const heartRate = toNumber(record.heart_rate);
        const respiratoryRate = toNumber(record.respiratory_rate);
        const oxygenSaturation = toNumber(record.oxygen_saturation);
        const temperature = toNumber(record.temperature);

        return {
          time: label,
          heart_rate: heartRate,
          respiratory_rate: respiratoryRate,
          oxygen_saturation: oxygenSaturation,
          temperature,
        };
      })
      .filter(
        (record) =>
          record.heart_rate !== null ||
          record.respiratory_rate !== null ||
          record.oxygen_saturation !== null ||
          record.temperature !== null
      );

    if (points.length > 0) return points;

    const hasSummaryVitals =
      summaryVitals.heartRate !== null ||
      summaryVitals.respiratoryRate !== null ||
      summaryVitals.oxygenSaturation !== null ||
      summaryVitals.temperature !== null;

    if (!hasSummaryVitals) return [];

    return [
      {
        time: "Terakhir",
        heart_rate: summaryVitals.heartRate,
        respiratory_rate: summaryVitals.respiratoryRate,
        oxygen_saturation: summaryVitals.oxygenSaturation,
        temperature: summaryVitals.temperature,
      },
    ];
  }, [cpptRecords, range, summaryVitals]);

  const fluidTrendData = useMemo((): FluidTrendPoint[] => {
    return [...fluidRecords]
      .sort((a, b) => {
        const aTime = parseDateSafe(a.record_date)?.getTime() || 0;
        const bTime = parseDateSafe(b.record_date)?.getTime() || 0;
        return aTime - bTime;
      })
      .map((record) => {
        const recordDate = parseDateSafe(record.record_date);
        const labelDate = recordDate
          ? format(recordDate, range === "24h" ? "HH:mm" : "dd/MM", { locale: localeId })
          : "-";
        return {
          time: `${labelDate} ${record.shift_type ? `(${record.shift_type})` : ""}`.trim(),
          intake: record.total_intake || 0,
          output: record.total_output || 0,
          balance: record.balance || 0,
        };
      });
  }, [fluidRecords, range]);

  const latestVitals = vitalTrendData[vitalTrendData.length - 1] || null;

  const totalIntake = fluidTrendData.reduce((sum, item) => sum + item.intake, 0);
  const totalOutput = fluidTrendData.reduce((sum, item) => sum + item.output, 0);
  const netFluid = totalIntake - totalOutput;

  const totalTimesheetSlots = timesheetTrend.reduce((sum, item) => sum + item.total, 0);
  const totalTimesheetGiven = timesheetTrend.reduce((sum, item) => sum + item.given, 0);
  const medicationAdherence =
    totalTimesheetSlots > 0 ? Math.round((totalTimesheetGiven / totalTimesheetSlots) * 100) : 0;
  const hasTimesheetData = timesheetTrend.some((item) => item.total > 0);

  const cpptTimeline = useMemo(() => {
    return [...cpptRecords]
      .sort((a, b) => {
        const aTime = parseDateSafe(a.record_date)?.getTime() || 0;
        const bTime = parseDateSafe(b.record_date)?.getTime() || 0;
        return bTime - aTime;
      })
      .slice(0, 10);
  }, [cpptRecords]);

  const vitalCharts = useMemo(() => {
    const getValues = (key: VitalMetricKey) =>
      vitalTrendData
        .map((point) => point[key])
        .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    return [
      {
        key: "heart_rate" as VitalMetricKey,
        title: "Nadi",
        unit: "x/menit",
        color: "#2563eb",
        domain: getPaddedDomain(getValues("heart_rate"), 40, 140, 10),
      },
      {
        key: "respiratory_rate" as VitalMetricKey,
        title: "RR",
        unit: "x/menit",
        color: "#059669",
        domain: getPaddedDomain(getValues("respiratory_rate"), 8, 40, 4),
      },
      {
        key: "oxygen_saturation" as VitalMetricKey,
        title: "SpO2",
        unit: "%",
        color: "#7c3aed",
        domain: getPaddedDomain(getValues("oxygen_saturation"), 85, 100, 2),
      },
      {
        key: "temperature" as VitalMetricKey,
        title: "Suhu",
        unit: "C",
        color: "#dc2626",
        domain: getPaddedDomain(getValues("temperature"), 34, 42, 0.5),
      },
    ];
  }, [vitalTrendData]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-screen max-w-[100vw] p-0 sm:w-[80vw] sm:max-w-[80vw]">
        <SheetHeader className="border-b bg-muted/30 px-4 py-3">
          <div className="pr-10">
            <SheetTitle className="text-base font-semibold">Laporan Observasi</SheetTitle>
            <SheetDescription>
              Tren perkembangan pasien {patientName ? `- ${patientName}` : ""}
            </SheetDescription>
          </div>
        </SheetHeader>

        <div className="h-[calc(100vh-80px)] overflow-y-auto p-4">
          <div className="mb-4 flex flex-wrap gap-2">
            {RANGE_OPTIONS.map((option) => (
              <Button
                key={option.value}
                type="button"
                size="sm"
                variant={range === option.value ? "default" : "outline"}
                className="h-8 rounded-none"
                onClick={() => setRange(option.value)}
              >
                {option.label}
              </Button>
            ))}
          </div>

          {hasHistoricalDataOutsideRange && (
            <Card className="mb-4 rounded-none border-amber-300 bg-amber-50 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm text-amber-800">
                  Ada data observasi di luar periode ini. Pilih periode lebih panjang atau tampilkan semua data.
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8 rounded-none border-amber-500 text-amber-800"
                  onClick={() => setRange("all")}
                >
                  Tampilkan Semua
                </Button>
              </div>
            </Card>
          )}

          {range === "all" && dateRange.isTimesheetLimited && (
            <p className="mb-4 text-xs text-muted-foreground">
              Grafik status pemberian obat dibatasi {MAX_TIMESHEET_LOOKBACK_DAYS} hari terakhir untuk menjaga performa.
            </p>
          )}

          <p className="mb-4 text-xs text-muted-foreground">
            Scope data: {patientId ? `Semua kunjungan pasien (RM), total ${scopedVisitCount} kunjungan` : "Kunjungan aktif"}.
          </p>

          {loading && (
            <div className="flex h-48 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!loading && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                <Card className="rounded-none p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">TTV Terakhir</p>
                    <Activity className="h-4 w-4 text-primary" />
                  </div>
                  <div className="space-y-1 text-sm">
                    <p>TD: {summaryVitals.bloodPressure || "-"}</p>
                    <p>N: {latestVitals?.heart_rate ?? "-"} x/menit</p>
                    <p>RR: {latestVitals?.respiratory_rate ?? "-"} x/menit</p>
                    <p>SpO2: {latestVitals?.oxygen_saturation ?? "-"}%</p>
                    <p>Suhu: {latestVitals?.temperature ?? "-"} C</p>
                  </div>
                </Card>

                <Card className="rounded-none p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Neraca Cairan</p>
                    <Droplets className="h-4 w-4 text-primary" />
                  </div>
                  <div className="space-y-1 text-sm">
                    <p>Intake: {totalIntake.toLocaleString("id-ID")} ml</p>
                    <p>Output: {totalOutput.toLocaleString("id-ID")} ml</p>
                    <p
                      className={cn(
                        "font-semibold",
                        netFluid >= 0 ? "text-emerald-600" : "text-red-600"
                      )}
                    >
                      Balance: {netFluid.toLocaleString("id-ID")} ml
                    </p>
                  </div>
                </Card>

                <Card className="rounded-none p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Kepatuhan Obat</p>
                    <Pill className="h-4 w-4 text-primary" />
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="text-lg font-semibold">{medicationAdherence}%</p>
                    <p>Obat terjadwal: {timesheetMedicineCount}</p>
                    <p>Diberikan (slot): {totalTimesheetGiven}</p>
                    <p>Total slot: {totalTimesheetSlots}</p>
                  </div>
                </Card>

                <Card className="rounded-none p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">Catatan CPPT</p>
                    <NotebookPen className="h-4 w-4 text-primary" />
                  </div>
                  <div className="space-y-1 text-sm">
                    <p className="text-lg font-semibold">{cpptRecords.length}</p>
                    <p>Periode: {RANGE_OPTIONS.find((item) => item.value === range)?.label}</p>
                    <p>
                      Rentang: {range === "all" ? "semua data" : `${dateRange.startDate} s/d ${dateRange.endDate}`}
                    </p>
                  </div>
                </Card>
              </div>

              <Card className="rounded-none p-3">
                <p className="mb-3 text-sm font-semibold">Grafik Tanda Vital</p>
                {vitalTrendData.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
                    {vitalCharts.map((chart) => (
                      <div key={chart.key} className="rounded-none border p-3">
                        <p className="mb-2 text-xs font-medium text-muted-foreground">
                          {chart.title} ({chart.unit})
                        </p>
                        <div className="h-44">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={vitalTrendData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                              <XAxis dataKey="time" minTickGap={24} />
                              <YAxis domain={chart.domain} />
                              <Tooltip
                                formatter={(value: unknown) => {
                                  const numericValue = typeof value === "number" ? value : Number(value);
                                  const safeValue = Number.isFinite(numericValue) ? numericValue : 0;
                                  return [`${safeValue} ${chart.unit}`, chart.title];
                                }}
                              />
                              <Line
                                type="monotone"
                                dataKey={chart.key}
                                name={chart.title}
                                stroke={chart.color}
                                strokeWidth={2}
                                dot={false}
                                connectNulls
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Belum ada data vital sign pada periode ini.</p>
                )}
              </Card>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Card className="rounded-none p-3">
                  <p className="mb-3 text-sm font-semibold">Tren Intake/Output Cairan</p>
                  {fluidTrendData.length > 0 ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={fluidTrendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="time" minTickGap={20} />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="intake" name="Intake" fill="#0ea5e9" radius={[2, 2, 0, 0]} />
                          <Bar dataKey="output" name="Output" fill="#f97316" radius={[2, 2, 0, 0]} />
                          <Line
                            type="monotone"
                            dataKey="balance"
                            name="Balance"
                            stroke="#16a34a"
                            strokeWidth={2}
                            dot={false}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Belum ada data fluid balance.</p>
                  )}
                </Card>

                <Card className="rounded-none p-3">
                  <p className="mb-3 text-sm font-semibold">Status Pemberian Obat</p>
                  {hasTimesheetData ? (
                    <div className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={timesheetTrend}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="given" stackId="status" name="Diberikan" fill="#16a34a" />
                          <Bar dataKey="held" stackId="status" name="Ditunda" fill="#f59e0b" />
                          <Bar dataKey="skipped" stackId="status" name="Dilewati" fill="#ef4444" />
                          <Bar dataKey="scheduled" stackId="status" name="Terjadwal" fill="#94a3b8" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Belum ada data timesheet obat pada periode ini.
                      {range === "all" && dateRange.isTimesheetLimited
                        ? ` Grafik dibatasi mulai ${dateRange.timesheetStartDate}.`
                        : ""}
                    </p>
                  )}
                  {timesheetVisitLimitInfo.limited && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Sumber timesheet dibatasi {timesheetVisitLimitInfo.used} dari {timesheetVisitLimitInfo.total} kunjungan untuk menjaga performa.
                    </p>
                  )}
                </Card>
              </div>

              <Card className="rounded-none p-3">
                <p className="mb-3 text-sm font-semibold">Timeline CPPT Terbaru</p>
                {cpptTimeline.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Belum ada catatan CPPT.</p>
                ) : (
                  <div className="space-y-2">
                    {cpptTimeline.map((record) => {
                      const recordDate = parseDateSafe(record.record_date);
                      return (
                        <div key={record.id} className="rounded-none border p-3">
                          <div className="mb-1 flex flex-wrap items-center gap-2">
                            <Badge variant="outline" className="rounded-none">
                              {formatProfession(record.profession)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {recordDate
                                ? format(recordDate, "dd MMM yyyy HH:mm", { locale: localeId })
                                : "Waktu tidak tersedia"}
                            </span>
                          </div>
                          <div className="space-y-1 text-sm">
                            {record.subjective && <p><span className="font-medium">S:</span> {record.subjective}</p>}
                            {record.objective && <p><span className="font-medium">O:</span> {record.objective}</p>}
                            {record.assessment && <p><span className="font-medium">A:</span> {record.assessment}</p>}
                            {record.plan && <p><span className="font-medium">P:</span> {record.plan}</p>}
                            {!record.subjective && !record.objective && !record.assessment && !record.plan && (
                              <p className="text-muted-foreground">Catatan kosong.</p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

              {errorMessage && (
                <p className="text-sm text-red-600">{errorMessage}</p>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
