import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

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
  eklaimLocalApi,
  eklaimLocalStatusLabels,
  eklaimLocalStatusColors,
} from '@/lib/api/eklaim-local';
import type {
  EKlaimLocal,
  EKlaimLocalStatus,
  OriginalRM,
} from '@/lib/api/eklaim-local';
import RMDuplicateTab from './rm-duplicate-tab';
import CetakanTab from './cetakan-tab';
import ClaimDataTab from './claim-data-tab';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import {
  Loader2,
  ArrowLeft,
  FileText,
  Send,
  Play,
  BarChart3,
  CheckCircle,
  XCircle,
  Trash2,
  ScrollText,
  AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

export default function EklaimDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [detail, setDetail] = useState<EKlaimLocal | null>(null);
  const [originalRM, setOriginalRM] = useState<OriginalRM>({});

  // Claim form payload builder (provided by ClaimDataTab)
  const claimPayloadBuilderRef = useRef<(() => Record<string, any>) | null>(null);

  // Dialogs
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const response = await eklaimLocalApi.getDetail(Number(id));
      const d: EKlaimLocal = response.data || response;
      const orm: OriginalRM = response.original_rm || {};

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
      loadData();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Error!', description: err?.response?.data?.error || `Gagal menjalankan ${action}.` });
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
      <div className="flex flex-1 flex-col gap-4 p-6">
        <p className="text-muted-foreground">Data E-Klaim tidak ditemukan.</p>
        <Button variant="outline" onClick={() => navigate('/eklaim/data-klaim')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali
        </Button>
      </div>
    );
  }

  const status = detail.status as EKlaimLocalStatus;

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => navigate('/eklaim/data-klaim')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Detail E-Klaim
            </h1>
            <p className="text-sm text-muted-foreground">
              {detail.nama_pasien} — <span className="font-mono">{detail.no_sep}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={`text-sm px-3 py-1 ${eklaimLocalStatusColors[status] || ''}`}>
            {eklaimLocalStatusLabels[status] || status}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/eklaim/data-klaim/${id}/logs`)}
          >
            <ScrollText className="mr-2 h-4 w-4" />
            Log
          </Button>
        </div>
      </div>

      {/* Error Banner */}
      {detail.last_error && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 border border-destructive/20">
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

      {/* Status Timeline */}
      <div className="rounded-lg border p-4 space-y-3">
        <h3 className="text-sm font-medium">Progress Klaim</h3>
        <div className="flex items-center gap-2 flex-wrap">
          {(['draft', 'new_claim', 'set_claim_data', 'grouped', 'finalized'] as EKlaimLocalStatus[]).map((s, i) => {
            const stepOrder = ['draft', 'new_claim', 'set_claim_data', 'grouped', 'finalized'];
            const currentIdx = stepOrder.indexOf(status);
            const stepIdx = stepOrder.indexOf(s);
            const isActive = stepIdx <= currentIdx;
            return (
              <div key={s} className="flex items-center gap-2">
                {i > 0 && <Separator className="w-6" />}
                <Badge variant={isActive ? 'default' : 'outline'} className={isActive ? eklaimLocalStatusColors[s] : ''}>
                  {eklaimLocalStatusLabels[s]}
                </Badge>
              </div>
            );
          })}
        </div>
        {/* Grouper result */}
        {detail.cbg_code && (
          <div className="p-3 rounded-md bg-muted/50">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground text-xs">Kode CBG</p>
                <p className="font-mono font-medium">{detail.cbg_code}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Deskripsi</p>
                <p className="font-medium">{detail.cbg_description || '-'}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Tarif CBG</p>
                <p className="font-mono font-medium text-green-700">{formatCurrency(detail.cbg_tariff)}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs">Tarif RS</p>
                <p className="font-mono">{formatCurrency(detail.hospital_tariff)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="rm-duplicate" className="w-full">
        <TabsList className="bg-transparent border-b rounded-none w-full justify-start h-auto p-0 gap-0">
          <TabsTrigger value="claim-data" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5">Data Klaim</TabsTrigger>
          <TabsTrigger value="rm-duplicate" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5">RM Duplikat</TabsTrigger>
          <TabsTrigger value="cetakan" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5">Cetakan</TabsTrigger>
          <TabsTrigger value="actions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5">Aksi</TabsTrigger>
        </TabsList>

        {/* Tab: Claim Data */}
        <TabsContent value="claim-data" className="space-y-4">
          <ClaimDataTab
            detail={detail}
            originalRM={originalRM}
            onBuildPayload={(builder) => { claimPayloadBuilderRef.current = builder; }}
            onRefresh={loadData}
          />
        </TabsContent>

        {/* Tab: RM Duplicate */}
        <TabsContent value="rm-duplicate" className="space-y-6">
          <RMDuplicateTab
            eklaimId={Number(id)}
            rmDuplicate={detail.rm_duplicate}
            onSaved={loadData}
          />
        </TabsContent>

        {/* Tab: Cetakan */}
        <TabsContent value="cetakan" className="space-y-6">
          <CetakanTab detail={detail} originalRM={originalRM} />
        </TabsContent>

        {/* Tab: Actions */}
        <TabsContent value="actions" className="space-y-6">
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-medium">Aksi E-Klaim</h3>
              <p className="text-xs text-muted-foreground">Jalankan aksi sesuai urutan: New Claim → Set Claim Data → Grouper → Final</p>
            </div>
            <div className="space-y-3">
              {/* Step 1: New Claim */}
              <div className="flex items-center justify-between p-3 rounded-md border">
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
                <div className="flex items-center gap-2">
                  {detail.new_claim_success && <CheckCircle className="h-4 w-4 text-green-600" />}
                  <Button
                    size="sm"
                    disabled={submitting || status !== 'draft'}
                    onClick={() => handleAction('new_claim')}
                  >
                    {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Play className="mr-1 h-4 w-4" />}
                    Kirim
                  </Button>
                </div>
              </div>

              {/* Step 2: Set Claim Data */}
              <div className="flex items-center justify-between p-3 rounded-md border">
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
                <div className="flex items-center gap-2">
                  {detail.set_claim_data_success && <CheckCircle className="h-4 w-4 text-green-600" />}
                  <Button
                    size="sm"
                    disabled={submitting || status !== 'new_claim'}
                    onClick={() => handleAction('set_claim_data')}
                  >
                    {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Send className="mr-1 h-4 w-4" />}
                    Kirim Data
                  </Button>
                </div>
              </div>

              {/* Step 3: Grouper */}
              <div className="flex items-center justify-between p-3 rounded-md border">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs">3</Badge>
                  <div>
                    <p className="text-sm font-medium">Grouper</p>
                    <p className="text-xs text-muted-foreground">
                      {detail.grouper_sent_at
                        ? `Dikirim: ${formatDate(detail.grouper_sent_at)}`
                        : 'Belum dikirim'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {detail.grouper_success && <CheckCircle className="h-4 w-4 text-green-600" />}
                  <Button
                    size="sm"
                    disabled={submitting || status !== 'set_claim_data'}
                    onClick={() => handleAction('grouper')}
                  >
                    {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <BarChart3 className="mr-1 h-4 w-4" />}
                    Grouping
                  </Button>
                </div>
              </div>

              {/* Step 4: Final */}
              <div className="flex items-center justify-between p-3 rounded-md border">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs">4</Badge>
                  <div>
                    <p className="text-sm font-medium">Finalisasi</p>
                    <p className="text-xs text-muted-foreground">
                      {detail.final_sent_at
                        ? `Dikirim: ${formatDate(detail.final_sent_at)}`
                        : 'Belum dikirim'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {detail.final_success && <CheckCircle className="h-4 w-4 text-green-600" />}
                  <Button
                    size="sm"
                    disabled={submitting || status !== 'grouped'}
                    onClick={() => handleAction('final')}
                  >
                    {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-1 h-4 w-4" />}
                    Finalisasi
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Cancel / Delete / Reedit */}
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCancelDialogOpen(true)}
                  disabled={submitting || status === 'draft'}
                >
                  <XCircle className="mr-1 h-4 w-4" />
                  Batal Klaim
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDeleteDialogOpen(true)}
                  disabled={submitting || status === 'draft'}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="mr-1 h-4 w-4" />
                  Hapus Klaim
                </Button>
              </div>
            </div>
          </div>

          {/* Responses */}
          {(detail.new_claim_response || detail.set_claim_data_response || detail.grouper_response || detail.final_response) && (
            <>
              <Separator />
              <div className="space-y-3">
                <h3 className="text-sm font-medium">Response Terakhir</h3>
                {detail.new_claim_response && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">New Claim</p>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">{detail.new_claim_response}</pre>
                  </div>
                )}
                {detail.set_claim_data_response && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Set Claim Data</p>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">{detail.set_claim_data_response}</pre>
                  </div>
                )}
                {detail.grouper_response && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Grouper</p>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">{detail.grouper_response}</pre>
                  </div>
                )}
                {detail.final_response && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Final</p>
                    <pre className="text-xs bg-muted p-2 rounded overflow-x-auto">{detail.final_response}</pre>
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
