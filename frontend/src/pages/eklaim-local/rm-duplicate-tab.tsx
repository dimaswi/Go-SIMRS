import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  eklaimLocalApi,
} from '@/lib/api/eklaim-local';
import type {
  EKlaimRMDuplicate,
  EKlaimRMDiagnosis,
  EKlaimRMProcedure,
  EKlaimRMLabResult,
  EKlaimRMRadiologyResult,
  EKlaimRMSurgeryNote,
} from '@/lib/api/eklaim-local';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Save,
  Plus,
  X,
  Stethoscope,
  HeartPulse,
  FlaskConical,
  ScanLine,
  Scissors,
  ClipboardList,
  LogOut,
  DollarSign,
  Activity,
  RefreshCw,
} from 'lucide-react';
import { ICD10Combobox } from '@/components/ui/icd10-combobox';
import { ICD9CMCombobox } from '@/components/ui/icd9cm-combobox';

interface RMDuplicateTabProps {
  eklaimId: number;
  rmDuplicate: EKlaimRMDuplicate | null | undefined;
  onSaved: () => void;
}

export default function RMDuplicateTab({ eklaimId, rmDuplicate, onSaved }: RMDuplicateTabProps) {
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [dirty, setDirty] = useState(false);

  // ============ Anamnesis ============
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [historyOfPresentIllness, setHistoryOfPresentIllness] = useState('');
  const [pastMedicalHistory, setPastMedicalHistory] = useState('');
  const [familyHistory, setFamilyHistory] = useState('');
  const [allergies, setAllergies] = useState('');
  const [currentMedications, setCurrentMedications] = useState('');

  // ============ Physical Exam / Vital Signs ============
  const [generalCondition, setGeneralCondition] = useState('');
  const [consciousness, setConsciousness] = useState('');
  const [bloodPressure, setBloodPressure] = useState('');
  const [systolic, setSystolic] = useState(0);
  const [diastolic, setDiastolic] = useState(0);
  const [heartRate, setHeartRate] = useState('');
  const [respiratoryRate, setRespiratoryRate] = useState('');
  const [temperature, setTemperature] = useState('');
  const [oxygenSaturation, setOxygenSaturation] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [bmi, setBmi] = useState(0);

  // ============ Body Systems ============
  const [headNeck, setHeadNeck] = useState('');
  const [eyes, setEyes] = useState('');
  const [ent, setEnt] = useState('');
  const [thorax, setThorax] = useState('');
  const [cardiac, setCardiac] = useState('');
  const [pulmonary, setPulmonary] = useState('');
  const [abdomen, setAbdomen] = useState('');
  const [extremities, setExtremities] = useState('');
  const [neurological, setNeurological] = useState('');
  const [skin, setSkin] = useState('');

  // ============ Assessment & Plan ============
  const [clinicalAssessment, setClinicalAssessment] = useState('');
  const [prognosis, setPrognosis] = useState('');
  const [treatmentPlan, setTreatmentPlan] = useState('');
  const [medicationPlan, setMedicationPlan] = useState('');

  // ============ Disposition ============
  const [dispositionType, setDispositionType] = useState('');
  const [rmDischargeStatus, setRmDischargeStatus] = useState('');
  const [dischargeCondition, setDischargeCondition] = useState('');
  const [dischargeInstruction, setDischargeInstruction] = useState('');
  const [followUpInstruction, setFollowUpInstruction] = useState('');

  // ============ Diagnoses ============
  const [diagnoses, setDiagnoses] = useState<EKlaimRMDiagnosis[]>([]);

  // ============ Procedures ============
  const [procedures, setProcedures] = useState<EKlaimRMProcedure[]>([]);

  // ============ Lab Results ============
  const [labResults, setLabResults] = useState<EKlaimRMLabResult[]>([]);

  // ============ Radiology Results ============
  const [radiologyResults, setRadiologyResults] = useState<EKlaimRMRadiologyResult[]>([]);

  // ============ Surgery Notes ============
  const [surgeryNotes, setSurgeryNotes] = useState<EKlaimRMSurgeryNote[]>([]);

  // ============ Tarif (18-field E-Klaim breakdown) ============
  const [tarifProsedurNonBedah, setTarifProsedurNonBedah] = useState(0);
  const [tarifProsedurBedah, setTarifProsedurBedah] = useState(0);
  const [tarifKonsultasi, setTarifKonsultasi] = useState(0);
  const [tarifTenagaAhli, setTarifTenagaAhli] = useState(0);
  const [tarifKeperawatan, setTarifKeperawatan] = useState(0);
  const [tarifPenunjang, setTarifPenunjang] = useState(0);
  const [tarifRadiologi, setTarifRadiologi] = useState(0);
  const [tarifLaboratorium, setTarifLaboratorium] = useState(0);
  const [tarifPelayananDarah, setTarifPelayananDarah] = useState(0);
  const [tarifRehabilitasi, setTarifRehabilitasi] = useState(0);
  const [tarifKamar, setTarifKamar] = useState(0);
  const [tarifRawatIntensif, setTarifRawatIntensif] = useState(0);
  const [tarifObat, setTarifObat] = useState(0);
  const [tarifObatKronis, setTarifObatKronis] = useState(0);
  const [tarifObatKemoterapi, setTarifObatKemoterapi] = useState(0);
  const [tarifAlkes, setTarifAlkes] = useState(0);
  const [tarifBMHP, setTarifBMHP] = useState(0);
  const [tarifSewaAlat, setTarifSewaAlat] = useState(0);

  // ============ Init loading ============

  // ============ Load data from prop ============
  const populateFromRM = useCallback((rm: EKlaimRMDuplicate) => {
    // Anamnesis
    setChiefComplaint(rm.chief_complaint || '');
    setHistoryOfPresentIllness(rm.history_of_present_illness || '');
    setPastMedicalHistory(rm.past_medical_history || '');
    setFamilyHistory(rm.family_history || '');
    setAllergies(rm.allergies || '');
    setCurrentMedications(rm.current_medications || '');

    // Physical Exam
    setGeneralCondition(rm.general_condition || '');
    setConsciousness(rm.consciousness || '');
    setBloodPressure(rm.blood_pressure || '');
    setSystolic(rm.systolic || 0);
    setDiastolic(rm.diastolic || 0);
    setHeartRate(rm.heart_rate || '');
    setRespiratoryRate(rm.respiratory_rate || '');
    setTemperature(rm.temperature || '');
    setOxygenSaturation(rm.oxygen_saturation || '');
    setWeight(rm.weight || '');
    setHeight(rm.height || '');
    setBmi(rm.bmi || 0);

    // Body Systems
    setHeadNeck(rm.head_neck || '');
    setEyes(rm.eyes || '');
    setEnt(rm.ent || '');
    setThorax(rm.thorax || '');
    setCardiac(rm.cardiac || '');
    setPulmonary(rm.pulmonary || '');
    setAbdomen(rm.abdomen || '');
    setExtremities(rm.extremities || '');
    setNeurological(rm.neurological || '');
    setSkin(rm.skin || '');

    // Assessment & Plan
    setClinicalAssessment(rm.clinical_assessment || '');
    setPrognosis(rm.prognosis || '');
    setTreatmentPlan(rm.treatment_plan || '');
    setMedicationPlan(rm.medication_plan || '');

    // Disposition
    setDispositionType(rm.disposition_type || '');
    setRmDischargeStatus(rm.rm_discharge_status || '');
    setDischargeCondition(rm.discharge_condition || '');
    setDischargeInstruction(rm.discharge_instruction || '');
    setFollowUpInstruction(rm.follow_up_instruction || '');

    // Relations
    setDiagnoses(rm.diagnoses || []);
    setProcedures(rm.procedures || []);
    setLabResults(rm.lab_results || []);
    setRadiologyResults(rm.radiology_results || []);
    setSurgeryNotes(rm.surgery_notes || []);

    // Tarif (18 breakdown)
    setTarifProsedurNonBedah(rm.tarif_prosedur_non_bedah || 0);
    setTarifProsedurBedah(rm.tarif_prosedur_bedah || 0);
    setTarifKonsultasi(rm.tarif_konsultasi || 0);
    setTarifTenagaAhli(rm.tarif_tenaga_ahli || 0);
    setTarifKeperawatan(rm.tarif_keperawatan || 0);
    setTarifPenunjang(rm.tarif_penunjang || 0);
    setTarifRadiologi(rm.tarif_radiologi || 0);
    setTarifLaboratorium(rm.tarif_laboratorium || 0);
    setTarifPelayananDarah(rm.tarif_pelayanan_darah || 0);
    setTarifRehabilitasi(rm.tarif_rehabilitasi || 0);
    setTarifKamar(rm.tarif_kamar || 0);
    setTarifRawatIntensif(rm.tarif_rawat_intensif || 0);
    setTarifObat(rm.tarif_obat || 0);
    setTarifObatKronis(rm.tarif_obat_kronis || 0);
    setTarifObatKemoterapi(rm.tarif_obat_kemoterapi || 0);
    setTarifAlkes(rm.tarif_alkes || 0);
    setTarifBMHP(rm.tarif_bmhp || 0);
    setTarifSewaAlat(rm.tarif_sewa_alat || 0);

    setDirty(false);
  }, []);

  useEffect(() => {
    if (rmDuplicate) {
      populateFromRM(rmDuplicate);
    }
  }, [rmDuplicate, populateFromRM]);

  // Auto-calculate BMI
  useEffect(() => {
    const w = parseFloat(weight);
    const h = parseFloat(height);
    if (w > 0 && h > 0) {
      const hm = h / 100;
      setBmi(Math.round((w / (hm * hm)) * 10) / 10);
    }
  }, [weight, height]);

  // Auto-calculate Blood Pressure string
  useEffect(() => {
    if (systolic > 0 || diastolic > 0) {
      setBloodPressure(`${systolic}/${diastolic}`);
    }
  }, [systolic, diastolic]);

  // ============ Mark dirty helper ============
  const markDirty = () => setDirty(true);

  // ============ Diagnosis CRUD ============
  const addDiagnosis = () => {
    setDiagnoses([...diagnoses, { icd10_code: '', icd10_name: '', type: 'secondary', sequence: diagnoses.length + 1 }]);
    markDirty();
  };
  const removeDiagnosis = (i: number) => { setDiagnoses(diagnoses.filter((_, idx) => idx !== i)); markDirty(); };
  const updateDiagnosis = (i: number, updates: Partial<EKlaimRMDiagnosis>) => {
    setDiagnoses(prev => prev.map((d, idx) => idx === i ? { ...d, ...updates } : d));
    markDirty();
  };

  // ============ Procedure CRUD ============
  const addProcedure = () => {
    setProcedures([...procedures, { icd9_code: '', name: '', multiplicity: 1, setting: '', sequence: procedures.length + 1 }]);
    markDirty();
  };
  const removeProcedure = (i: number) => { setProcedures(procedures.filter((_, idx) => idx !== i)); markDirty(); };
  const updateProcedure = (i: number, updates: Partial<EKlaimRMProcedure>) => {
    setProcedures(prev => prev.map((p, idx) => idx === i ? { ...p, ...updates } : p));
    markDirty();
  };

  // ============ Lab Results CRUD ============
  const addLabResult = () => {
    setLabResults([...labResults, {
      order_number: '', order_item_name: '', parameter_name: '', value: '', unit: '',
      reference_range: '', is_abnormal: false, is_critical: false, notes: '', sequence: labResults.length + 1,
    }]);
    markDirty();
  };
  const removeLabResult = (i: number) => { setLabResults(labResults.filter((_, idx) => idx !== i)); markDirty(); };
  const updateLabResult = (i: number, field: keyof EKlaimRMLabResult, value: any) => {
    setLabResults(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
    markDirty();
  };

  // ============ Radiology Results CRUD ============
  const addRadiologyResult = () => {
    setRadiologyResults([...radiologyResults, {
      order_number: '', procedure_name: '', result_summary: '', conclusion: '',
      suggestion: '', is_critical: false, notes: '', sequence: radiologyResults.length + 1,
    }]);
    markDirty();
  };
  const removeRadiologyResult = (i: number) => { setRadiologyResults(radiologyResults.filter((_, idx) => idx !== i)); markDirty(); };
  const updateRadiologyResult = (i: number, field: keyof EKlaimRMRadiologyResult, value: any) => {
    setRadiologyResults(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r));
    markDirty();
  };

  // ============ Surgery Notes CRUD ============
  const addSurgeryNote = () => {
    setSurgeryNotes([...surgeryNotes, {
      order_number: '', procedure_name: '', surgeon_name: '', anesthesia_type: '',
      pre_op_diagnosis: '', post_op_diagnosis: '', operative_findings: '', procedure_desc: '',
      complications: '', blood_loss: '', duration: '', implants: '', notes: '', sequence: surgeryNotes.length + 1,
    }]);
    markDirty();
  };
  const removeSurgeryNote = (i: number) => { setSurgeryNotes(surgeryNotes.filter((_, idx) => idx !== i)); markDirty(); };
  const updateSurgeryNote = (i: number, field: keyof EKlaimRMSurgeryNote, value: any) => {
    setSurgeryNotes(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
    markDirty();
  };

  // ============ Save ============
  const handleSave = async () => {
    setSubmitting(true);
    try {
      await eklaimLocalApi.updateRMDuplicate(eklaimId, {
        // Anamnesis
        chief_complaint: chiefComplaint,
        history_of_present_illness: historyOfPresentIllness,
        past_medical_history: pastMedicalHistory,
        family_history: familyHistory,
        allergies,
        current_medications: currentMedications,
        // Physical Exam
        general_condition: generalCondition,
        consciousness,
        blood_pressure: bloodPressure,
        systolic,
        diastolic,
        heart_rate: heartRate,
        respiratory_rate: respiratoryRate,
        temperature,
        oxygen_saturation: oxygenSaturation,
        weight,
        height,
        bmi,
        // Body Systems
        head_neck: headNeck,
        eyes,
        ent,
        thorax,
        cardiac,
        pulmonary,
        abdomen,
        extremities,
        neurological,
        skin,
        // Assessment
        clinical_assessment: clinicalAssessment,
        prognosis,
        treatment_plan: treatmentPlan,
        medication_plan: medicationPlan,
        // Disposition
        disposition_type: dispositionType,
        rm_discharge_status: rmDischargeStatus,
        discharge_condition: dischargeCondition,
        discharge_instruction: dischargeInstruction,
        follow_up_instruction: followUpInstruction,
        // Relations
        diagnoses,
        procedures,
        lab_results: labResults,
        radiology_results: radiologyResults,
        surgery_notes: surgeryNotes,
        // Tarif (18 breakdown)
        tarif_prosedur_non_bedah: tarifProsedurNonBedah,
        tarif_prosedur_bedah: tarifProsedurBedah,
        tarif_konsultasi: tarifKonsultasi,
        tarif_tenaga_ahli: tarifTenagaAhli,
        tarif_keperawatan: tarifKeperawatan,
        tarif_penunjang: tarifPenunjang,
        tarif_radiologi: tarifRadiologi,
        tarif_laboratorium: tarifLaboratorium,
        tarif_pelayanan_darah: tarifPelayananDarah,
        tarif_rehabilitasi: tarifRehabilitasi,
        tarif_kamar: tarifKamar,
        tarif_rawat_intensif: tarifRawatIntensif,
        tarif_obat: tarifObat,
        tarif_obat_kronis: tarifObatKronis,
        tarif_obat_kemoterapi: tarifObatKemoterapi,
        tarif_alkes: tarifAlkes,
        tarif_bmhp: tarifBMHP,
        tarif_sewa_alat: tarifSewaAlat,
      });
      setDirty(false);
      toast({ variant: 'success', title: 'Berhasil!', description: 'Data RM duplikat berhasil disimpan.' });
      onSaved();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error!', description: err?.response?.data?.error || 'Gagal menyimpan data RM.' });
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);

  // Total tarif helper
  const totalTarif = tarifProsedurNonBedah + tarifProsedurBedah + tarifKonsultasi + tarifTenagaAhli +
    tarifKeperawatan + tarifPenunjang + tarifRadiologi + tarifLaboratorium + tarifPelayananDarah +
    tarifRehabilitasi + tarifKamar + tarifRawatIntensif + tarifObat + tarifObatKronis +
    tarifObatKemoterapi + tarifAlkes + tarifBMHP + tarifSewaAlat;

  const handleSyncFromVisit = async () => {
    setSyncing(true);
    try {
      const res = await eklaimLocalApi.syncRMFromVisit(eklaimId);
      if (res.rm_duplicate) {
        populateFromRM(res.rm_duplicate);
      }
      toast({ variant: 'success', title: 'Berhasil!', description: 'Data RM berhasil disinkronkan dari kunjungan.' });
      onSaved();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error!', description: err?.response?.data?.error || 'Gagal sync dari kunjungan.' });
    } finally {
      setSyncing(false);
    }
  };

  if (!rmDuplicate) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Activity className="h-12 w-12 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">Data RM duplikat belum tersedia. Muat ulang halaman.</p>
        <Button onClick={() => onSaved()} variant="outline" size="sm">
          Muat Ulang
        </Button>
      </div>
    );
  }

  // Check if RM is still empty (never synced)
  const isEmpty = !rmDuplicate.chief_complaint && !rmDuplicate.history_of_present_illness &&
    !rmDuplicate.clinical_assessment && diagnoses.length === 0 && procedures.length === 0;

  return (
    <div className="space-y-4">
      {/* Sync from Visit button */}
      <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">
            {isEmpty ? 'RM Duplikat masih kosong' : 'Sinkronisasi Data'}
          </p>
          <p className="text-xs text-muted-foreground">
            {isEmpty
              ? 'Tarik data dari kunjungan untuk mengisi RM Duplikat.'
              : 'Tarik ulang data dari kunjungan. Data yang sudah diedit akan ditimpa.'}
          </p>
        </div>
        <Button
          variant={isEmpty ? 'default' : 'outline'}
          size="sm"
          onClick={handleSyncFromVisit}
          disabled={syncing}
        >
          {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Sync dari Kunjungan
        </Button>
      </div>

      <Accordion type="multiple" defaultValue={[]} className="space-y-2">
        {/* ========== 1. ANAMNESIS ========== */}
        <AccordionItem value="anamnesis" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Stethoscope className="h-4 w-4 text-blue-600" />
              Anamnesis
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Keluhan Utama</Label>
                <Textarea
                  value={chiefComplaint}
                  onChange={(e) => { setChiefComplaint(e.target.value); markDirty(); }}
                  placeholder="Keluhan utama pasien..."
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Riwayat Penyakit Sekarang</Label>
                <Textarea
                  value={historyOfPresentIllness}
                  onChange={(e) => { setHistoryOfPresentIllness(e.target.value); markDirty(); }}
                  placeholder="Riwayat penyakit sekarang..."
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Riwayat Penyakit Dahulu</Label>
                <Textarea
                  value={pastMedicalHistory}
                  onChange={(e) => { setPastMedicalHistory(e.target.value); markDirty(); }}
                  placeholder="Riwayat penyakit dahulu..."
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Riwayat Keluarga</Label>
                <Textarea
                  value={familyHistory}
                  onChange={(e) => { setFamilyHistory(e.target.value); markDirty(); }}
                  placeholder="Riwayat penyakit keluarga..."
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Alergi</Label>
                <Textarea
                  value={allergies}
                  onChange={(e) => { setAllergies(e.target.value); markDirty(); }}
                  placeholder="Alergi obat/makanan/lainnya..."
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Obat yang Sedang Dikonsumsi</Label>
                <Textarea
                  value={currentMedications}
                  onChange={(e) => { setCurrentMedications(e.target.value); markDirty(); }}
                  placeholder="Daftar obat yang sedang dikonsumsi..."
                  rows={2}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ========== 2. VITAL SIGNS & PHYSICAL EXAM ========== */}
        <AccordionItem value="physical-exam" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <HeartPulse className="h-4 w-4 text-red-600" />
              Pemeriksaan Fisik & Tanda Vital
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-4">
            {/* Vital Signs */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Tanda Vital</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Sistolik (mmHg)</Label>
                  <Input type="number" value={systolic || ''} onChange={(e) => { setSystolic(Number(e.target.value)); markDirty(); }} placeholder="120" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Diastolik (mmHg)</Label>
                  <Input type="number" value={diastolic || ''} onChange={(e) => { setDiastolic(Number(e.target.value)); markDirty(); }} placeholder="80" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Nadi (x/menit)</Label>
                  <Input value={heartRate} onChange={(e) => { setHeartRate(e.target.value); markDirty(); }} placeholder="80" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">RR (x/menit)</Label>
                  <Input value={respiratoryRate} onChange={(e) => { setRespiratoryRate(e.target.value); markDirty(); }} placeholder="20" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Suhu (°C)</Label>
                  <Input value={temperature} onChange={(e) => { setTemperature(e.target.value); markDirty(); }} placeholder="36.5" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">SpO2 (%)</Label>
                  <Input value={oxygenSaturation} onChange={(e) => { setOxygenSaturation(e.target.value); markDirty(); }} placeholder="98" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">BB (kg)</Label>
                  <Input value={weight} onChange={(e) => { setWeight(e.target.value); markDirty(); }} placeholder="60" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">TB (cm)</Label>
                  <Input value={height} onChange={(e) => { setHeight(e.target.value); markDirty(); }} placeholder="165" />
                </div>
              </div>
              <div className="mt-2 flex items-center gap-4">
                <p className="text-xs text-muted-foreground">
                  TD: <span className="font-mono font-medium">{bloodPressure || '-'}</span> mmHg
                </p>
                <p className="text-xs text-muted-foreground">
                  BMI: <span className="font-mono font-medium">{bmi || '-'}</span>
                </p>
              </div>
            </div>

            <Separator />

            {/* General */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Keadaan Umum</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Keadaan Umum</Label>
                  <Input value={generalCondition} onChange={(e) => { setGeneralCondition(e.target.value); markDirty(); }} placeholder="Baik / Sedang / Buruk" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Kesadaran</Label>
                  <Select value={consciousness} onValueChange={(v) => { setConsciousness(v); markDirty(); }}>
                    <SelectTrigger><SelectValue placeholder="Pilih kesadaran" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Compos Mentis">Compos Mentis</SelectItem>
                      <SelectItem value="Apatis">Apatis</SelectItem>
                      <SelectItem value="Delirium">Delirium</SelectItem>
                      <SelectItem value="Somnolen">Somnolen</SelectItem>
                      <SelectItem value="Stupor">Stupor</SelectItem>
                      <SelectItem value="Semi Coma">Semi Coma</SelectItem>
                      <SelectItem value="Coma">Coma</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Body Systems */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Pemeriksaan Sistem Organ</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Kepala & Leher</Label>
                  <Textarea value={headNeck} onChange={(e) => { setHeadNeck(e.target.value); markDirty(); }} placeholder="Dalam batas normal" rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Mata</Label>
                  <Textarea value={eyes} onChange={(e) => { setEyes(e.target.value); markDirty(); }} placeholder="Konjungtiva anemis -/-, Sklera ikterik -/-" rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">THT</Label>
                  <Textarea value={ent} onChange={(e) => { setEnt(e.target.value); markDirty(); }} placeholder="Dalam batas normal" rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Thorax</Label>
                  <Textarea value={thorax} onChange={(e) => { setThorax(e.target.value); markDirty(); }} placeholder="Simetris, gerak napas simetris" rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Jantung</Label>
                  <Textarea value={cardiac} onChange={(e) => { setCardiac(e.target.value); markDirty(); }} placeholder="BJ I/II reguler, murmur (-), gallop (-)" rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Paru</Label>
                  <Textarea value={pulmonary} onChange={(e) => { setPulmonary(e.target.value); markDirty(); }} placeholder="Vesikuler +/+, ronkhi -/-, wheezing -/-" rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Abdomen</Label>
                  <Textarea value={abdomen} onChange={(e) => { setAbdomen(e.target.value); markDirty(); }} placeholder="Supel, BU (+) normal, nyeri tekan (-)" rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Ekstremitas</Label>
                  <Textarea value={extremities} onChange={(e) => { setExtremities(e.target.value); markDirty(); }} placeholder="Akral hangat, edema -/-, CRT < 2 detik" rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Neurologis</Label>
                  <Textarea value={neurological} onChange={(e) => { setNeurological(e.target.value); markDirty(); }} placeholder="Refleks fisiologis +/+, refleks patologis -/-" rows={2} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Kulit</Label>
                  <Textarea value={skin} onChange={(e) => { setSkin(e.target.value); markDirty(); }} placeholder="Warna sawo matang, turgor baik, lesi (-)" rows={2} />
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ========== 3. DIAGNOSES ========== */}
        <AccordionItem value="diagnoses" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ClipboardList className="h-4 w-4 text-purple-600" />
              Diagnosa ({diagnoses.length})
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-3">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={addDiagnosis}>
                <Plus className="mr-1 h-4 w-4" /> Tambah
              </Button>
            </div>
            {diagnoses.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Belum ada diagnosa.</p>
            ) : (
              <div className="space-y-2">
                {diagnoses.map((d, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted text-xs font-medium shrink-0 mt-0.5">{i + 1}</div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground mb-1 block">Diagnosa (ICD-10)</Label>
                          <ICD10Combobox
                            value={d.icd10_code}
                            onChange={(code, display) => updateDiagnosis(i, { icd10_code: code, icd10_name: display })}
                            placeholder="Cari diagnosa ICD-10..."
                          />
                        </div>
                        <div className="w-[160px]">
                          <Label className="text-xs text-muted-foreground mb-1 block">Tipe</Label>
                          <Select value={d.type} onValueChange={(v) => updateDiagnosis(i, { type: v as EKlaimRMDiagnosis['type'] })}>
                            <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="primary">Primer</SelectItem>
                              <SelectItem value="secondary">Sekunder</SelectItem>
                              <SelectItem value="complication">Komplikasi</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 mt-5 shrink-0" onClick={() => removeDiagnosis(i)}>
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      {d.icd10_name && <p className="text-xs text-muted-foreground pl-1">{d.icd10_name}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* ========== 4. PROCEDURES ========== */}
        <AccordionItem value="procedures" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Activity className="h-4 w-4 text-orange-600" />
              Prosedur / Tindakan ({procedures.length})
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-3">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={addProcedure}>
                <Plus className="mr-1 h-4 w-4" /> Tambah
              </Button>
            </div>
            {procedures.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Belum ada prosedur.</p>
            ) : (
              <div className="space-y-2">
                {procedures.map((p, i) => (
                  <div key={i} className="flex items-start gap-2 p-3 border rounded-lg bg-muted/30">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted text-xs font-medium shrink-0 mt-0.5">{i + 1}</div>
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <Label className="text-xs text-muted-foreground mb-1 block">Prosedur (ICD-9-CM)</Label>
                          <ICD9CMCombobox
                            value={p.icd9_code}
                            onChange={(code, display) => updateProcedure(i, { icd9_code: code, name: display })}
                            placeholder="Cari prosedur ICD-9-CM..."
                          />
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 mt-5 shrink-0" onClick={() => removeProcedure(i)}>
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      {p.name && <p className="text-xs text-muted-foreground pl-1">{p.name}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* ========== 5. LAB RESULTS ========== */}
        <AccordionItem value="lab-results" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <FlaskConical className="h-4 w-4 text-green-600" />
              Hasil Laboratorium ({labResults.length})
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-3">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={addLabResult}>
                <Plus className="mr-1 h-4 w-4" /> Tambah
              </Button>
            </div>
            {labResults.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Belum ada hasil lab.</p>
            ) : (
              <div className="space-y-3">
                {labResults.map((l, i) => (
                  <div key={i} className="p-3 border rounded-lg bg-muted/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center h-6 w-6 rounded-full bg-green-100 text-green-800 text-xs font-medium">{i + 1}</div>
                        <span className="text-xs text-muted-foreground">
                          {l.order_item_name || 'Parameter Lab'}
                        </span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeLabResult(i)}>
                        <X className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Nama Pemeriksaan</Label>
                        <Input className="h-8 text-xs" value={l.order_item_name} onChange={(e) => updateLabResult(i, 'order_item_name', e.target.value)} placeholder="Hematologi" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Parameter</Label>
                        <Input className="h-8 text-xs" value={l.parameter_name} onChange={(e) => updateLabResult(i, 'parameter_name', e.target.value)} placeholder="Hemoglobin" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Nilai</Label>
                        <Input className="h-8 text-xs" value={l.value} onChange={(e) => updateLabResult(i, 'value', e.target.value)} placeholder="13.5" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Satuan</Label>
                        <Input className="h-8 text-xs" value={l.unit} onChange={(e) => updateLabResult(i, 'unit', e.target.value)} placeholder="g/dL" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Nilai Rujukan</Label>
                        <Input className="h-8 text-xs" value={l.reference_range} onChange={(e) => updateLabResult(i, 'reference_range', e.target.value)} placeholder="12.0 - 16.0" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">No. Order</Label>
                        <Input className="h-8 text-xs" value={l.order_number} onChange={(e) => updateLabResult(i, 'order_number', e.target.value)} placeholder="LAB-001" />
                      </div>
                      <div className="flex items-center gap-4 col-span-2">
                        <div className="flex items-center gap-2">
                          <Switch checked={l.is_abnormal} onCheckedChange={(v) => updateLabResult(i, 'is_abnormal', v)} />
                          <Label className="text-xs">Abnormal</Label>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch checked={l.is_critical} onCheckedChange={(v) => updateLabResult(i, 'is_critical', v)} />
                          <Label className="text-xs text-destructive">Kritis</Label>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Catatan</Label>
                      <Input className="h-8 text-xs" value={l.notes} onChange={(e) => updateLabResult(i, 'notes', e.target.value)} placeholder="Catatan tambahan..." />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* ========== 6. RADIOLOGY RESULTS ========== */}
        <AccordionItem value="radiology-results" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ScanLine className="h-4 w-4 text-cyan-600" />
              Hasil Radiologi ({radiologyResults.length})
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-3">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={addRadiologyResult}>
                <Plus className="mr-1 h-4 w-4" /> Tambah
              </Button>
            </div>
            {radiologyResults.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Belum ada hasil radiologi.</p>
            ) : (
              <div className="space-y-3">
                {radiologyResults.map((r, i) => (
                  <div key={i} className="p-3 border rounded-lg bg-muted/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center h-6 w-6 rounded-full bg-cyan-100 text-cyan-800 text-xs font-medium">{i + 1}</div>
                        <span className="text-xs text-muted-foreground">{r.procedure_name || 'Pemeriksaan Radiologi'}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeRadiologyResult(i)}>
                        <X className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Nama Prosedur</Label>
                        <Input className="h-8 text-xs" value={r.procedure_name} onChange={(e) => updateRadiologyResult(i, 'procedure_name', e.target.value)} placeholder="Rontgen Thorax PA" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">No. Order</Label>
                        <Input className="h-8 text-xs" value={r.order_number} onChange={(e) => updateRadiologyResult(i, 'order_number', e.target.value)} placeholder="RAD-001" />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <Label className="text-xs">Hasil / Deskripsi</Label>
                        <Textarea className="text-xs" value={r.result_summary} onChange={(e) => updateRadiologyResult(i, 'result_summary', e.target.value)} placeholder="Deskripsi hasil radiologi..." rows={3} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Kesimpulan</Label>
                        <Textarea className="text-xs" value={r.conclusion} onChange={(e) => updateRadiologyResult(i, 'conclusion', e.target.value)} placeholder="Kesan: ..." rows={2} />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Saran</Label>
                        <Textarea className="text-xs" value={r.suggestion} onChange={(e) => updateRadiologyResult(i, 'suggestion', e.target.value)} placeholder="Saran: ..." rows={2} />
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <Switch checked={r.is_critical} onCheckedChange={(v) => updateRadiologyResult(i, 'is_critical', v)} />
                        <Label className="text-xs text-destructive">Kritis</Label>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Catatan</Label>
                      <Input className="h-8 text-xs" value={r.notes} onChange={(e) => updateRadiologyResult(i, 'notes', e.target.value)} placeholder="Catatan tambahan..." />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* ========== 7. SURGERY NOTES ========== */}
        <AccordionItem value="surgery-notes" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Scissors className="h-4 w-4 text-amber-600" />
              Catatan Operasi ({surgeryNotes.length})
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4 space-y-3">
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={addSurgeryNote}>
                <Plus className="mr-1 h-4 w-4" /> Tambah
              </Button>
            </div>
            {surgeryNotes.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Belum ada catatan operasi.</p>
            ) : (
              <div className="space-y-3">
                {surgeryNotes.map((s, i) => (
                  <div key={i} className="p-3 border rounded-lg bg-muted/30 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="flex items-center justify-center h-6 w-6 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">{i + 1}</div>
                        <span className="text-xs text-muted-foreground">{s.procedure_name || 'Operasi'}</span>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeSurgeryNote(i)}>
                        <X className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Nama Prosedur</Label>
                        <Input className="h-8 text-xs" value={s.procedure_name} onChange={(e) => updateSurgeryNote(i, 'procedure_name', e.target.value)} placeholder="Nama operasi" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Operator / Dokter Bedah</Label>
                        <Input className="h-8 text-xs" value={s.surgeon_name} onChange={(e) => updateSurgeryNote(i, 'surgeon_name', e.target.value)} placeholder="dr. ..." />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Jenis Anestesi</Label>
                        <Select value={s.anesthesia_type} onValueChange={(v) => updateSurgeryNote(i, 'anesthesia_type', v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Pilih" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="general">General Anesthesia</SelectItem>
                            <SelectItem value="regional">Regional Anesthesia</SelectItem>
                            <SelectItem value="spinal">Spinal Anesthesia</SelectItem>
                            <SelectItem value="epidural">Epidural Anesthesia</SelectItem>
                            <SelectItem value="local">Local Anesthesia</SelectItem>
                            <SelectItem value="sedation">Sedasi</SelectItem>
                            <SelectItem value="none">Tanpa Anestesi</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">No. Order</Label>
                        <Input className="h-8 text-xs" value={s.order_number} onChange={(e) => updateSurgeryNote(i, 'order_number', e.target.value)} placeholder="OP-001" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Diagnosa Pre-Op</Label>
                        <Textarea className="text-xs" value={s.pre_op_diagnosis} onChange={(e) => updateSurgeryNote(i, 'pre_op_diagnosis', e.target.value)} rows={2} placeholder="Diagnosa sebelum operasi" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Diagnosa Post-Op</Label>
                        <Textarea className="text-xs" value={s.post_op_diagnosis} onChange={(e) => updateSurgeryNote(i, 'post_op_diagnosis', e.target.value)} rows={2} placeholder="Diagnosa setelah operasi" />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <Label className="text-xs">Temuan Operatif</Label>
                        <Textarea className="text-xs" value={s.operative_findings} onChange={(e) => updateSurgeryNote(i, 'operative_findings', e.target.value)} rows={3} placeholder="Temuan saat operasi..." />
                      </div>
                      <div className="space-y-1 md:col-span-2">
                        <Label className="text-xs">Deskripsi Prosedur</Label>
                        <Textarea className="text-xs" value={s.procedure_desc} onChange={(e) => updateSurgeryNote(i, 'procedure_desc', e.target.value)} rows={3} placeholder="Langkah-langkah prosedur operasi..." />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Komplikasi</Label>
                        <Input className="h-8 text-xs" value={s.complications} onChange={(e) => updateSurgeryNote(i, 'complications', e.target.value)} placeholder="Tidak ada komplikasi" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Perdarahan</Label>
                        <Input className="h-8 text-xs" value={s.blood_loss} onChange={(e) => updateSurgeryNote(i, 'blood_loss', e.target.value)} placeholder="± 50 cc" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Durasi Operasi</Label>
                        <Input className="h-8 text-xs" value={s.duration} onChange={(e) => updateSurgeryNote(i, 'duration', e.target.value)} placeholder="120 menit" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Implan</Label>
                        <Input className="h-8 text-xs" value={s.implants} onChange={(e) => updateSurgeryNote(i, 'implants', e.target.value)} placeholder="Tidak ada" />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Catatan</Label>
                      <Input className="h-8 text-xs" value={s.notes} onChange={(e) => updateSurgeryNote(i, 'notes', e.target.value)} placeholder="Catatan tambahan operasi..." />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* ========== 8. ASSESSMENT & PLAN ========== */}
        <AccordionItem value="assessment" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <ClipboardList className="h-4 w-4 text-indigo-600" />
              Assessment & Plan
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Penilaian Klinis (Assessment)</Label>
                <Textarea
                  value={clinicalAssessment}
                  onChange={(e) => { setClinicalAssessment(e.target.value); markDirty(); }}
                  placeholder="Penilaian klinis terhadap kondisi pasien..."
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Prognosis</Label>
                <Select value={prognosis} onValueChange={(v) => { setPrognosis(v); markDirty(); }}>
                  <SelectTrigger><SelectValue placeholder="Pilih prognosis" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bonam">Bonam (Baik)</SelectItem>
                    <SelectItem value="Dubia ad Bonam">Dubia ad Bonam</SelectItem>
                    <SelectItem value="Dubia ad Malam">Dubia ad Malam</SelectItem>
                    <SelectItem value="Malam">Malam (Buruk)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Rencana Terapi</Label>
                <Textarea
                  value={treatmentPlan}
                  onChange={(e) => { setTreatmentPlan(e.target.value); markDirty(); }}
                  placeholder="Rencana terapi dan tindakan..."
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Rencana Obat</Label>
                <Textarea
                  value={medicationPlan}
                  onChange={(e) => { setMedicationPlan(e.target.value); markDirty(); }}
                  placeholder="Rencana pemberian obat..."
                  rows={3}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ========== 9. DISPOSITION ========== */}
        <AccordionItem value="disposition" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <LogOut className="h-4 w-4 text-teal-600" />
              Disposisi / Ringkasan Pulang
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Tipe Disposisi</Label>
                <Select value={dispositionType} onValueChange={(v) => { setDispositionType(v); markDirty(); }}>
                  <SelectTrigger><SelectValue placeholder="Pilih disposisi" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="discharge">Dipulangkan</SelectItem>
                    <SelectItem value="transfer">Dirujuk / Transfer</SelectItem>
                    <SelectItem value="admitted">Rawat Inap</SelectItem>
                    <SelectItem value="ama">Pulang Paksa (AMA)</SelectItem>
                    <SelectItem value="death">Meninggal</SelectItem>
                    <SelectItem value="dor">Pulang Atas Permintaan Sendiri</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status Pulang (RM)</Label>
                <Select value={rmDischargeStatus} onValueChange={(v) => { setRmDischargeStatus(v); markDirty(); }}>
                  <SelectTrigger><SelectValue placeholder="Pilih status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sembuh">Sembuh</SelectItem>
                    <SelectItem value="membaik">Membaik</SelectItem>
                    <SelectItem value="belum_sembuh">Belum Sembuh</SelectItem>
                    <SelectItem value="meninggal">Meninggal</SelectItem>
                    <SelectItem value="pulang_paksa">Pulang Paksa</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Kondisi Saat Pulang</Label>
                <Textarea
                  value={dischargeCondition}
                  onChange={(e) => { setDischargeCondition(e.target.value); markDirty(); }}
                  placeholder="Kondisi pasien saat dipulangkan..."
                  rows={2}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Instruksi Pulang</Label>
                <Textarea
                  value={dischargeInstruction}
                  onChange={(e) => { setDischargeInstruction(e.target.value); markDirty(); }}
                  placeholder="Instruksi untuk pasien setelah pulang..."
                  rows={2}
                />
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <Label>Instruksi Follow-up</Label>
                <Textarea
                  value={followUpInstruction}
                  onChange={(e) => { setFollowUpInstruction(e.target.value); markDirty(); }}
                  placeholder="Jadwal kontrol / rencana tindak lanjut..."
                  rows={2}
                />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ========== 10. TARIF ========== */}
        <AccordionItem value="tarif" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline py-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              Tarif RS (Breakdown E-Klaim)
              <span className="ml-2 text-xs font-mono text-muted-foreground">
                {formatCurrency(totalTarif)}
              </span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Prosedur Non Bedah</Label>
                <Input type="number" value={tarifProsedurNonBedah} onChange={(e) => { setTarifProsedurNonBedah(Number(e.target.value)); markDirty(); }} />
              </div>
              <div className="space-y-1.5">
                <Label>Prosedur Bedah</Label>
                <Input type="number" value={tarifProsedurBedah} onChange={(e) => { setTarifProsedurBedah(Number(e.target.value)); markDirty(); }} />
              </div>
              <div className="space-y-1.5">
                <Label>Konsultasi</Label>
                <Input type="number" value={tarifKonsultasi} onChange={(e) => { setTarifKonsultasi(Number(e.target.value)); markDirty(); }} />
              </div>
              <div className="space-y-1.5">
                <Label>Tenaga Ahli</Label>
                <Input type="number" value={tarifTenagaAhli} onChange={(e) => { setTarifTenagaAhli(Number(e.target.value)); markDirty(); }} />
              </div>
              <div className="space-y-1.5">
                <Label>Keperawatan</Label>
                <Input type="number" value={tarifKeperawatan} onChange={(e) => { setTarifKeperawatan(Number(e.target.value)); markDirty(); }} />
              </div>
              <div className="space-y-1.5">
                <Label>Penunjang</Label>
                <Input type="number" value={tarifPenunjang} onChange={(e) => { setTarifPenunjang(Number(e.target.value)); markDirty(); }} />
              </div>
              <div className="space-y-1.5">
                <Label>Radiologi</Label>
                <Input type="number" value={tarifRadiologi} onChange={(e) => { setTarifRadiologi(Number(e.target.value)); markDirty(); }} />
              </div>
              <div className="space-y-1.5">
                <Label>Laboratorium</Label>
                <Input type="number" value={tarifLaboratorium} onChange={(e) => { setTarifLaboratorium(Number(e.target.value)); markDirty(); }} />
              </div>
              <div className="space-y-1.5">
                <Label>Pelayanan Darah</Label>
                <Input type="number" value={tarifPelayananDarah} onChange={(e) => { setTarifPelayananDarah(Number(e.target.value)); markDirty(); }} />
              </div>
              <div className="space-y-1.5">
                <Label>Rehabilitasi</Label>
                <Input type="number" value={tarifRehabilitasi} onChange={(e) => { setTarifRehabilitasi(Number(e.target.value)); markDirty(); }} />
              </div>
              <div className="space-y-1.5">
                <Label>Kamar / Akomodasi</Label>
                <Input type="number" value={tarifKamar} onChange={(e) => { setTarifKamar(Number(e.target.value)); markDirty(); }} />
              </div>
              <div className="space-y-1.5">
                <Label>Rawat Intensif</Label>
                <Input type="number" value={tarifRawatIntensif} onChange={(e) => { setTarifRawatIntensif(Number(e.target.value)); markDirty(); }} />
              </div>
              <div className="space-y-1.5">
                <Label>Obat</Label>
                <Input type="number" value={tarifObat} onChange={(e) => { setTarifObat(Number(e.target.value)); markDirty(); }} />
              </div>
              <div className="space-y-1.5">
                <Label>Obat Kronis</Label>
                <Input type="number" value={tarifObatKronis} onChange={(e) => { setTarifObatKronis(Number(e.target.value)); markDirty(); }} />
              </div>
              <div className="space-y-1.5">
                <Label>Obat Kemoterapi</Label>
                <Input type="number" value={tarifObatKemoterapi} onChange={(e) => { setTarifObatKemoterapi(Number(e.target.value)); markDirty(); }} />
              </div>
              <div className="space-y-1.5">
                <Label>Alkes</Label>
                <Input type="number" value={tarifAlkes} onChange={(e) => { setTarifAlkes(Number(e.target.value)); markDirty(); }} />
              </div>
              <div className="space-y-1.5">
                <Label>BMHP</Label>
                <Input type="number" value={tarifBMHP} onChange={(e) => { setTarifBMHP(Number(e.target.value)); markDirty(); }} />
              </div>
              <div className="space-y-1.5">
                <Label>Sewa Alat</Label>
                <Input type="number" value={tarifSewaAlat} onChange={(e) => { setTarifSewaAlat(Number(e.target.value)); markDirty(); }} />
              </div>
            </div>
            <div className="mt-3 p-2 rounded bg-muted/50">
              <p className="text-sm text-muted-foreground">
                Total: <span className="font-mono font-medium text-foreground">{formatCurrency(totalTarif)}</span>
              </p>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Save Button */}
      <div className="flex items-center justify-between pt-2 border-t">
        <p className="text-xs text-muted-foreground">
          {dirty ? 'Ada perubahan yang belum disimpan' : 'Semua perubahan tersimpan'}
        </p>
        <Button onClick={handleSave} disabled={!dirty || submitting} size="lg">
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Simpan
        </Button>
      </div>
    </div>
  );
}
