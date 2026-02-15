import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type {
  EKlaimLocal,
  OriginalRM,
  OriginalAnamnesis,
  OriginalPhysicalExam,
  OriginalDiagnosis,
  OriginalAssessmentPlan,
  OriginalDisposition,
  OriginalProcedureOrder,
  OriginalMedicineOrder,
} from '@/lib/api/eklaim-local';
import {
  ChevronRight,
  ChevronDown,
  Stethoscope,
  HeartPulse,
  ClipboardList,
  FlaskConical,
  ScanLine,
  Scissors,
  LogOut,
  Pill,
  CreditCard,
} from 'lucide-react';

interface RMTreeViewProps {
  detail: EKlaimLocal;
  originalRM: OriginalRM;
}

// ===== Tree Node Component =====
function TreeNode({
  icon,
  label,
  badge,
  badgeVariant = 'outline',
  level = 0,
  children,
  defaultOpen = false,
}: {
  icon?: React.ReactNode;
  label: string;
  badge?: string;
  badgeVariant?: 'default' | 'outline' | 'secondary' | 'destructive';
  level?: number;
  children?: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const hasChildren = !!children;

  return (
    <div className={cn('border-l', level > 0 ? 'ml-4 border-muted-foreground/20' : 'border-transparent')}>
      <button
        type="button"
        onClick={() => hasChildren && setOpen(!open)}
        className={cn(
          'flex items-center gap-2 w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors',
          hasChildren ? 'hover:bg-muted/50 cursor-pointer' : 'cursor-default',
          level === 0 ? 'font-medium' : '',
        )}
      >
        {hasChildren ? (
          open ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <span className="w-4" />
        )}
        {icon}
        <span className="flex-1 truncate">{label}</span>
        {badge && <Badge variant={badgeVariant} className="text-[10px] px-1.5 py-0">{badge}</Badge>}
      </button>
      {open && hasChildren && (
        <div className="pl-2">
          {children}
        </div>
      )}
    </div>
  );
}

// ===== Read-only field =====
function ReadField({ label, value, multiline }: { label: string; value?: string | number | null; multiline?: boolean }) {
  const displayValue = value === undefined || value === null || value === '' || value === 0 ? '-' : String(value);
  if (multiline && displayValue !== '-' && displayValue.length > 60) {
    return (
      <div className="space-y-0.5">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-xs whitespace-pre-wrap">{displayValue}</p>
      </div>
    );
  }
  return (
    <div className="space-y-0.5">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-xs font-medium">{displayValue}</p>
    </div>
  );
}

// ===== SEP Section =====
function SEPSection({ detail }: { detail: EKlaimLocal }) {
  const sep = detail.sep;
  if (!sep) return <p className="text-xs text-muted-foreground px-4 py-2">Data SEP tidak tersedia.</p>;

  return (
    <div className="px-4 py-2 space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ReadField label="No. SEP" value={sep.no_sep} />
        <ReadField label="No. Kartu" value={sep.no_kartu} />
        <ReadField label="Nama Pasien" value={sep.nama_pasien} />
        <ReadField label="Tgl SEP" value={sep.tgl_sep} />
        <ReadField label="Jns Pelayanan" value={sep.jns_pelayanan} />
        <ReadField label="Kelas Rawat Hak" value={sep.kls_rawat_hak} />
        <ReadField label="Poli" value={sep.nama_poli} />
        <ReadField label="DPJP" value={sep.nama_dpjp} />
        <ReadField label="Diagnosa Awal" value={`${sep.diag_awal || ''} - ${sep.nama_diagnosa || ''}`} />
        <ReadField label="No. MR" value={sep.no_mr} />
        <ReadField label="Tgl Lahir" value={sep.tgl_lahir} />
        <ReadField label="Jenis Kelamin" value={sep.jenis_kelamin} />
      </div>
    </div>
  );
}

// ===== Anamnesis Section =====
function AnamnesisSection({ data }: { data?: OriginalAnamnesis }) {
  if (!data) return <p className="text-xs text-muted-foreground px-4 py-2">Data anamnesis tidak tersedia.</p>;
  return (
    <div className="px-4 py-2 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ReadField label="Keluhan Utama" value={data.chief_complaint} multiline />
        <ReadField label="Riwayat Penyakit Sekarang" value={data.history_of_present_illness} multiline />
        <ReadField label="Riwayat Penyakit Dahulu" value={data.past_medical_history} multiline />
        <ReadField label="Riwayat Keluarga" value={data.family_history} multiline />
        <ReadField label="Alergi" value={data.allergies} />
        <ReadField label="Obat Yang Dikonsumsi" value={data.current_medications} multiline />
        <ReadField label="Riwayat Sosial" value={data.social_history} multiline />
        <ReadField label="Review of Systems" value={data.review_of_systems} multiline />
      </div>
    </div>
  );
}

// ===== Physical Exam Section =====
function PhysicalExamSection({ data }: { data?: OriginalPhysicalExam }) {
  if (!data) return <p className="text-xs text-muted-foreground px-4 py-2">Data pemeriksaan fisik tidak tersedia.</p>;
  return (
    <div className="px-4 py-2 space-y-4">
      {/* Vital Signs */}
      <div>
        <p className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">Tanda Vital</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <ReadField label="TD" value={data.blood_pressure || (data.systolic ? `${data.systolic}/${data.diastolic}` : undefined)} />
          <ReadField label="Nadi" value={data.heart_rate ? `${data.heart_rate} x/mnt` : undefined} />
          <ReadField label="RR" value={data.respiratory_rate ? `${data.respiratory_rate} x/mnt` : undefined} />
          <ReadField label="Suhu" value={data.temperature ? `${data.temperature} °C` : undefined} />
          <ReadField label="SpO2" value={data.oxygen_saturation ? `${data.oxygen_saturation}%` : undefined} />
          <ReadField label="BB" value={data.weight ? `${data.weight} kg` : undefined} />
          <ReadField label="TB" value={data.height ? `${data.height} cm` : undefined} />
          <ReadField label="BMI" value={data.bmi} />
        </div>
      </div>
      {/* General */}
      <div className="grid grid-cols-2 gap-3">
        <ReadField label="Keadaan Umum" value={data.general_condition} />
        <ReadField label="Kesadaran" value={data.consciousness} />
      </div>
      {/* Body Systems */}
      <div>
        <p className="text-[10px] font-medium text-muted-foreground mb-2 uppercase tracking-wider">Pemeriksaan Sistem Organ</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ReadField label="Kepala & Leher" value={data.head_neck} multiline />
          <ReadField label="Mata" value={data.eyes} multiline />
          <ReadField label="THT" value={data.ent} multiline />
          <ReadField label="Thorax" value={data.thorax} multiline />
          <ReadField label="Jantung" value={data.cardiac} multiline />
          <ReadField label="Paru" value={data.pulmonary} multiline />
          <ReadField label="Abdomen" value={data.abdomen} multiline />
          <ReadField label="Ekstremitas" value={data.extremities} multiline />
          <ReadField label="Neurologis" value={data.neurological} multiline />
          <ReadField label="Kulit" value={data.skin} multiline />
        </div>
      </div>
    </div>
  );
}

// ===== Diagnoses Section =====
function DiagnosesSection({ data }: { data?: OriginalDiagnosis[] }) {
  if (!data || data.length === 0) return <p className="text-xs text-muted-foreground px-4 py-2">Belum ada diagnosa.</p>;
  return (
    <div className="px-4 py-2 space-y-2">
      {data.map((d, i) => (
        <div key={d.id || i} className="flex items-center gap-3 p-2 rounded border bg-muted/30">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-purple-100 text-purple-800 text-xs font-medium shrink-0">
            {i + 1}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">
              <span className="font-mono text-purple-700">{d.icd10_code}</span>
              {' — '}
              {d.icd10_name}
            </p>
          </div>
          <Badge variant={d.type === 'primary' ? 'default' : 'outline'} className="text-[10px] shrink-0">
            {d.type === 'primary' ? 'Primer' : d.type === 'secondary' ? 'Sekunder' : 'Komplikasi'}
          </Badge>
        </div>
      ))}
    </div>
  );
}

// ===== Assessment Section =====
function AssessmentSection({ data }: { data?: OriginalAssessmentPlan }) {
  if (!data) return <p className="text-xs text-muted-foreground px-4 py-2">Data assessment tidak tersedia.</p>;
  return (
    <div className="px-4 py-2 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ReadField label="Penilaian Klinis" value={data.clinical_assessment} multiline />
        <ReadField label="Prognosis" value={data.prognosis} />
        <ReadField label="Rencana Terapi" value={data.treatment_plan} multiline />
        <ReadField label="Rencana Obat" value={data.medication_plan} multiline />
        <ReadField label="Rencana Diet" value={data.diet_plan} multiline />
        <ReadField label="Rencana Aktivitas" value={data.activity_plan} multiline />
        <ReadField label="Rencana Edukasi" value={data.education_plan} multiline />
        <ReadField label="Rencana Monitoring" value={data.monitoring_plan} multiline />
      </div>
    </div>
  );
}

// ===== Disposition Section =====
function DispositionSection({ data }: { data?: OriginalDisposition }) {
  if (!data) return <p className="text-xs text-muted-foreground px-4 py-2">Data disposisi tidak tersedia.</p>;
  const typeLabels: Record<string, string> = {
    pulang: 'Pulang', rawat_inap: 'Rawat Inap', rujuk: 'Rujuk',
    meninggal: 'Meninggal', aps: 'Pulang Paksa', dod: 'DOA',
    discharge: 'Dipulangkan', transfer: 'Dirujuk/Transfer', admitted: 'Rawat Inap',
    ama: 'Pulang Paksa (AMA)', death: 'Meninggal', dor: 'Pulang Atas Permintaan Sendiri',
  };
  return (
    <div className="px-4 py-2 space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ReadField label="Tipe Disposisi" value={typeLabels[data.disposition_type] || data.disposition_type} />
        <ReadField label="Status Pulang" value={data.discharge_status} />
        <ReadField label="Kondisi Pulang" value={data.discharge_condition} />
        <ReadField label="Instruksi Pulang" value={data.discharge_instruction} multiline />
        <ReadField label="Obat Pulang" value={data.discharge_medication} multiline />
        <ReadField label="Instruksi Follow-up" value={data.follow_up_instruction} multiline />
        {data.referral_facility && <ReadField label="Fasilitas Rujukan" value={data.referral_facility} />}
        {data.referral_reason && <ReadField label="Alasan Rujukan" value={data.referral_reason} multiline />}
      </div>
    </div>
  );
}

// ===== Lab/Radiology Orders Section =====
function ProcedureOrdersSection({ orders, type }: { orders?: OriginalProcedureOrder[]; type: 'lab' | 'radiology' | 'surgery' }) {
  if (!orders || orders.length === 0) {
    const labels = { lab: 'laboratorium', radiology: 'radiologi', surgery: 'operasi' };
    return <p className="text-xs text-muted-foreground px-4 py-2">Tidak ada order {labels[type]}.</p>;
  }
  return (
    <div className="px-4 py-2 space-y-3">
      {orders.map((order) => (
        <div key={order.id} className="border rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-medium">{order.order_number}</span>
              <Badge variant={order.status === 'completed' ? 'default' : 'outline'} className="text-[10px]">{order.status}</Badge>
              {order.is_critical && <Badge variant="destructive" className="text-[10px]">KRITIS</Badge>}
            </div>
            <span className="text-[10px] text-muted-foreground">{order.priority}</span>
          </div>

          {/* Items */}
          {order.items && order.items.length > 0 && (
            <div className="space-y-1">
              {order.items.map((item) => (
                <div key={item.id} className="text-xs">
                  <span className="font-medium">{item.procedure?.name || '-'}</span>
                  {item.results && item.results.length > 0 && (
                    <div className="ml-4 mt-1 space-y-0.5">
                      {item.results.map((r) => (
                        <div key={r.id} className="flex items-center gap-2 text-[11px]">
                          <span className="text-muted-foreground w-32 truncate">{r.procedure_parameter?.name || '-'}</span>
                          <span className={cn('font-mono font-medium', r.is_critical ? 'text-red-600' : r.is_high || r.is_low ? 'text-orange-600' : '')}>
                            {r.value || '-'}
                          </span>
                          <span className="text-muted-foreground">{r.procedure_parameter?.unit || ''}</span>
                          {r.procedure_parameter?.normal_text && (
                            <span className="text-muted-foreground">({r.procedure_parameter.normal_text})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Results summary */}
          {order.result_summary && <ReadField label="Hasil" value={order.result_summary} multiline />}
          {order.conclusion && <ReadField label="Kesimpulan" value={order.conclusion} multiline />}
          {order.suggestion && <ReadField label="Saran" value={order.suggestion} multiline />}
        </div>
      ))}
    </div>
  );
}

// ===== Medicine Orders Section =====
function MedicineOrdersSection({ orders }: { orders?: OriginalMedicineOrder[] }) {
  if (!orders || orders.length === 0) return <p className="text-xs text-muted-foreground px-4 py-2">Tidak ada resep obat.</p>;
  return (
    <div className="px-4 py-2 space-y-3">
      {orders.map((order) => (
        <div key={order.id} className="border rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-medium">{order.order_number}</span>
            <Badge variant={order.status === 'delivered' ? 'default' : 'outline'} className="text-[10px]">{order.status}</Badge>
            {order.prescription_type && <Badge variant="secondary" className="text-[10px]">{order.prescription_type}</Badge>}
          </div>
          {order.items && order.items.length > 0 && (
            <div className="space-y-1.5">
              {order.items.map((item, i) => (
                <div key={item.id} className="flex items-start gap-2 text-xs">
                  <span className="text-muted-foreground shrink-0">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{item.medicine?.name || '-'}</span>
                    {item.medicine?.strength && <span className="text-muted-foreground ml-1">{item.medicine.strength}</span>}
                    <div className="text-[11px] text-muted-foreground">
                      {[item.dosage, item.frequency, item.route].filter(Boolean).join(' • ')}
                      {item.quantity > 0 && ` — Qty: ${item.quantity} ${item.unit || ''}`}
                    </div>
                    {item.instructions && <p className="text-[11px] italic text-muted-foreground">{item.instructions}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
          {order.notes && <ReadField label="Catatan" value={order.notes} />}
        </div>
      ))}
    </div>
  );
}

// ===== Main Component =====
export default function RMTreeView({ detail, originalRM }: RMTreeViewProps) {
  const diagCount = originalRM.diagnoses?.length || 0;
  const labCount = originalRM.lab_orders?.length || 0;
  const radCount = originalRM.radiology_orders?.length || 0;
  const surgeryCount = originalRM.surgery_orders?.length || 0;
  const medsCount = originalRM.medicine_orders?.length || 0;

  return (
    <div className="space-y-1 py-2">
      {/* SEP */}
      <TreeNode
        icon={<CreditCard className="h-4 w-4 text-blue-600 shrink-0" />}
        label="Surat Eligibilitas Peserta (SEP)"
        badge={detail.no_sep}
        level={0}
      >
        <SEPSection detail={detail} />
      </TreeNode>

      <Separator className="my-2" />

      {/* Anamnesis */}
      <TreeNode
        icon={<Stethoscope className="h-4 w-4 text-blue-600 shrink-0" />}
        label="Anamnesis"
        badge={originalRM.anamnesis ? 'Ada' : undefined}
        level={0}
      >
        <AnamnesisSection data={originalRM.anamnesis} />
      </TreeNode>

      {/* Physical Exam */}
      <TreeNode
        icon={<HeartPulse className="h-4 w-4 text-red-600 shrink-0" />}
        label="Pemeriksaan Fisik & Tanda Vital"
        badge={originalRM.physical_examination ? 'Ada' : undefined}
        level={0}
      >
        <PhysicalExamSection data={originalRM.physical_examination} />
      </TreeNode>

      {/* Diagnoses */}
      <TreeNode
        icon={<ClipboardList className="h-4 w-4 text-purple-600 shrink-0" />}
        label="Diagnosa"
        badge={diagCount > 0 ? `${diagCount}` : undefined}
        level={0}
      >
        <DiagnosesSection data={originalRM.diagnoses} />
      </TreeNode>

      {/* Assessment & Plan */}
      <TreeNode
        icon={<ClipboardList className="h-4 w-4 text-indigo-600 shrink-0" />}
        label="Assessment & Rencana Terapi"
        badge={originalRM.assessment_plan ? 'Ada' : undefined}
        level={0}
      >
        <AssessmentSection data={originalRM.assessment_plan} />
      </TreeNode>

      <Separator className="my-2" />

      {/* Lab Results */}
      <TreeNode
        icon={<FlaskConical className="h-4 w-4 text-green-600 shrink-0" />}
        label="Hasil Laboratorium"
        badge={labCount > 0 ? `${labCount} order` : undefined}
        level={0}
      >
        <ProcedureOrdersSection orders={originalRM.lab_orders} type="lab" />
      </TreeNode>

      {/* Radiology Results */}
      <TreeNode
        icon={<ScanLine className="h-4 w-4 text-cyan-600 shrink-0" />}
        label="Hasil Radiologi"
        badge={radCount > 0 ? `${radCount} order` : undefined}
        level={0}
      >
        <ProcedureOrdersSection orders={originalRM.radiology_orders} type="radiology" />
      </TreeNode>

      {/* Surgery */}
      <TreeNode
        icon={<Scissors className="h-4 w-4 text-amber-600 shrink-0" />}
        label="Catatan Operasi"
        badge={surgeryCount > 0 ? `${surgeryCount} order` : undefined}
        level={0}
      >
        <ProcedureOrdersSection orders={originalRM.surgery_orders} type="surgery" />
      </TreeNode>

      <Separator className="my-2" />

      {/* Medicine Orders */}
      <TreeNode
        icon={<Pill className="h-4 w-4 text-pink-600 shrink-0" />}
        label="Resep / Order Obat"
        badge={medsCount > 0 ? `${medsCount} resep` : undefined}
        level={0}
      >
        <MedicineOrdersSection orders={originalRM.medicine_orders} />
      </TreeNode>

      {/* Disposition */}
      <TreeNode
        icon={<LogOut className="h-4 w-4 text-teal-600 shrink-0" />}
        label="Disposisi / Ringkasan Pulang"
        badge={originalRM.disposition ? 'Ada' : undefined}
        level={0}
      >
        <DispositionSection data={originalRM.disposition} />
      </TreeNode>
    </div>
  );
}
