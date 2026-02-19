import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
// Collapsible removed â€” all sections always visible
import {
  caraMasukOptions,
  jenisRawatOptions,
  kelasRawatOptions,
  dischargeStatusOptions,
  kodeTarifOptions,
  payorOptions,
  upgradeClassClassOptions,
  upgradeClassPayorOptions,
  nomorKartuTOptions,
  bayiLahirStatusOptions,
  onsetKontraksiOptions,
  deliveryMethodOptions,
  letakJaninOptions,
  kondisiBayiOptions,
  shkLokasiOptions,
  shkAlasanOptions,
} from '@/lib/api/eklaim-local';
import { eklaimLocalApi } from '@/lib/api/eklaim-local';
import type { EKlaimLocal, OriginalRM } from '@/lib/api/eklaim-local';
import { Plus, Trash2, RefreshCw, Send, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

// ========= Types =========
interface DeliveryEntry {
  delivery_sequence: string;
  delivery_method: string;
  delivery_dttm: string;
  letak_janin: string;
  kondisi: string;
  use_manual: string;
  use_forcep: string;
  use_vacuum: string;
  shk_spesimen_ambil: string;
  shk_lokasi: string;
  shk_spesimen_dttm: string;
  shk_alasan: string;
}

const emptyDelivery = (): DeliveryEntry => ({
  delivery_sequence: '1',
  delivery_method: 'vaginal',
  delivery_dttm: '',
  letak_janin: 'kepala',
  kondisi: 'livebirth',
  use_manual: '0',
  use_forcep: '0',
  use_vacuum: '0',
  shk_spesimen_ambil: '',
  shk_lokasi: '',
  shk_spesimen_dttm: '',
  shk_alasan: '',
});

interface ClaimDataTabProps {
  detail: EKlaimLocal;
  originalRM?: OriginalRM;
  onBuildPayload: (builder: () => Record<string, any>) => void;
  onRefresh?: () => void;
  disabled?: boolean;
  onSubmitClaimData: () => Promise<void>;
  submitting?: boolean;
}

// Flat section divider header (no card)
function SectionHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <>
      <Separator className="my-3" />
      <div className="flex items-center justify-between py-1">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{title}</h4>
        {children && <div className="flex items-center gap-2">{children}</div>}
      </div>
    </>
  );
}

// Helper: map SIMRS disposition type to E-Klaim discharge_status code
function mapDischargeStatus(dispositionType?: string): string {
  if (!dispositionType) return '';
  switch (dispositionType.toLowerCase().trim()) {
    // Pulang normal / atas persetujuan dokter
    case 'pulang': case 'sembuh': case 'membaik': case 'pulang_sehat': return '1';
    // Dirujuk ke RS lain
    case 'rujuk': case 'rujuk_keluar': case 'pindah_rs': case 'transfer': return '2';
    // Atas permintaan sendiri (APS) / Pulang Paksa
    case 'aps': case 'pulang_paksa': case 'menolak_rawat': return '3';
    // Meninggal
    case 'meninggal': case 'dod': case 'meninggal_48': case 'meninggal_lebih_48': return '4';
    // Lain-lain (rawat inap lanjutan, kontrol, dll)
    case 'rawat_inap': case 'kontrol': case 'lain_lain': case 'lainnya': return '5';
    default: return '';
  }
}

// Helper: format number to IDR currency
function formatRp(val: number): string {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
}

// Helper: convert E-Klaim date (yyyy-mm-dd HH:mm:ss) to HTML datetime-local (yyyy-mm-ddTHH:mm:ss)
function toDatetimeLocal(val: string): string {
  if (!val) return '';
  // Already has 'T' separator → already in HTML format
  if (val.includes('T')) return val;
  // Has space separator → replace with T
  if (val.includes(' ')) return val.replace(' ', 'T');
  // Date only (yyyy-mm-dd) → append default time
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val + 'T00:00:00';
  return val;
}

// Helper: convert HTML datetime-local (yyyy-mm-ddTHH:mm or yyyy-mm-ddTHH:mm:ss) to E-Klaim format (yyyy-mm-dd HH:mm:ss)
function fromDatetimeLocal(val: string): string {
  if (!val) return '';
  const result = val.replace('T', ' ');
  // Ensure seconds are always present (HH:mm → HH:mm:ss)
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(result)) return result + ':00';
  return result;
}

