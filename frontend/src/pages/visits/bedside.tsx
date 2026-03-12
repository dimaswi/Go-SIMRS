import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import {
  bedsideApi,
  type BedsideSummary,
  type BedsideVitalSign,
  type BedsideMedicineOrderItem,
} from "@/lib/api";
import {
  ArrowLeft,
  User,
  Stethoscope,
  Pill,
  FlaskConical,
  Droplets,
  Activity,
  FileText,
  AlertTriangle,
  Clock,
  Loader2,
  ChevronRight,
  Heart,
  Thermometer,
  Wind,
  Gauge,
  Clipboard,
  ClipboardList,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPatientName } from "@/lib/print-utils";

export default function BedsideView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [data, setData] = useState<BedsideSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPageTitle("Bedside View");
    if (!id) return;

    const load = async () => {
      try {
        setLoading(true);
        const res = await bedsideApi.getSummary(Number(id));
        setData(res.data.data);
      } catch {
        toast({ variant: "destructive", title: "Error", description: "Gagal memuat data bedside" });
      } finally {
        setLoading(false);
      }
    };
    load();

    // Auto refresh every 60 seconds
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [id, toast]);

  // Extract helpers
  const patient = data?.visit?.registration?.patient;
  const doctor = data?.visit?.doctor;
  const room = data?.visit?.room;
  const bed = data?.visit?.bed;
  const vitals = data?.latest_vitals;

  // Calculate age from tanggal_lahir
  const patientAge = useMemo(() => {
    if (!patient?.tanggal_lahir) return null;
    const birth = new Date(patient.tanggal_lahir);
    const now = new Date();
    let age = now.getFullYear() - birth.getFullYear();
    if (now.getMonth() < birth.getMonth() || (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }, [patient?.tanggal_lahir]);

  // Flatten active medication items
  const activeMeds = useMemo(() => {
    if (!data?.medicine_orders) return [];
    const items: (BedsideMedicineOrderItem & { prescriber_name?: string })[] = [];
    for (const order of data.medicine_orders) {
      for (const item of (order.items || [])) {
        items.push({ ...item, prescriber_name: order.prescriber?.name });
      }
    }
    return items;
  }, [data?.medicine_orders]);

  // Flatten lab & radiology results from procedure orders
  const labResults = useMemo(() => {
    if (!data?.procedure_orders) return [];
    const results: { test_name: string; result: string; unit?: string; is_abnormal?: boolean; date: string }[] = [];
    for (const order of data.procedure_orders) {
      for (const item of (order.items || [])) {
        const cat = item.procedure?.category?.toLowerCase() || "";
        if (cat.includes("lab") || cat.includes("patologi")) {
          for (const r of (item.results || [])) {
            results.push({
              test_name: item.procedure?.name || "Unknown",
              result: r.result_value || r.result_text || "-",
              unit: r.unit,
              is_abnormal: r.is_abnormal,
              date: order.created_at,
            });
          }
        }
      }
    }
    return results;
  }, [data?.procedure_orders]);

  const radiologyResults = useMemo(() => {
    if (!data?.procedure_orders) return [];
    const results: { exam_name: string; result: string; date: string }[] = [];
    for (const order of data.procedure_orders) {
      for (const item of (order.items || [])) {
        const cat = item.procedure?.category?.toLowerCase() || "";
        if (cat.includes("radio") || cat.includes("imaging")) {
          const r = (item.results || [])[0];
          results.push({
            exam_name: item.procedure?.name || "Unknown",
            result: r?.result_text || r?.result_value || "-",
            date: order.created_at,
          });
        }
      }
    }
    return results;
  }, [data?.procedure_orders]);

  // Format blood pressure from vitals
  const formatBP = (v: BedsideVitalSign | null | undefined) => {
    if (!v) return undefined;
    if (v.systolic_bp && v.diastolic_bp) return `${v.systolic_bp}/${v.diastolic_bp}`;
    return undefined;
  };

  // Format GCS
  const formatGCS = (v: BedsideVitalSign | null | undefined) => {
    if (!v) return undefined;
    if (v.gcs_eye != null && v.gcs_verbal != null && v.gcs_motor != null) {
      return `E${v.gcs_eye}V${v.gcs_verbal}M${v.gcs_motor} (${v.gcs_eye + v.gcs_verbal + v.gcs_motor})`;
    }
    return undefined;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center h-screen gap-4">
        <AlertTriangle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground">Data tidak ditemukan</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Kembali
        </Button>
      </div>
    );
  }

  const genderLabel = patient?.jenis_kelamin === "L" ? "L" : "P";

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center gap-3 px-4 py-3 max-w-5xl mx-auto">
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold truncate">{formatPatientName(patient?.nama_lengkap, patient?.jenis_kelamin, patient?.status_perkawinan, patient?.tanggal_lahir) || "Pasien"}</h1>
              {patient?.jenis_kelamin && (
                <Badge variant={genderLabel === "L" ? "default" : "secondary"} className="shrink-0 text-xs">
                  {genderLabel}
                </Badge>
              )}
              {patient?.jenis_jaminan && (
                <Badge variant="outline" className="shrink-0 text-xs">{patient.jenis_jaminan}</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">
              RM: {patient?.no_rekam_medis || "-"} · {patientAge != null ? `${patientAge} thn` : "-"} · Hari ke-{data.days_of_stay}
            </p>
          </div>
          <Button variant="outline" size="sm" className="shrink-0" onClick={() => navigate(`/visits/${id}`)}>
            <FileText className="h-4 w-4 mr-1" /> Detail
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="h-[calc(100vh-4rem)]">
        <div className="max-w-5xl mx-auto p-4 space-y-4">
          {/* Row 1: Patient + Vital Signs */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Patient Info */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4 text-blue-500" />
                  Info Pasien
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
                <InfoRow label="Ruangan" value={bed?.room_unit?.room?.name || room?.name || "-"} />
                <InfoRow label="Kamar / Bed" value={`${bed?.room_unit?.name || "-"} / ${bed?.bed_number || "-"}`} />
                <InfoRow label="DPJP" value={doctor?.name || "-"} />
                <InfoRow
                  label="Tanggal Masuk"
                  value={data.visit.admission_time
                    ? new Date(data.visit.admission_time).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
                    : "-"}
                />
                <InfoRow label="Lama Rawat" value={`${data.days_of_stay} hari`} />
              </CardContent>
            </Card>

            {/* Vital Signs */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Activity className="h-4 w-4 text-red-500" />
                  Tanda Vital Terakhir
                </CardTitle>
              </CardHeader>
              <CardContent>
                {vitals ? (
                  <div className="grid grid-cols-2 gap-2">
                    <VitalBadge icon={<Heart className="h-3 w-3" />} label="Nadi" value={vitals.heart_rate} unit="bpm" color="red" />
                    <VitalBadge icon={<Gauge className="h-3 w-3" />} label="TD" value={formatBP(vitals)} unit="" color="blue" />
                    <VitalBadge icon={<Thermometer className="h-3 w-3" />} label="Suhu" value={vitals.temperature} unit="°C" color="orange" />
                    <VitalBadge icon={<Wind className="h-3 w-3" />} label="RR" value={vitals.respiratory_rate} unit="x/mnt" color="teal" />
                    <VitalBadge icon={<Droplets className="h-3 w-3" />} label="SpO2" value={vitals.oxygen_saturation} unit="%" color="purple" />
                    {formatGCS(vitals) && (
                      <VitalBadge icon={<Activity className="h-3 w-3" />} label="GCS" value={formatGCS(vitals)} unit="" color="gray" />
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Belum ada data vital</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Row 2: Allergies */}
          {data.allergies && data.allergies.length > 0 && (
            <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
              <CardContent className="py-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                  <span className="text-sm font-semibold text-red-700 dark:text-red-400">Alergi:</span>
                  {data.allergies.map((a, i) => (
                    <Badge key={i} variant="destructive" className="text-xs">
                      {a.snomed_display || a.snomed_code} ({a.criticality || a.category || "?"})
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Row 3: Diagnoses + Anamnesis/Assessment */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Diagnoses */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-green-500" />
                  Diagnosis
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.diagnoses && data.diagnoses.length > 0 ? (
                  <div className="space-y-1.5">
                    {data.diagnoses.map((d, i) => (
                      <div key={i} className="flex items-start gap-2 text-sm">
                        <Badge variant={d.type === "primary" ? "default" : "secondary"} className="text-[10px] shrink-0 mt-0.5">
                          {d.type === "primary" ? "Utama" : "Sekunder"}
                        </Badge>
                        <div>
                          <span className="font-mono text-xs text-muted-foreground">{d.icd_code}</span>
                          <span className="ml-1">{d.icd_description || d.description}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Belum ada diagnosis</p>
                )}
              </CardContent>
            </Card>

            {/* Anamnesis & Assessment Plan */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Clipboard className="h-4 w-4 text-indigo-500" />
                  Anamnesis & Rencana
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                {data.anamnesis ? (
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">Keluhan Utama</p>
                    <p>{data.anamnesis.chief_complaint || data.anamnesis.keluhan_utama || "-"}</p>
                    {(data.anamnesis.history_of_illness || data.anamnesis.riwayat_penyakit_sekarang) && (
                      <>
                        <p className="text-xs text-muted-foreground font-medium mt-2 mb-1">Riwayat Penyakit</p>
                        <p className="text-xs">{data.anamnesis.history_of_illness || data.anamnesis.riwayat_penyakit_sekarang}</p>
                      </>
                    )}
                  </div>
                ) : null}
                {data.assessment_plan ? (
                  <div>
                    <p className="text-xs text-muted-foreground font-medium mb-1">Rencana Terapi</p>
                    <p className="text-xs">{data.assessment_plan.plan || data.assessment_plan.rencana || "-"}</p>
                  </div>
                ) : null}
                {!data.anamnesis && !data.assessment_plan && (
                  <p className="text-muted-foreground text-center py-4">Belum ada data</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Row 4: Active Medications + Fluid Balance */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Active Medications */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Pill className="h-4 w-4 text-amber-500" />
                  Obat Aktif
                  {activeMeds.length > 0 && (
                    <Badge variant="outline" className="text-[10px] ml-auto">{activeMeds.length}</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activeMeds.length > 0 ? (
                  <div className="space-y-2">
                    {activeMeds.map((med, i) => (
                      <div key={i} className="text-sm border-l-2 border-amber-300 pl-2 py-0.5">
                        <p className="font-medium text-xs">{med.medicine?.name || "Obat"}</p>
                        <p className="text-xs text-muted-foreground">
                          {[med.dosage, med.frequency, med.route].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Tidak ada obat aktif</p>
                )}
              </CardContent>
            </Card>

            {/* Fluid Balance */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Droplets className="h-4 w-4 text-cyan-500" />
                  Balance Cairan (24 Jam)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.fluid_balance ? (
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-blue-50 dark:bg-blue-950/30 rounded p-2">
                      <p className="text-xs text-muted-foreground">Input</p>
                      <p className="text-lg font-bold text-blue-600">{data.fluid_balance.total_intake || 0}</p>
                      <p className="text-[10px] text-muted-foreground">mL</p>
                    </div>
                    <div className="bg-orange-50 dark:bg-orange-950/30 rounded p-2">
                      <p className="text-xs text-muted-foreground">Output</p>
                      <p className="text-lg font-bold text-orange-600">{data.fluid_balance.total_output || 0}</p>
                      <p className="text-[10px] text-muted-foreground">mL</p>
                    </div>
                    <div className={cn(
                      "rounded p-2",
                      (data.fluid_balance.balance ?? 0) >= 0
                        ? "bg-green-50 dark:bg-green-950/30"
                        : "bg-red-50 dark:bg-red-950/30"
                    )}>
                      <p className="text-xs text-muted-foreground">Balance</p>
                      <p className={cn(
                        "text-lg font-bold",
                        (data.fluid_balance.balance ?? 0) >= 0 ? "text-green-600" : "text-red-600"
                      )}>
                        {(data.fluid_balance.balance ?? 0) > 0 ? "+" : ""}{data.fluid_balance.balance || 0}
                      </p>
                      <p className="text-[10px] text-muted-foreground">mL</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Belum ada data cairan</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Row 5: CPPT (last 5) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-purple-500" />
                CPPT Terakhir
                <Button variant="ghost" size="sm" className="ml-auto text-xs h-6" onClick={() => navigate(`/visits/${id}`)}>
                  Lihat Semua <ChevronRight className="h-3 w-3 ml-1" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {data.cppts && data.cppts.length > 0 ? (
                <div className="space-y-3">
                  {data.cppts.map((cppt, i) => (
                    <div key={i} className="text-sm border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {cppt.created_at ? new Date(cppt.created_at).toLocaleString("id-ID", {
                            day: "numeric", month: "short", hour: "2-digit", minute: "2-digit"
                          }) : "-"}
                        </span>
                        <Badge variant="outline" className="text-[10px]">{cppt.profession || "Dokter"}</Badge>
                        <span className="text-xs font-medium ml-auto">{cppt.created_by?.name || "-"}</span>
                      </div>
                      <Separator className="my-1.5" />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-xs">
                        {cppt.subjective && (
                          <div><span className="font-semibold text-blue-600">S: </span>{cppt.subjective}</div>
                        )}
                        {cppt.objective && (
                          <div><span className="font-semibold text-green-600">O: </span>{cppt.objective}</div>
                        )}
                        {cppt.assessment && (
                          <div><span className="font-semibold text-amber-600">A: </span>{cppt.assessment}</div>
                        )}
                        {cppt.planning && (
                          <div><span className="font-semibold text-purple-600">P: </span>{cppt.planning}</div>
                        )}
                        {cppt.instruction && (
                          <div className="col-span-full"><span className="font-semibold text-red-600">I: </span>{cppt.instruction}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">Belum ada CPPT</p>
              )}
            </CardContent>
          </Card>

          {/* Row 6: Lab Results + Radiology */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Lab results */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FlaskConical className="h-4 w-4 text-emerald-500" />
                  Hasil Lab Terakhir
                </CardTitle>
              </CardHeader>
              <CardContent>
                {labResults.length > 0 ? (
                  <div className="space-y-1">
                    {labResults.map((lab, i) => (
                      <div key={i} className="flex items-center justify-between text-sm py-1 border-b last:border-0">
                        <span className="text-xs">{lab.test_name}</span>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "font-mono text-xs font-medium",
                            lab.is_abnormal ? "text-red-600 font-bold" : ""
                          )}>
                            {lab.result}
                          </span>
                          {lab.unit && <span className="text-[10px] text-muted-foreground">{lab.unit}</span>}
                          {lab.is_abnormal && <AlertTriangle className="h-3 w-3 text-red-500" />}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Tidak ada hasil lab</p>
                )}
              </CardContent>
            </Card>

            {/* Radiology */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileText className="h-4 w-4 text-sky-500" />
                  Hasil Radiologi
                </CardTitle>
              </CardHeader>
              <CardContent>
                {radiologyResults.length > 0 ? (
                  <div className="space-y-2">
                    {radiologyResults.map((rad, i) => (
                      <div key={i} className="text-sm border-l-2 border-sky-300 pl-2 py-0.5">
                        <p className="font-medium text-xs">{rad.exam_name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{rad.result}</p>
                        {rad.date && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(rad.date).toLocaleDateString("id-ID")}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">Tidak ada hasil radiologi</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Bottom spacer for mobile */}
          <div className="h-8" />
        </div>
      </ScrollArea>
    </div>
  );
}

// ===========================================================================
// Helper components
// ===========================================================================

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

const vitalColors: Record<string, string> = {
  red: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:text-red-400",
  blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400",
  orange: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/30 dark:text-orange-400",
  teal: "bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/30 dark:text-teal-400",
  purple: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:text-purple-400",
  gray: "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-950/30 dark:text-gray-400",
};

function VitalBadge({ icon, label, value, unit, color }: { icon: React.ReactNode; label: string; value?: string | number; unit: string; color: string }) {
  if (!value && value !== 0) return null;
  return (
    <div className={cn("rounded-lg border p-2 text-center", vitalColors[color] || vitalColors.gray)}>
      <div className="flex items-center justify-center gap-1 mb-0.5">
        {icon}
        <span className="text-[10px] uppercase font-medium">{label}</span>
      </div>
      <p className="text-lg font-bold leading-tight">{value}</p>
      {unit && <p className="text-[10px]">{unit}</p>}
    </div>
  );
}
