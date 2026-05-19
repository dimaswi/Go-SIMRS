import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  eklaimLocalApi,
  eklaimLocalStatusLabels,
  eklaimLocalStatusColors,
} from '@/lib/api/eklaim-local';
import type {
  EKlaimLocal,
  EKlaimLocalStatus,
  OriginalRM,
} from '@/lib/api/eklaim-local';
import { RMDuplicateTab } from './rm-duplicate-tab';
import CetakanTab from './cetakan-tab';
import ClaimDataTab from './claim-data-tab';
import IDRGCodingTab from './idrg-coding-tab';
import INACBGCodingTab from './inacbg-coding-tab';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import {
  Loader2,
  ArrowLeft,
  FileText,
  Send,
  Printer,
  Play,
  CheckCircle,
  XCircle,
  Trash2,
  ScrollText,
  AlertTriangle,
  RotateCcw,
  MoreVertical,
  UserPen,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

export default function EklaimDetailPage({ mode }: { mode?: 'rekam-medis' | 'cetakan' }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState<EKlaimLocal | null>(null);
  const [originalRM, setOriginalRM] = useState<OriginalRM>({});
  const hasSyncedClaimDataOnLoadRef = useRef(false);
  const mainStickyHeaderRef = useRef<HTMLDivElement | null>(null);

  // Claim form payload builder (provided by ClaimDataTab)
  const claimPayloadBuilderRef = useRef<(() => Record<string, any>) | null>(null);

  // Active tab state - persisted in localStorage per claim
  const [activeTab, setActiveTabRaw] = useState(() => {
    try {
      if (mode) return mode;
      return localStorage.getItem(`eklaim-tab-${id}`) || 'claim-data';
    } catch {
      return 'claim-data';
    }
  });
  const setActiveTab = useCallback((tab: string) => {
    setActiveTabRaw(tab);
    try { localStorage.setItem(`eklaim-tab-${id}`, tab); } catch { /* ignore */ }
  }, [id]);

  // Dialogs
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [updatePatientOpen, setUpdatePatientOpen] = useState(false);
  const [showHeaderPanels, setShowHeaderPanels] = useState(false);
  const [updatePatientForm, setUpdatePatientForm] = useState({
    nomor_kartu: '',
    nomor_rm: '',
    nama_pasien: '',
    tgl_lahir: '',
    gender: 0,
  });

  const loadData = useCallback(async (showLoading = true) => {
    if (!id) return;
    if (showLoading) setLoading(true);
    try {
      const response = await eklaimLocalApi.getDetail(Number(id));
      const d: EKlaimLocal = response.data || response;
      const orm: OriginalRM = response.original_rm || {};

      // Merge buttons from response into detail (for workflow action visibility)
      if (response.buttons) {
        d.buttons = response.buttons;
      }

      // Patch rm_duplicate from original RM if fields are empty
      if (d.rm_duplicate && !d.rm_duplicate.chief_complaint && !d.rm_duplicate.history_of_present_illness) {
        const a = orm.anamnesis;
        const pe = orm.physical_examination;
        const ap = orm.assessment_plan;
        const di = orm.disposition;
        if (a) {
          d.rm_duplicate.chief_complaint = a.chief_complaint || '';
          d.rm_duplicate.history_of_present_illness = a.history_of_present_illness || '';
          d.rm_duplicate.past_medical_history = a.past_medical_history || '';
          d.rm_duplicate.family_history = a.family_history || '';
          d.rm_duplicate.allergies = a.allergies || '';
          d.rm_duplicate.current_medications = a.current_medications || '';
        }
        if (pe) {
          d.rm_duplicate.general_condition = pe.general_condition || '';
          d.rm_duplicate.consciousness = pe.consciousness || '';
          d.rm_duplicate.blood_pressure = pe.blood_pressure || '';
          d.rm_duplicate.systolic = pe.systolic || 0;
          d.rm_duplicate.diastolic = pe.diastolic || 0;
          d.rm_duplicate.heart_rate = pe.heart_rate || '';
          d.rm_duplicate.respiratory_rate = pe.respiratory_rate || '';
          d.rm_duplicate.temperature = pe.temperature || '';
          d.rm_duplicate.oxygen_saturation = pe.oxygen_saturation || '';
          d.rm_duplicate.weight = pe.weight || '';
          d.rm_duplicate.height = pe.height || '';
          d.rm_duplicate.bmi = pe.bmi || 0;
          d.rm_duplicate.head_neck = pe.head_neck || '';
          d.rm_duplicate.eyes = pe.eyes || '';
          d.rm_duplicate.ent = pe.ent || '';
          d.rm_duplicate.thorax = pe.thorax || '';
          d.rm_duplicate.cardiac = pe.cardiac || '';
          d.rm_duplicate.pulmonary = pe.pulmonary || '';
          d.rm_duplicate.abdomen = pe.abdomen || '';
          d.rm_duplicate.extremities = pe.extremities || '';
          d.rm_duplicate.neurological = pe.neurological || '';
          d.rm_duplicate.skin = pe.skin || '';
        }
        if (ap) {
          d.rm_duplicate.clinical_assessment = ap.clinical_assessment || '';
          d.rm_duplicate.prognosis = ap.prognosis || '';
          d.rm_duplicate.treatment_plan = ap.treatment_plan || '';
          d.rm_duplicate.medication_plan = ap.medication_plan || '';
        }
        if (di) {
          d.rm_duplicate.disposition_type = di.disposition_type || '';
          d.rm_duplicate.rm_discharge_status = di.discharge_status || '';
          d.rm_duplicate.discharge_condition = di.discharge_condition || '';
          d.rm_duplicate.discharge_instruction = di.discharge_instruction || '';
          d.rm_duplicate.follow_up_instruction = di.follow_up_instruction || '';
        }
        // Patch diagnoses from original if empty
        if ((!d.rm_duplicate.diagnoses || d.rm_duplicate.diagnoses.length === 0) && orm.diagnoses && orm.diagnoses.length > 0) {
          d.rm_duplicate.diagnoses = orm.diagnoses.map((diag, i) => ({
            icd10_code: diag.icd10_code,
            icd10_name: diag.icd10_name,
            type: diag.type as 'primary' | 'secondary' | 'complication',
            sequence: i + 1,
          }));
        }
      }

      setDetail(d);
      setOriginalRM(orm);
    } catch {
      toast({ variant: 'destructive', title: 'Error!', description: 'Gagal memuat detail E-Klaim.' });
    } finally {
      setLoading(false);
    }
  }, [id, toast]);

  useEffect(() => {
    setPageTitle('Detail E-Klaim');
    loadData();
  }, [loadData]);

  useEffect(() => {
    // Reset one-time sync flag when navigating to another SEP detail
    hasSyncedClaimDataOnLoadRef.current = false;
  }, [id]);



  // Guard: if stored tab is no longer valid, fall back
  useEffect(() => {
    if (!detail) return;
    if (activeTab === 'inacbg' && !detail.idrg_final_success) {
      setActiveTab('idrg');
    }
  }, [detail, activeTab, setActiveTab]);

  // Refresh without loading spinner (for child tab callbacks)
  const refreshData = useCallback(() => loadData(false), [loadData]);

  useEffect(() => {
    // One-time auto sync from E-Klaim when page is first loaded.
    // Requirement: check workflow button eligibility first, then sync once without loop.
    const runAutoSync = async () => {
      if (!id || !detail || hasSyncedClaimDataOnLoadRef.current) return;

      const hasAnyWorkflowButton = Object.values(detail.buttons || {}).some(Boolean);
      const shouldSyncFromEKlaim = hasAnyWorkflowButton || !!detail.claim_final_success || !!detail.claim_send_success;
      hasSyncedClaimDataOnLoadRef.current = true;

      if (!shouldSyncFromEKlaim) return;

      try {
        await eklaimLocalApi.syncClaimDataFromEKlaim(Number(id));
        await loadData(false);
      } catch {
        // Silent fail to avoid interrupting page load UX.
      }
    };

    runAutoSync();
  }, [id, detail, loadData]);

  // ========= E-Klaim Actions =========
  const handleAction = async (action: string, actionData?: any) => {
    if (!id) return;
    setSubmitting(true);
    try {
      let response: any;
      switch (action) {
        case 'new_claim':
          response = await eklaimLocalApi.sendNewClaim(Number(id));
          break;
        case 'update_patient':
          response = await eklaimLocalApi.sendUpdatePatient(Number(id), actionData);
          setUpdatePatientOpen(false);
          break;
        case 'set_claim_data': {
          const payload = claimPayloadBuilderRef.current ? claimPayloadBuilderRef.current() : {};
          response = await eklaimLocalApi.sendSetClaimData(Number(id), payload);
          break;
        }
        case 'grouper':
          response = await eklaimLocalApi.sendGrouper(Number(id));
          break;
        case 'final':
          response = await eklaimLocalApi.sendFinal(Number(id));
          break;
        case 'claim_send':
          response = await eklaimLocalApi.sendClaimSend(Number(id));
          break;
        case 'claim_reedit':
          response = await eklaimLocalApi.sendClaimReedit(Number(id));
          break;
        case 'cancel':
          response = await eklaimLocalApi.sendCancel(Number(id), actionData?.reason);
          setCancelDialogOpen(false);
          setCancelReason('');
          break;
        case 'delete':
          response = await eklaimLocalApi.deleteClaim(Number(id));
          setDeleteDialogOpen(false);
          break;
        default:
          return;
      }
      toast({ variant: 'success', title: 'Berhasil!', description: response?.message || `Aksi ${action} berhasil.` });
      refreshData();
    } catch (err: any) {
      const errData = err?.response?.data;
      toast({ variant: 'destructive', title: 'Error!', description: errData?.error || `Gagal menjalankan ${action}.` });
      // If error response includes saved eklaim_local (e.g. form data saved but E-Klaim server failed),
      // update detail immediately so form shows the saved values
      if (errData?.eklaim_local) {
        setDetail(errData.eklaim_local);
      }
      refreshData();
    } finally {
      setSubmitting(false);
    }
  };

  const handlePrintClaim = async () => {
    if (!id || !detail) return;

    setSubmitting(true);
    try {
      const res = await eklaimLocalApi.getClaimPrint(Number(id));
      const rawData = res?.response?.data;
      if (!rawData || typeof rawData !== 'string') {
        throw new Error('Data PDF tidak ditemukan dari response claim_print.');
      }

      const cleanBase64 = rawData
        .replace(/^data:application\/pdf;base64,/, '')
        .replace(/\s+/g, '');

      const binary = atob(cleanBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `klaim-${detail.no_sep || id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast({ variant: 'success', title: 'Berhasil!', description: 'Berkas klaim berhasil diunduh.' });
    } catch (err: any) {
      const errMsg = err?.response?.data?.error || err?.message || 'Gagal mengambil berkas klaim.';
      toast({ variant: 'destructive', title: 'Error!', description: errMsg });
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd MMM yyyy HH:mm', { locale: localeId });
    } catch {
      return dateString;
    }
  };

  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return '-';
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="flex flex-1 flex-col px-4">
        <p className="text-muted-foreground">Data E-Klaim tidak ditemukan.</p>
        <Button variant="outline" onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali
        </Button>
      </div>
    );
  }

  const status = detail.status as EKlaimLocalStatus;

  // For rekam-medis mode: render the embedded RM tab
  if (mode === 'rekam-medis') {
    return (
      <div className="flex flex-1 min-h-0">
        <RMDuplicateTab
          eklaimId={Number(id)}
          visit={detail.visit}
          onSaved={refreshData}
        />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-muted/20">
      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex min-h-0 w-full flex-1 flex-col">
        {!mode && (
          <div
            ref={mainStickyHeaderRef}
          className="sticky top-0 z-40 border-b border-border/70 bg-background/95 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/85"
        >
          {/* Header */}
          <div
            className="flex cursor-pointer flex-col gap-4 border-b border-border/70 bg-muted/10 px-4 py-4 md:px-6 lg:flex-row lg:items-start lg:justify-between"
            onClick={() => setShowHeaderPanels((prev) => !prev)}
            title="Klik header untuk sembunyikan/tampilkan ringkasan"
          >
          <div className="flex min-w-0 items-start gap-3">
          <Button
            variant="outline"
            size="icon"
            className="mt-0.5 shrink-0 rounded-none"
            onClick={(e) => {
              e.stopPropagation();
              navigate('/eklaim/data-klaim');
            }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="flex min-w-0 items-center gap-2 text-xl font-semibold leading-tight tracking-tight text-foreground">
              <span className="border border-border/70 bg-background p-2">
                <FileText className="h-4 w-4 text-muted-foreground" />
              </span>
              Detail E-Klaim
            </h1>
            <p className="mt-1 max-w-3xl truncate text-sm leading-relaxed text-muted-foreground">
              {detail.nama_pasien} - <span className="font-mono">{detail.no_sep}</span>
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 lg:max-w-[55%] lg:justify-end" onClick={(e) => e.stopPropagation()}>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8 rounded-none"
            onClick={() => setShowHeaderPanels((prev) => !prev)}
          >
            {showHeaderPanels ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </Button>
          <Badge className={`rounded-none px-3 py-1 text-sm ${eklaimLocalStatusColors[status] || ''}`}>
            {eklaimLocalStatusLabels[status] || status}
          </Badge>

          {/* Workflow action buttons */}
          {status === 'draft' && (
            <Button
              size="sm"
              className="rounded-none"
              disabled={submitting}
              onClick={() => handleAction('new_claim')}
            >
              {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />}
              Buat Klaim
            </Button>
          )}
          {detail.buttons?.final_claim && (
            <Button
              size="sm"
              className="rounded-none"
              disabled={submitting}
              onClick={() => handleAction('final')}
            >
              {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-1 h-4 w-4" />}
              Finalisasi Klaim
            </Button>
          )}
          {detail.buttons?.send_claim && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-none"
              disabled={submitting || !detail.claim_final_success}
              onClick={handlePrintClaim}
            >
              {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Printer className="mr-1 h-4 w-4" />}
              Cetak Berkas Klaim
            </Button>
          )}
          {detail.buttons?.send_claim && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-none"
              disabled={submitting}
              onClick={() => handleAction('claim_send')}
            >
              {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
              Kirim Klaim
            </Button>
          )}

          {/* Secondary actions dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="h-8 w-8 rounded-none">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={() => navigate(`/eklaim/data-klaim/${id}/logs`)}
              >
                <ScrollText className="mr-2 h-4 w-4" />
                Lihat Log
              </DropdownMenuItem>
              {status !== 'draft' && (
                <DropdownMenuItem
                  onClick={() => {
                    const sep = detail?.sep;
                    const patient = sep?.patient;
                    const tglLahirRaw = sep?.tgl_lahir || patient?.tanggal_lahir || '';
                    const tglLahir = tglLahirRaw.length >= 10 ? tglLahirRaw.substring(0, 10) : tglLahirRaw;
                    const jk = sep?.jenis_kelamin || patient?.jenis_kelamin || '';
                    setUpdatePatientForm({
                      nomor_kartu: sep?.no_kartu || detail?.no_kartu || '',
                      nomor_rm: sep?.no_mr || patient?.no_rm || '',
                      nama_pasien: sep?.nama_pasien || detail?.nama_pasien || patient?.nama_lengkap || '',
                      tgl_lahir: tglLahir,
                      gender: jk === 'L' ? 1 : jk === 'P' ? 2 : 0,
                    });
                    setUpdatePatientOpen(true);
                  }}
                  disabled={submitting}
                >
                  <UserPen className="mr-2 h-4 w-4" />
                  Update Pasien
                </DropdownMenuItem>
              )}
              {detail.buttons?.reedit_claim && (
                <DropdownMenuItem
                  onClick={() => handleAction('claim_reedit')}
                  disabled={submitting}
                >
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Edit Ulang Klaim
                </DropdownMenuItem>
              )}
              {status !== 'draft' && (
                <DropdownMenuItem
                  onClick={() => setCancelDialogOpen(true)}
                  disabled={submitting}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Batal Klaim
                </DropdownMenuItem>
              )}
              {status !== 'draft' && (
                <DropdownMenuItem
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={submitting}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Hapus Klaim
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Error Banner */}
      {showHeaderPanels && detail.last_error && (
        <div className="mx-4 mt-3 flex items-start gap-2 border border-destructive/20 bg-destructive/10 p-3 md:mx-6">
          <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-destructive">Error terakhir</p>
            <p className="text-sm text-destructive/80">{detail.last_error}</p>
            {detail.last_error_at && (
              <p className="text-xs text-muted-foreground mt-1">{formatDate(detail.last_error_at)}</p>
            )}
          </div>
        </div>
      )}

      {/* Progress Timeline - compact, DRY */}
      {showHeaderPanels && (
      <div className="px-4 py-3 md:px-6">
      {(() => {
        const ORDER: EKlaimLocalStatus[] = ['draft', 'new_claim', 'set_claim_data', 'idrg_coded', 'idrg_grouped', 'idrg_final', 'inacbg_imported', 'inacbg_coded', 'inacbg_grouped', 'inacbg_final', 'claim_final', 'claim_sent'];
        const currentIdx = ORDER.indexOf(status);
        const stepIsActive = (s: EKlaimLocalStatus) => ORDER.indexOf(s) <= currentIdx;
        const allSteps: EKlaimLocalStatus[] = [
          'draft', 'new_claim', 'set_claim_data',
          'idrg_coded', 'idrg_grouped', 'idrg_final',
          'inacbg_imported', 'inacbg_coded', 'inacbg_grouped', 'inacbg_final',
          'claim_final', 'claim_sent',
        ];
        return (
          <div className="space-y-2 border border-border/70 bg-background/95 p-3 shadow-sm">
            {/* Progress steps - single flow */}
            <div className="flex flex-wrap items-center gap-1">
              {allSteps.map((s, i) => (
                <div key={s} className="flex items-center gap-1">
                  {i > 0 && <span className="text-muted-foreground text-[8px]">-&gt;</span>}
                  <Badge variant={stepIsActive(s) ? 'default' : 'outline'} className={`text-[10px] px-1.5 py-0 h-5 ${stepIsActive(s) ? eklaimLocalStatusColors[s] : ''}`}>
                    {eklaimLocalStatusLabels[s]}
                  </Badge>
                </div>
              ))}
            </div>

            {/* Result summaries */}
            {(detail.idrg_code || detail.inacbg_cbg_code || (detail.cbg_code && !detail.idrg_code && !detail.inacbg_cbg_code)) && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {/* iDRG result */}
                {detail.idrg_code && (
                  <div className="border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs dark:border-indigo-900/60 dark:bg-indigo-950/20">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-indigo-600 dark:text-indigo-400 font-semibold text-[10px] uppercase">iDRG Result</span>
                      <Badge variant={detail.idrg_status_cd === 'normal' ? 'default' : 'destructive'} className="text-[10px] px-1.5 py-0 h-4">
                        {detail.idrg_status_cd || '-'}
                      </Badge>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono font-bold text-indigo-700 dark:text-indigo-300">{detail.idrg_code}</span>
                      <span className="text-muted-foreground truncate">{detail.idrg_description || '-'}</span>
                    </div>
                    <div className="text-muted-foreground mt-0.5">
                      Cost Weight: <span className="font-mono font-medium text-foreground">{detail.idrg_cost_weight || '-'}</span>
                    </div>
                  </div>
                )}

                {/* INACBG result */}
                {detail.inacbg_cbg_code && (
                  <div className="border border-orange-100 bg-orange-50 px-3 py-2 text-xs dark:border-orange-900/60 dark:bg-orange-950/20">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-orange-600 dark:text-orange-400 font-semibold text-[10px] uppercase">INACBG Result</span>
                      <span className="font-mono font-medium text-green-700 dark:text-green-400">{formatCurrency(parseFloat(detail.inacbg_tariff) || 0)}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono font-bold text-orange-700 dark:text-orange-300">{detail.inacbg_cbg_code}</span>
                      <span className="text-muted-foreground truncate">{detail.inacbg_cbg_description || '-'}</span>
                    </div>
                    <div className="text-muted-foreground mt-0.5">
                      Base Tarif: <span className="font-mono text-foreground">{formatCurrency(parseFloat(detail.inacbg_base_tariff) || 0)}</span>
                    </div>
                  </div>
                )}

                {/* Legacy CBG */}
                {detail.cbg_code && !detail.idrg_code && !detail.inacbg_cbg_code && (
                  <div className="border border-border/70 bg-muted/50 px-3 py-2 text-xs">
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono font-bold">{detail.cbg_code}</span>
                      <span className="text-muted-foreground truncate">{detail.cbg_description || '-'}</span>
                    </div>
                    <div className="flex gap-4 mt-0.5 text-muted-foreground">
                      <span>Tarif CBG: <span className="font-mono font-medium text-green-700">{formatCurrency(detail.cbg_tariff)}</span></span>
                      <span>Tarif RS: <span className="font-mono text-foreground">{formatCurrency(detail.hospital_tariff)}</span></span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}
      </div>
      )}

        {!mode && (
          <TabsList className="h-auto w-full justify-start gap-2 overflow-x-auto rounded-none border-0 bg-background px-4 py-3 md:px-6">
            <TabsTrigger value="claim-data" className="rounded-none border border-border/70 bg-background px-3 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground shadow-none data-[state=active]:border-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-none">Data Klaim</TabsTrigger>
            <TabsTrigger value="idrg" className="rounded-none border border-border/70 bg-background px-3 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground shadow-none data-[state=active]:border-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-none">Coding iDRG</TabsTrigger>
            {detail.idrg_final_success && (
              <TabsTrigger value="inacbg" className="rounded-none border border-border/70 bg-background px-3 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground shadow-none data-[state=active]:border-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-none">Coding INACBG</TabsTrigger>
            )}
            <TabsTrigger value="status" className="rounded-none border border-border/70 bg-background px-3 py-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground shadow-none data-[state=active]:border-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-none">Status</TabsTrigger>
          </TabsList>
        )}
        </div>
        )}



        {/* Mode: Cetakan */}
        {(mode === 'cetakan' || activeTab === 'cetakan') && (
          <div className="px-4 py-4 md:px-6">
            <CetakanTab detail={detail} originalRM={originalRM} />
          </div>
        )}

        {/* Tab: Claim Data */}
        <TabsContent value="claim-data" className="mt-0 space-y-4 px-4 py-4 md:px-6">
          <ClaimDataTab
            detail={detail}
            originalRM={originalRM}
            onBuildPayload={(builder) => { claimPayloadBuilderRef.current = builder; }}
            onRefresh={refreshData}
            disabled={detail.idrg_final_success}
            onSubmitClaimData={() => handleAction('set_claim_data')}
            submitting={submitting}
          />
        </TabsContent>

        {/* Tab: Coding iDRG */}
        <TabsContent value="idrg" className="mt-0 space-y-6 px-4 py-4 md:px-6">
          <IDRGCodingTab detail={detail} onRefresh={refreshData} />
        </TabsContent>

        {/* Tab: Coding INACBG */}
        {detail.idrg_final_success && (
          <TabsContent value="inacbg" className="mt-0 space-y-6 px-4 py-4 md:px-6">
            <INACBGCodingTab detail={detail} onRefresh={refreshData} />
          </TabsContent>
        )}

        {/* Tab: Cetakan */}
        <TabsContent value="cetakan" className="mt-0 space-y-6 px-4 py-4 md:px-6">
          <CetakanTab detail={detail} originalRM={originalRM} />
        </TabsContent>

        {/* Tab: Status (tracking only) */}
        <TabsContent value="status" className="mt-0 space-y-6 px-4 py-4 md:px-6">
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-medium">Tracking Status Klaim</h3>
              <p className="text-xs text-muted-foreground">Alur: New Claim -&gt; Set Claim Data -&gt; Coding iDRG -&gt; Coding INACBG -&gt; Claim Final -&gt; Kirim Klaim</p>
            </div>

            {/* Step tracking items (read-only status) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between p-3 rounded-md border bg-muted/20">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs">1</Badge>
                  <div>
                    <p className="text-sm font-medium">New Claim</p>
                    <p className="text-xs text-muted-foreground">
                      {detail.new_claim_sent_at
                        ? `Dikirim: ${formatDate(detail.new_claim_sent_at)}`
                        : 'Belum dikirim'}
                    </p>
                  </div>
                </div>
                {detail.new_claim_success && <CheckCircle className="h-4 w-4 text-green-600" />}
              </div>

              <div className="flex items-center justify-between p-3 rounded-md border bg-muted/20">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs">2</Badge>
                  <div>
                    <p className="text-sm font-medium">Set Claim Data</p>
                    <p className="text-xs text-muted-foreground">
                      {detail.set_claim_data_sent_at
                        ? `Dikirim: ${formatDate(detail.set_claim_data_sent_at)}`
                        : 'Belum dikirim'}
                    </p>
                  </div>
                </div>
                {detail.set_claim_data_success && <CheckCircle className="h-4 w-4 text-green-600" />}
              </div>

              <div className="flex items-center justify-between p-3 rounded-md border bg-muted/20">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs">3-4</Badge>
                  <div>
                    <p className="text-sm font-medium">Coding iDRG & INACBG</p>
                    <div className="flex gap-2 mt-1">
                      {detail.idrg_final_success ? (
                        <Badge className="bg-indigo-100 text-indigo-800 text-xs">iDRG Final</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">iDRG: Belum</Badge>
                      )}
                      {detail.inacbg_final_success ? (
                        <Badge className="bg-orange-100 text-orange-800 text-xs">INACBG Final</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">INACBG: Belum</Badge>
                      )}
                    </div>
                  </div>
                </div>
                {detail.inacbg_final_success && <CheckCircle className="h-4 w-4 text-green-600" />}
              </div>

              <div className="flex items-center justify-between p-3 rounded-md border bg-muted/20">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs">5</Badge>
                  <div>
                    <p className="text-sm font-medium">Claim Final</p>
                    <p className="text-xs text-muted-foreground">
                      {detail.claim_final_sent_at
                        ? `Dikirim: ${formatDate(detail.claim_final_sent_at)}`
                        : 'Belum dikirim'}
                    </p>
                  </div>
                </div>
                {detail.claim_final_success && <CheckCircle className="h-4 w-4 text-green-600" />}
              </div>

              <div className="flex items-center justify-between p-3 rounded-md border bg-muted/20">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs">6</Badge>
                  <div>
                    <p className="text-sm font-medium">Kirim Klaim</p>
                    <p className="text-xs text-muted-foreground">
                      {detail.claim_send_sent_at
                        ? `Dikirim: ${formatDate(detail.claim_send_sent_at)}`
                        : 'Belum dikirim'}
                    </p>
                    {detail.claim_data_last_sync_at && (
                      <p className="text-xs text-muted-foreground">
                        Sinkron E-Klaim: {formatDate(detail.claim_data_last_sync_at)}
                      </p>
                    )}
                  </div>
                </div>
                {detail.claim_send_success && <CheckCircle className="h-4 w-4 text-green-600" />}
              </div>
            </div>
          </div>

          {/* Responses */}
          {(detail.new_claim_response || detail.set_claim_data_response || detail.claim_final_response || detail.claim_send_response) && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Response Terakhir</h3>
                {detail.new_claim_response && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">New Claim</p>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-32">{detail.new_claim_response}</pre>
                  </div>
                )}
                {detail.set_claim_data_response && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Set Claim Data</p>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-32">{detail.set_claim_data_response}</pre>
                  </div>
                )}
                {detail.claim_final_response && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Claim Final</p>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-32">{detail.claim_final_response}</pre>
                  </div>
                )}
                {detail.claim_send_response && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Kirim Klaim</p>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-32">{detail.claim_send_response}</pre>
                  </div>
                )}
                {detail.claim_reedit_response && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Reedit Klaim</p>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-h-32">{detail.claim_reedit_response}</pre>
                  </div>
                )}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Batal Klaim</DialogTitle>
            <DialogDescription>
              Masukkan alasan pembatalan klaim. Aksi ini mengirim perintah batal ke E-Klaim server.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Alasan pembatalan..."
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Batal</Button>
            <Button
              variant="destructive"
              disabled={!cancelReason || submitting}
              onClick={() => handleAction('cancel', { reason: cancelReason })}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Kirim Pembatalan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Patient Dialog */}
      <Dialog open={updatePatientOpen} onOpenChange={setUpdatePatientOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Update Data Pasien</DialogTitle>
            <DialogDescription>
              Perbarui data pasien pada klaim E-Klaim. Pastikan data sudah benar sebelum mengirim.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="up-nomor-kartu">Nomor Kartu</Label>
              <Input
                id="up-nomor-kartu"
                value={updatePatientForm.nomor_kartu}
                onChange={(e) => setUpdatePatientForm((f) => ({ ...f, nomor_kartu: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="up-nomor-rm">Nomor RM</Label>
              <Input
                id="up-nomor-rm"
                value={updatePatientForm.nomor_rm}
                onChange={(e) => setUpdatePatientForm((f) => ({ ...f, nomor_rm: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="up-nama">Nama Pasien</Label>
              <Input
                id="up-nama"
                value={updatePatientForm.nama_pasien}
                onChange={(e) => setUpdatePatientForm((f) => ({ ...f, nama_pasien: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="up-tgl-lahir">Tanggal Lahir</Label>
              <Input
                id="up-tgl-lahir"
                type="date"
                value={updatePatientForm.tgl_lahir}
                onChange={(e) => setUpdatePatientForm((f) => ({ ...f, tgl_lahir: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Jenis Kelamin</Label>
              <Select
                value={String(updatePatientForm.gender)}
                onValueChange={(v) => setUpdatePatientForm((f) => ({ ...f, gender: Number(v) }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih jenis kelamin" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">Laki-laki</SelectItem>
                  <SelectItem value="2">Perempuan</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpdatePatientOpen(false)}>Batal</Button>
            <Button
              disabled={submitting || !updatePatientForm.nama_pasien}
              onClick={() => handleAction('update_patient', updatePatientForm)}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Kirim Update
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Klaim</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin menghapus klaim ini dari E-Klaim server? Data klaim akan dihapus permanen.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>Batal</Button>
            <Button
              variant="destructive"
              disabled={submitting}
              onClick={() => handleAction('delete')}
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Hapus
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}