export default function ClaimDataTab({ detail, originalRM, onBuildPayload, onRefresh, disabled, onSubmitClaimData, submitting }: ClaimDataTabProps) {
  // ========= State: Data Umum =========
  const [tglMasuk, setTglMasuk] = useState('');
  const [tglPulang, setTglPulang] = useState('');
  const [caraMasuk, setCaraMasuk] = useState('');
  const [jenisRawat, setJenisRawat] = useState('');
  const [kelasRawat, setKelasRawat] = useState('');
  const [dischargeStatus, setDischargeStatus] = useState('');

  // ========= State: Dokter & Coder =========
  const [namaDokter, setNamaDokter] = useState('');
  const [coderNik, setCoderNik] = useState('');

  // ========= State: Tarif & Payor =========
  const [kodeTarif, setKodeTarif] = useState('');
  const [payorId, setPayorId] = useState('');
  const [payorCd, setPayorCd] = useState('');
  const [cobCd, setCobCd] = useState('');
  const [tarifPoliEks, setTarifPoliEks] = useState('');

  // ========= State: ICU & Ventilator =========
  const [icuIndikator, setIcuIndikator] = useState('0');
  const [icuLos, setIcuLos] = useState('0');
  const [ventilatorHour, setVentilatorHour] = useState('0');
  const [ventilatorUseInd, setVentilatorUseInd] = useState('0');
  const [ventilatorStart, setVentilatorStart] = useState('');
  const [ventilatorStop, setVentilatorStop] = useState('');

  // ========= State: Tekanan Darah =========
  const [sistole, setSistole] = useState('0');
  const [diastole, setDiastole] = useState('0');

  // ========= State: Neonatus & ADL =========
  const [birthWeight, setBirthWeight] = useState('0');
  const [adlSubAcute, setAdlSubAcute] = useState('0');
  const [adlChronic, setAdlChronic] = useState('0');

  // ========= State: Upgrade Kelas =========
  const [upgradeClassInd, setUpgradeClassInd] = useState('0');
  const [upgradeClassClass, setUpgradeClassClass] = useState('');
  const [upgradeClassLos, setUpgradeClassLos] = useState('0');
  const [upgradeClassPayor, setUpgradeClassPayor] = useState('');
  const [addPaymentPct, setAddPaymentPct] = useState('0');

  // ========= State: Khusus =========
  const [nomorKartuT, setNomorKartuT] = useState('');
  const [bayiLahirStatusCd, setBayiLahirStatusCd] = useState('0');
  const [dializerSingleUse, setDializerSingleUse] = useState('0');
  const [kantongDarah, setKantongDarah] = useState('0');
  const [alteplaseInd, setAlteplaseInd] = useState('0');

  // ========= State: APGAR =========
  const [apgarM1Appearance, setApgarM1Appearance] = useState('0');
  const [apgarM1Pulse, setApgarM1Pulse] = useState('0');
  const [apgarM1Grimace, setApgarM1Grimace] = useState('0');
  const [apgarM1Activity, setApgarM1Activity] = useState('0');
  const [apgarM1Respiration, setApgarM1Respiration] = useState('0');
  const [apgarM5Appearance, setApgarM5Appearance] = useState('0');
  const [apgarM5Pulse, setApgarM5Pulse] = useState('0');
  const [apgarM5Grimace, setApgarM5Grimace] = useState('0');
  const [apgarM5Activity, setApgarM5Activity] = useState('0');
  const [apgarM5Respiration, setApgarM5Respiration] = useState('0');

  // ========= State: Persalinan =========
  const [persUsiaKehamilan, setPersUsiaKehamilan] = useState('');
  const [persGravida, setPersGravida] = useState('');
  const [persPartus, setPersPartus] = useState('');
  const [persAbortus, setPersAbortus] = useState('');
  const [persOnsetKontraksi, setPersOnsetKontraksi] = useState('');
  const [deliveries, setDeliveries] = useState<DeliveryEntry[]>([]);

  // Persalinan delivery entries

  // ========= Load data from detail, with RM Edit / originalRM fallback =========
  useEffect(() => {
    if (!detail) return;
    const d = detail;
    const rmEdit = d.rm_duplicate;
    const rm = originalRM;

    setTglMasuk(toDatetimeLocal(d.tgl_masuk || ''));
    setTglPulang(toDatetimeLocal(d.tgl_pulang || ''));
    setCaraMasuk(d.cara_masuk || '');
    setJenisRawat(d.jenis_rawat || '');
    setKelasRawat(d.kelas_rawat || '');

    // discharge_status: detail â†’ RM Edit disposition â†’ original disposition
    const ds = d.discharge_status
      || mapDischargeStatus(rmEdit?.disposition_type)
      || mapDischargeStatus(rm?.disposition?.disposition_type);
    setDischargeStatus(ds);

    setNamaDokter(d.nama_dokter || '');
    setCoderNik(d.coder_nik || '');
    setKodeTarif(d.kode_tarif || '');
    setPayorId(d.payor_id || '');
    setPayorCd(d.payor_cd || '');
    setCobCd(d.cob_cd || '');
    setTarifPoliEks(d.tarif_poli_eks || '');
    setIcuIndikator(d.icu_indikator || '0');
    setIcuLos(d.icu_los || '0');
    setVentilatorHour(d.ventilator_hour || '0');
    setVentilatorUseInd(d.ventilator_use_ind || '0');
    setVentilatorStart(d.ventilator_start || '');
    setVentilatorStop(d.ventilator_stop || '');

    // sistole/diastole: detail â†’ RM Edit â†’ originalRM physical exam
    const rawSistole = d.sistole
      || rmEdit?.systolic
      || rm?.physical_examination?.systolic
      || 0;
    const rawDiastole = d.diastole
      || rmEdit?.diastolic
      || rm?.physical_examination?.diastolic
      || 0;
    setSistole(String(rawSistole));
    setDiastole(String(rawDiastole));

    setBirthWeight(d.birth_weight || '0');
    setAdlSubAcute(d.adl_sub_acute || '0');
    setAdlChronic(d.adl_chronic || '0');
    setUpgradeClassInd(d.upgrade_class_ind || '0');
    setUpgradeClassClass(d.upgrade_class_class || '');
    setUpgradeClassLos(d.upgrade_class_los || '0');
    setUpgradeClassPayor(d.upgrade_class_payor || '');
    setAddPaymentPct(d.add_payment_pct || '0');
    setNomorKartuT(d.nomor_kartu_t || '');
    setBayiLahirStatusCd(String(d.bayi_lahir_status_cd || 0));
    setDializerSingleUse(String(d.dializer_single_use || 0));
    setKantongDarah(String(d.kantong_darah || 0));
    setAlteplaseInd(String(d.alteplase_ind || 0));

    // APGAR
    setApgarM1Appearance(String(d.apgar_menit1_appearance || 0));
    setApgarM1Pulse(String(d.apgar_menit1_pulse || 0));
    setApgarM1Grimace(String(d.apgar_menit1_grimace || 0));
    setApgarM1Activity(String(d.apgar_menit1_activity || 0));
    setApgarM1Respiration(String(d.apgar_menit1_respiration || 0));
    setApgarM5Appearance(String(d.apgar_menit5_appearance || 0));
    setApgarM5Pulse(String(d.apgar_menit5_pulse || 0));
    setApgarM5Grimace(String(d.apgar_menit5_grimace || 0));
    setApgarM5Activity(String(d.apgar_menit5_activity || 0));
    setApgarM5Respiration(String(d.apgar_menit5_respiration || 0));

    // Persalinan
    setPersUsiaKehamilan(d.persalinan_usia_kehamilan || '');
    setPersGravida(d.persalinan_gravida || '');
    setPersPartus(d.persalinan_partus || '');
    setPersAbortus(d.persalinan_abortus || '');
    setPersOnsetKontraksi(d.persalinan_onset_kontraksi || '');
    if (d.persalinan_delivery_json) {
      try {
        setDeliveries(JSON.parse(d.persalinan_delivery_json));
      } catch {
        setDeliveries([]);
      }
    }

  }, [detail, originalRM]);

  // ========= Load defaults from config (auto-fill empty fields) =========
  useEffect(() => {
    const loadDefaults = async () => {
      try {
        const defaults = await eklaimLocalApi.getDefaults();
        // Only fill if the field is still empty (detail didn't provide a value)
        if (defaults.coder_nik && !detail.coder_nik) {
          setCoderNik(defaults.coder_nik);
        }
        if (defaults.kode_tarif && !detail.kode_tarif) {
          setKodeTarif(defaults.kode_tarif);
        }
      } catch {
        // Silent fail â€” defaults are optional
      }
    };
    loadDefaults();
  }, [detail.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ========= Build payload for parent =========
  const buildPayload = useCallback((): Record<string, any> => {
    const payload: Record<string, any> = {
      tgl_masuk: fromDatetimeLocal(tglMasuk),
      tgl_pulang: fromDatetimeLocal(tglPulang),
      cara_masuk: caraMasuk,
      jenis_rawat: jenisRawat,
      kelas_rawat: kelasRawat,
      discharge_status: dischargeStatus,
      coder_nik: coderNik,
      nama_dokter: namaDokter,
      kode_tarif: kodeTarif,
      payor_id: payorId,
      payor_cd: payorCd,
      cob_cd: cobCd,
      icu_indikator: icuIndikator,
      icu_los: icuLos,
      ventilator_hour: ventilatorHour,
      birth_weight: birthWeight,
      adl_sub_acute: adlSubAcute,
      adl_chronic: adlChronic,
      upgrade_class_ind: upgradeClassInd,
      upgrade_class_class: upgradeClassClass,
      upgrade_class_los: upgradeClassLos,
      upgrade_class_payor: upgradeClassPayor,
      add_payment_pct: addPaymentPct,
      sistole: parseInt(sistole) || 0,
      diastole: parseInt(diastole) || 0,
      nomor_kartu_t: nomorKartuT,
      bayi_lahir_status_cd: parseInt(bayiLahirStatusCd) || 0,
      dializer_single_use: parseInt(dializerSingleUse) || 0,
      kantong_darah: parseInt(kantongDarah) || 0,
      alteplase_ind: parseInt(alteplaseInd) || 0,
      tarif_poli_eks: tarifPoliEks,
    };

    // Ventilator detail
    if (ventilatorUseInd === '1') {
      payload.ventilator = {
        use_ind: '1',
        start_dttm: ventilatorStart,
        stop_dttm: ventilatorStop,
      };
    }

    // APGAR
    const hasApgar =
      parseInt(apgarM1Appearance) > 0 || parseInt(apgarM1Pulse) > 0 ||
      parseInt(apgarM5Appearance) > 0 || parseInt(apgarM5Pulse) > 0;
    if (hasApgar) {
      payload.apgar = {
        menit_1: {
          appearance: parseInt(apgarM1Appearance) || 0,
          pulse: parseInt(apgarM1Pulse) || 0,
          grimace: parseInt(apgarM1Grimace) || 0,
          activity: parseInt(apgarM1Activity) || 0,
          respiration: parseInt(apgarM1Respiration) || 0,
        },
        menit_5: {
          appearance: parseInt(apgarM5Appearance) || 0,
          pulse: parseInt(apgarM5Pulse) || 0,
          grimace: parseInt(apgarM5Grimace) || 0,
          activity: parseInt(apgarM5Activity) || 0,
          respiration: parseInt(apgarM5Respiration) || 0,
        },
      };
    }

    // Persalinan
    if (persUsiaKehamilan || persGravida) {
      payload.persalinan = {
        usia_kehamilan: persUsiaKehamilan,
        gravida: persGravida,
        partus: persPartus,
        abortus: persAbortus,
        onset_kontraksi: persOnsetKontraksi,
        delivery: deliveries.length > 0 ? deliveries : undefined,
      };
    }

    return payload;
  }, [
    tglMasuk, tglPulang, caraMasuk, jenisRawat, kelasRawat, dischargeStatus,
    coderNik, namaDokter, kodeTarif, payorId, payorCd, cobCd,
    icuIndikator, icuLos, ventilatorHour, ventilatorUseInd, ventilatorStart, ventilatorStop,
    birthWeight, adlSubAcute, adlChronic,
    upgradeClassInd, upgradeClassClass, upgradeClassLos, upgradeClassPayor, addPaymentPct,
    sistole, diastole, nomorKartuT, bayiLahirStatusCd, dializerSingleUse, kantongDarah, alteplaseInd,
    tarifPoliEks, apgarM1Appearance, apgarM1Pulse, apgarM1Grimace, apgarM1Activity, apgarM1Respiration,
    apgarM5Appearance, apgarM5Pulse, apgarM5Grimace, apgarM5Activity, apgarM5Respiration,
    persUsiaKehamilan, persGravida, persPartus, persAbortus, persOnsetKontraksi, deliveries,
  ]);

  // Register payload builder with parent
  useEffect(() => {
    onBuildPayload(() => buildPayload());
  }, [buildPayload, onBuildPayload]);

  // ========= Payor onChange =========
  const handlePayorChange = (val: string) => {
    setPayorId(val);
    const found = payorOptions.find((p) => p.value === val);
    if (found) setPayorCd(found.cd);
  };

  // ========= Delivery helpers =========
  const addDelivery = () => {
    const d = emptyDelivery();
    d.delivery_sequence = String(deliveries.length + 1);
    setDeliveries([...deliveries, d]);
  };

  const updateDelivery = (idx: number, field: keyof DeliveryEntry, value: string) => {
    setDeliveries((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: value };
      return copy;
    });
  };

  const removeDelivery = (idx: number) => {
    setDeliveries((prev) => prev.filter((_, i) => i !== idx).map((d, i) => ({ ...d, delivery_sequence: String(i + 1) })));
  };

  // ========= Render =========
  const ApgarSelect = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value="0">0</SelectItem>
        <SelectItem value="1">1</SelectItem>
        <SelectItem value="2">2</SelectItem>
      </SelectContent>
    </Select>
  );

  return (
    <div className="space-y-2">
      {disabled && (
        <div className="rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 p-3">
          <p className="text-sm text-amber-800 dark:text-amber-200">Data klaim terkunci karena iDRG sudah di-finalisasi. Untuk mengubah, lakukan Edit Ulang iDRG terlebih dahulu.</p>
        </div>
      )}
      {detail.set_claim_data_success && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
          <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-green-800 dark:text-green-200">Data klaim sudah dikirim ke E-Klaim</p>
            {detail.set_claim_data_sent_at && (
              <p className="text-xs text-green-600 dark:text-green-400">
                Terakhir dikirim: {(() => { try { return format(new Date(detail.set_claim_data_sent_at), 'dd MMM yyyy HH:mm', { locale: localeId }); } catch { return detail.set_claim_data_sent_at; } })()}
              </p>
            )}
          </div>
        </div>
      )}
      {detail.form_data_saved && !detail.set_claim_data_success && (
        <div className="flex items-center gap-2 p-3 rounded-md bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
          <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Data klaim tersimpan lokal, tapi belum berhasil dikirim ke E-Klaim</p>
            <p className="text-xs text-amber-600 dark:text-amber-400">Klik &quot;Kirim Data Klaim&quot; untuk mengirim ulang ke server E-Klaim</p>
          </div>
        </div>
      )}

      <div className={disabled ? 'pointer-events-none opacity-60' : ''}>

      {/* ===================== Data Umum ===================== */}
      <SectionHeader title="Data Umum" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>Tanggal &amp; Jam Masuk</Label>
          <Input type="datetime-local" step="1" value={tglMasuk} onChange={(e) => setTglMasuk(e.target.value)} />
          <p className="text-[10px] text-muted-foreground">Format: yyyy-mm-dd HH:mm:ss (wajib INACBG)</p>
        </div>
        <div className="space-y-1.5">
          <Label>Tanggal &amp; Jam Pulang</Label>
          <Input type="datetime-local" step="1" value={tglPulang} onChange={(e) => setTglPulang(e.target.value)} />
          <p className="text-[10px] text-muted-foreground">Format: yyyy-mm-dd HH:mm:ss (wajib INACBG)</p>
        </div>
        <div className="space-y-1.5">
          <Label>Cara Masuk</Label>
          <Select value={caraMasuk} onValueChange={setCaraMasuk}>
            <SelectTrigger><SelectValue placeholder="Pilih cara masuk" /></SelectTrigger>
            <SelectContent>
              {caraMasukOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Jenis Rawat</Label>
          <Select value={jenisRawat} onValueChange={setJenisRawat}>
            <SelectTrigger><SelectValue placeholder="Pilih jenis rawat" /></SelectTrigger>
            <SelectContent>
              {jenisRawatOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Kelas Rawat</Label>
          <Select value={kelasRawat} onValueChange={setKelasRawat}>
            <SelectTrigger><SelectValue placeholder="Pilih kelas rawat" /></SelectTrigger>
            <SelectContent>
              {kelasRawatOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Status Pulang</Label>
          <Select value={dischargeStatus} onValueChange={setDischargeStatus}>
            <SelectTrigger><SelectValue placeholder="Pilih status pulang" /></SelectTrigger>
            <SelectContent>
              {dischargeStatusOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ===================== Dokter & Coder ===================== */}
      <SectionHeader title="Dokter &amp; Coder" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Nama Dokter</Label>
          <Input value={namaDokter} onChange={(e) => setNamaDokter(e.target.value)} placeholder="Nama dokter penanggung jawab" />
        </div>
        <div className="space-y-1.5">
          <Label>NIK Coder <span className="text-destructive">*</span></Label>
          <Input value={coderNik} onChange={(e) => setCoderNik(e.target.value)} placeholder="NIK petugas coder (wajib)" />
          <p className="text-[10px] text-muted-foreground">NIK harus terdaftar di Personnel Registration E-Klaim</p>
        </div>
      </div>

      {/* ===================== Tarif & Payor ===================== */}
      <SectionHeader title="Tarif &amp; Payor" />
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Kode Tarif</Label>
            <Select value={kodeTarif} onValueChange={setKodeTarif}>
              <SelectTrigger><SelectValue placeholder="Pilih kode tarif" /></SelectTrigger>
              <SelectContent>
                {kodeTarifOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Payor <span className="text-destructive">*</span></Label>
            <Select value={payorId} onValueChange={handlePayorChange}>
              <SelectTrigger><SelectValue placeholder="Pilih jaminan" /></SelectTrigger>
              <SelectContent>
                {payorOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>COB Code</Label>
            <Input value={cobCd} onChange={(e) => setCobCd(e.target.value)} placeholder='Kosong / "#" untuk hapus' />
            <p className="text-[10px] text-muted-foreground">Coordination of Benefits. Isi &quot;#&quot; untuk menghapus.</p>
          </div>
        </div>
        {jenisRawat === '2' && kelasRawat === '1' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>Tarif Poli Eksekutif</Label>
              <Input type="number" value={tarifPoliEks} onChange={(e) => setTarifPoliEks(e.target.value)} placeholder="0" />
              <p className="text-[10px] text-muted-foreground">Khusus rawat jalan kelas eksekutif</p>
            </div>
          </div>
        )}
      </div>

      {/* ===================== Tarif RS (Breakdown) ===================== */}
      <SectionHeader title="Tarif RS (Breakdown E-Klaim)">
        <span className="text-xs font-mono text-muted-foreground">
          {formatRp(detail.rm_duplicate?.total_tarif || detail.tarif_rs || 0)}
        </span>
      </SectionHeader>
      {detail.rm_duplicate ? (() => {
        const rm = detail.rm_duplicate!;
        const rows = [
          ['Prosedur Non Bedah', rm.tarif_prosedur_non_bedah],
          ['Prosedur Bedah', rm.tarif_prosedur_bedah],
          ['Konsultasi', rm.tarif_konsultasi],
          ['Tenaga Ahli', rm.tarif_tenaga_ahli],
          ['Keperawatan', rm.tarif_keperawatan],
          ['Penunjang', rm.tarif_penunjang],
          ['Radiologi', rm.tarif_radiologi],
          ['Laboratorium', rm.tarif_laboratorium],
          ['Pelayanan Darah', rm.tarif_pelayanan_darah],
          ['Rehabilitasi', rm.tarif_rehabilitasi],
          ['Kamar / Akomodasi', rm.tarif_kamar],
          ['Rawat Intensif', rm.tarif_rawat_intensif],
          ['Obat', rm.tarif_obat],
          ['Obat Kronis', rm.tarif_obat_kronis],
          ['Obat Kemoterapi', rm.tarif_obat_kemoterapi],
          ['Alkes', rm.tarif_alkes],
          ['BMHP', rm.tarif_bmhp],
          ['Sewa Alat', rm.tarif_sewa_alat],
        ] as [string, number][];
        return (
          <div className="space-y-1">
            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
              {rows.map(([label, val]) => (
                <div key={label} className="flex justify-between items-center py-0.5 text-sm">
                  <span className="text-muted-foreground">{label}</span>
                  <span className="font-mono">{formatRp(val || 0)}</span>
                </div>
              ))}
            </div>
            <Separator />
            <div className="flex justify-between items-center py-1 text-sm font-semibold">
              <span>Total Tarif RS</span>
              <span className="font-mono">{formatRp(rm.total_tarif || 0)}</span>
            </div>
            <div className="flex items-center justify-between pt-2">
              <p className="text-[10px] text-muted-foreground">Tarif dikelola di tab RM Duplikat. Edit di sana untuk mengubah.</p>
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs gap-1"
                onClick={async (e) => {
                  e.stopPropagation();
                  try { await eklaimLocalApi.syncBillingTarif(detail.id); onRefresh?.(); }
                  catch (err: any) { alert(err?.response?.data?.error || 'Gagal sync tarif dari billing'); }
                }}>
                <RefreshCw className="h-3 w-3" /> Sync dari Billing
              </Button>
            </div>
          </div>
        );
      })() : (
        <p className="text-sm text-muted-foreground">Belum ada data tarif. Isi di tab RM Duplikat.</p>
      )}

      {/* ===================== ICU & Ventilator ===================== */}
      <SectionHeader title="ICU &amp; Ventilator" />
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>ICU Indikator</Label>
            <Select value={icuIndikator} onValueChange={setIcuIndikator}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Tidak</SelectItem>
                <SelectItem value="1">Ya</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {icuIndikator === '1' && (
            <>
              <div className="space-y-1.5">
                <Label>ICU LOS (hari)</Label>
                <Input type="number" value={icuLos} onChange={(e) => setIcuLos(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Ventilator (jam)</Label>
                <Input type="number" value={ventilatorHour} onChange={(e) => setVentilatorHour(e.target.value)} />
              </div>
            </>
          )}
        </div>
        {icuIndikator === '1' && (
          <>
            <Separator />
            <p className="text-xs font-medium text-muted-foreground">Detail Ventilator</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label>Pemakaian Ventilator</Label>
                <Select value={ventilatorUseInd} onValueChange={setVentilatorUseInd}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Tidak Ada</SelectItem>
                    <SelectItem value="1">Ada Pemakaian</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {ventilatorUseInd === '1' && (
                <>
                  <div className="space-y-1.5">
                    <Label>Waktu Mulai</Label>
                    <Input type="datetime-local" value={ventilatorStart} onChange={(e) => setVentilatorStart(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Waktu Selesai</Label>
                    <Input type="datetime-local" value={ventilatorStop} onChange={(e) => setVentilatorStop(e.target.value)} />
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* ===================== Tekanan Darah ===================== */}
      <SectionHeader title="Tekanan Darah" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Sistole (mmHg)</Label>
          <Input type="number" value={sistole} onChange={(e) => setSistole(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>Diastole (mmHg)</Label>
          <Input type="number" value={diastole} onChange={(e) => setDiastole(e.target.value)} />
        </div>
      </div>

      {/* ===================== Neonatus & ADL ===================== */}
      <SectionHeader title="Neonatus &amp; ADL" />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label>Berat Lahir (gram)</Label>
          <Input type="number" value={birthWeight} onChange={(e) => setBirthWeight(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>ADL Sub-Acute</Label>
          <Input type="number" min="12" max="60" value={adlSubAcute} onChange={(e) => setAdlSubAcute(e.target.value)} />
          <p className="text-[10px] text-muted-foreground">Nilai 12 s/d 60</p>
        </div>
        <div className="space-y-1.5">
          <Label>ADL Chronic</Label>
          <Input type="number" min="12" max="60" value={adlChronic} onChange={(e) => setAdlChronic(e.target.value)} />
          <p className="text-[10px] text-muted-foreground">Nilai 12 s/d 60</p>
        </div>
      </div>

      {/* ===================== Upgrade Kelas ===================== */}
      <SectionHeader title="Upgrade Kelas" />
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label>Naik Kelas?</Label>
            <Select value={upgradeClassInd} onValueChange={setUpgradeClassInd}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Tidak</SelectItem>
                <SelectItem value="1">Ya</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {upgradeClassInd === '1' && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <Label>Kelas Tujuan</Label>
              <Select value={upgradeClassClass} onValueChange={setUpgradeClassClass}>
                <SelectTrigger><SelectValue placeholder="Pilih kelas" /></SelectTrigger>
                <SelectContent>
                  {upgradeClassClassOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>LOS Naik Kelas (hari)</Label>
              <Input type="number" value={upgradeClassLos} onChange={(e) => setUpgradeClassLos(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Penanggung Biaya</Label>
              <Select value={upgradeClassPayor} onValueChange={setUpgradeClassPayor}>
                <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
                <SelectContent>
                  {upgradeClassPayorOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Add Payment %</Label>
              <Input type="number" value={addPaymentPct} onChange={(e) => setAddPaymentPct(e.target.value)} />
              <p className="text-[10px] text-muted-foreground">Khusus VIP/VVIP</p>
            </div>
          </div>
        )}
        {upgradeClassInd === '1' && (
          <p className="text-[10px] text-amber-600">{'\u26A0'} Semua 5 parameter (ind, class, los, payor, add_payment_pct) harus disertakan bersamaan.</p>
        )}
      </div>

      {/* ===================== Field Khusus ===================== */}
      <SectionHeader title="Field Khusus (COVID/BBL/Hemodialisa/Stroke)" />
      <div className="space-y-4">
        {payorId === '71' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Jenis Identitas (nomor_kartu_t)</Label>
              <Select value={nomorKartuT} onValueChange={setNomorKartuT}>
                <SelectTrigger><SelectValue placeholder="Pilih jenis identitas" /></SelectTrigger>
                <SelectContent>
                  {nomorKartuTOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">Khusus Jaminan COVID-19</p>
            </div>
          </div>
        )}
        {payorId === '73' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Status Bayi Lahir</Label>
              <Select value={bayiLahirStatusCd} onValueChange={setBayiLahirStatusCd}>
                <SelectTrigger><SelectValue placeholder="Pilih status" /></SelectTrigger>
                <SelectContent>
                  {bayiLahirStatusOptions.map((o) => <SelectItem key={String(o.value)} value={String(o.value)}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">Khusus Jaminan Bayi Baru Lahir</p>
            </div>
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label>Dializer Single Use</Label>
            <Select value={dializerSingleUse} onValueChange={setDializerSingleUse}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Multiple Use</SelectItem>
                <SelectItem value="1">Single Use</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">Khusus hemodialisa (CBG N-3-15-0)</p>
          </div>
          <div className="space-y-1.5">
            <Label>Kantong Darah</Label>
            <Input type="number" min="0" value={kantongDarah} onChange={(e) => setKantongDarah(e.target.value)} />
            <p className="text-[10px] text-muted-foreground">Jumlah kantong darah</p>
          </div>
          <div className="space-y-1.5">
            <Label>Alteplase</Label>
            <Select value={alteplaseInd} onValueChange={setAlteplaseInd}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Tidak</SelectItem>
                <SelectItem value="1">Ya</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">Khusus CBG G-4-14-* (Cedera Pembuluh Darah Otak)</p>
          </div>
        </div>
      </div>

      {/* ===================== APGAR Score ===================== */}
      <SectionHeader title="APGAR Score (Neonatus)" />
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">Diperhitungkan untuk pasien berumur {'\u2264'} 1 hari. Setiap komponen diisi nilai 0, 1, atau 2.</p>
        <div>
          <p className="text-xs font-medium mb-2">Menit ke-1</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="space-y-1"><Label className="text-xs">Appearance</Label><ApgarSelect value={apgarM1Appearance} onChange={setApgarM1Appearance} /></div>
            <div className="space-y-1"><Label className="text-xs">Pulse</Label><ApgarSelect value={apgarM1Pulse} onChange={setApgarM1Pulse} /></div>
            <div className="space-y-1"><Label className="text-xs">Grimace</Label><ApgarSelect value={apgarM1Grimace} onChange={setApgarM1Grimace} /></div>
            <div className="space-y-1"><Label className="text-xs">Activity</Label><ApgarSelect value={apgarM1Activity} onChange={setApgarM1Activity} /></div>
            <div className="space-y-1"><Label className="text-xs">Respiration</Label><ApgarSelect value={apgarM1Respiration} onChange={setApgarM1Respiration} /></div>
          </div>
          <p className="text-[10px] text-right text-muted-foreground mt-1">
            Total: {parseInt(apgarM1Appearance) + parseInt(apgarM1Pulse) + parseInt(apgarM1Grimace) + parseInt(apgarM1Activity) + parseInt(apgarM1Respiration)}
          </p>
        </div>
        <Separator />
        <div>
          <p className="text-xs font-medium mb-2">Menit ke-5</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="space-y-1"><Label className="text-xs">Appearance</Label><ApgarSelect value={apgarM5Appearance} onChange={setApgarM5Appearance} /></div>
            <div className="space-y-1"><Label className="text-xs">Pulse</Label><ApgarSelect value={apgarM5Pulse} onChange={setApgarM5Pulse} /></div>
            <div className="space-y-1"><Label className="text-xs">Grimace</Label><ApgarSelect value={apgarM5Grimace} onChange={setApgarM5Grimace} /></div>
            <div className="space-y-1"><Label className="text-xs">Activity</Label><ApgarSelect value={apgarM5Activity} onChange={setApgarM5Activity} /></div>
            <div className="space-y-1"><Label className="text-xs">Respiration</Label><ApgarSelect value={apgarM5Respiration} onChange={setApgarM5Respiration} /></div>
          </div>
          <p className="text-[10px] text-right text-muted-foreground mt-1">
            Total: {parseInt(apgarM5Appearance) + parseInt(apgarM5Pulse) + parseInt(apgarM5Grimace) + parseInt(apgarM5Activity) + parseInt(apgarM5Respiration)}
          </p>
        </div>
      </div>

      {/* ===================== Persalinan ===================== */}
      <SectionHeader title="Persalinan" />
      <div className="space-y-4">
        <p className="text-xs text-muted-foreground">Diperhitungkan untuk rawat inap dengan diagnosa persalinan.</p>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="space-y-1.5">
            <Label>Usia Kehamilan (minggu)</Label>
            <Input type="number" value={persUsiaKehamilan} onChange={(e) => setPersUsiaKehamilan(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Gravida</Label>
            <Input type="number" value={persGravida} onChange={(e) => setPersGravida(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Partus</Label>
            <Input type="number" value={persPartus} onChange={(e) => setPersPartus(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Abortus</Label>
            <Input type="number" value={persAbortus} onChange={(e) => setPersAbortus(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Onset Kontraksi</Label>
            <Select value={persOnsetKontraksi} onValueChange={setPersOnsetKontraksi}>
              <SelectTrigger><SelectValue placeholder="Pilih" /></SelectTrigger>
              <SelectContent>
                {onsetKontraksiOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <Separator />
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium">Delivery</p>
            <Button type="button" variant="outline" size="sm" onClick={addDelivery}>
              <Plus className="mr-1 h-3 w-3" /> Tambah Bayi
            </Button>
          </div>
          {deliveries.map((del, idx) => (
            <div key={idx} className="rounded-md border p-3 space-y-3 bg-muted/30">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium">Bayi #{del.delivery_sequence}</p>
                <Button type="button" variant="ghost" size="sm" className="h-7 text-destructive" onClick={() => removeDelivery(idx)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Metode Persalinan</Label>
                  <Select value={del.delivery_method} onValueChange={(v) => updateDelivery(idx, 'delivery_method', v)}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{deliveryMethodOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Waktu Kelahiran</Label>
                  <Input className="h-8" type="datetime-local" value={del.delivery_dttm} onChange={(e) => updateDelivery(idx, 'delivery_dttm', e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Letak Janin</Label>
                  <Select value={del.letak_janin} onValueChange={(v) => updateDelivery(idx, 'letak_janin', v)}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{letakJaninOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Kondisi Bayi</Label>
                  <Select value={del.kondisi} onValueChange={(v) => updateDelivery(idx, 'kondisi', v)}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent>{kondisiBayiOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Manual</Label>
                  <Select value={del.use_manual} onValueChange={(v) => updateDelivery(idx, 'use_manual', v)}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="0">Tidak</SelectItem><SelectItem value="1">Ya</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Forcep</Label>
                  <Select value={del.use_forcep} onValueChange={(v) => updateDelivery(idx, 'use_forcep', v)}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="0">Tidak</SelectItem><SelectItem value="1">Ya</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Vacuum</Label>
                  <Select value={del.use_vacuum} onValueChange={(v) => updateDelivery(idx, 'use_vacuum', v)}>
                    <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="0">Tidak</SelectItem><SelectItem value="1">Ya</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
              <Separator />
              <p className="text-[10px] font-medium text-muted-foreground">Skrining Hipotiroid Kongenital (SHK)</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Spesimen Diambil?</Label>
                  <Select value={del.shk_spesimen_ambil} onValueChange={(v) => updateDelivery(idx, 'shk_spesimen_ambil', v)}>
                    <SelectTrigger className="h-8"><SelectValue placeholder="Pilih" /></SelectTrigger>
                    <SelectContent><SelectItem value="ya">Ya</SelectItem><SelectItem value="tidak">Tidak</SelectItem></SelectContent>
                  </Select>
                </div>
                {del.shk_spesimen_ambil === 'ya' && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs">Lokasi Pengambilan</Label>
                      <Select value={del.shk_lokasi} onValueChange={(v) => updateDelivery(idx, 'shk_lokasi', v)}>
                        <SelectTrigger className="h-8"><SelectValue placeholder="Pilih" /></SelectTrigger>
                        <SelectContent>{shkLokasiOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Waktu Pengambilan</Label>
                      <Input className="h-8" type="datetime-local" value={del.shk_spesimen_dttm} onChange={(e) => updateDelivery(idx, 'shk_spesimen_dttm', e.target.value)} />
                    </div>
                  </>
                )}
                {del.shk_spesimen_ambil === 'tidak' && (
                  <div className="space-y-1">
                    <Label className="text-xs">Alasan</Label>
                    <Select value={del.shk_alasan} onValueChange={(v) => updateDelivery(idx, 'shk_alasan', v)}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Pilih" /></SelectTrigger>
                      <SelectContent>{shkAlasanOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          ))}
          {deliveries.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-3">Belum ada data delivery. Klik &quot;Tambah Bayi&quot; untuk menambahkan.</p>
          )}
        </div>
      </div>
      </div>

      {/* Submit Button */}
      <Separator className="my-4" />
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          {!detail.new_claim_success && 'Buat klaim baru terlebih dahulu sebelum mengirim data.'}
          {detail.new_claim_success && disabled && 'Form terkunci setelah iDRG final. Reedit iDRG untuk mengubah.'}
        </div>
        <Button
          onClick={onSubmitClaimData}
          disabled={submitting || !detail.new_claim_success || disabled}
        >
          {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          {(detail.set_claim_data_success || detail.form_data_saved) ? 'Update Data Klaim' : 'Kirim Data Klaim'}
        </Button>
      </div>
    </div>
  );
}

