import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useBreadcrumb } from '@/contexts/breadcrumb-context';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { billingApi, visitsApi, printApi, type Billing, type BillingPayment, type CreatePaymentRequest } from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { 
  Loader2, 
  Receipt,
  CheckCircle,
  XCircle,
  RefreshCw,
  CreditCard,
  Printer,
  ArrowLeft,
  Percent,
  Plus,
  Shield,
  Heart,
  Banknote,
  User,
  MapPin,
  Stethoscope,
  Calendar,
  Building2,
  Smartphone,
  Clock,
  AlertCircle,
  CircleDollarSign,
  BadgeCheck,
  FileText,
  Hash,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';

interface VisitDetail {
  id: number;
  visit_number: string;
  registration_id: number;
  room_id: number;
  doctor_id?: number;
  visit_type: string;
  status: string;
  start_time?: string;
  end_time?: string;
  doctor?: {
    id: number;
    nama_lengkap: string;
    tipe_karyawan?: string;
    spesialisasi?: string;
  };
  registration?: {
    id: number;
    registration_number: string;
    registration_type: string;
    payment_method: string;
    patient_class?: string;
    bpjs_number?: string;
    insurance_name?: string;
    insurance_number?: string;
    patient?: {
      id: number;
      no_rm: string;
      nama_lengkap: string;
      jenis_kelamin: string;
      tanggal_lahir?: string;
      alamat?: string;
      no_hp?: string;
      no_telepon?: string;
    };
  };
  room?: {
    id: number;
    code: string;
    name: string;
  };
}

export default function BillingShow() {
  const { id: visitId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  
  // Visit state
  const [visit, setVisit] = useState<VisitDetail | null>(null);
  const [loadingVisit, setLoadingVisit] = useState(true);
  
  // All visits for this registration (for billing detail)
  const [allVisits, setAllVisits] = useState<VisitDetail[]>([]);
  
  // Billing state
  const [billing, setBilling] = useState<Billing | null>(null);
  const [payments, setPayments] = useState<BillingPayment[]>([]);
  const [loadingBilling, setLoadingBilling] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [printing, setPrinting] = useState(false);

  // Dialogs
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [voidPaymentDialogOpen, setVoidPaymentDialogOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidingPayment, setVoidingPayment] = useState(false);

  // Payment modal state
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [bankName, setBankName] = useState('');
  const [bpjsNumber, setBpjsNumber] = useState('');
  const [bpjsClaimCode, setBpjsClaimCode] = useState('');
  const [insuranceName, setInsuranceName] = useState('');
  const [insuranceNumber, setInsuranceNumber] = useState('');
  const [insuranceClaimCode, setInsuranceClaimCode] = useState('');
  const [submittingPayment, setSubmittingPayment] = useState(false);

  // Form values
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountReason, setDiscountReason] = useState('');
  const [adjustAmount, setAdjustAmount] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');

  // Breadcrumb: show patient name
  const { setOverride } = useBreadcrumb();
  useEffect(() => {
    const name = visit?.registration?.patient?.nama_lengkap;
    if (name) {
      setOverride({ extraSegments: [{ label: name }] });
    }
    return () => setOverride(null);
  }, [visit, setOverride]);

  const loadVisit = useCallback(async () => {
    if (!visitId) return;
    try {
      const response = await visitsApi.getById(parseInt(visitId));
      setVisit(response.data);
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Gagal memuat data kunjungan.',
      });
      navigate('/billing');
    } finally {
      setLoadingVisit(false);
    }
  }, [visitId, toast, navigate]);

  const loadBilling = useCallback(async () => {
    if (!visitId) return;
    setLoadingBilling(true);
    try {
      const response = await billingApi.getByVisitId(parseInt(visitId));
      if (response.data) {
        const { billing: billingData, visits } = response.data;
        setBilling(billingData);
        setAllVisits(visits || []);
        setDiscountAmount(billingData.discount_amount || 0);
        setDiscountReason(billingData.discount_reason || '');
        setAdjustAmount(billingData.adjust_amount || 0);
        setAdjustReason(billingData.adjust_reason || '');

        const paymentsResponse = await billingApi.getPayments(billingData.id);
        setPayments(paymentsResponse.data || []);
      }
    } catch {
      setBilling(null);
      setAllVisits([]);
    } finally {
      setLoadingBilling(false);
    }
  }, [visitId]);

  useEffect(() => {
    setPageTitle('Detail Tagihan');
    loadVisit();
    loadBilling();
  }, [loadVisit, loadBilling]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return format(parseISO(dateString), 'dd MMM yyyy HH:mm', { locale: id });
    } catch {
      return '-';
    }
  };

  const formatDateShort = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return format(parseISO(dateString), 'dd MMM yyyy', { locale: id });
    } catch {
      return '-';
    }
  };

  const calculateAge = (birthDate?: string) => {
    if (!birthDate) return '-';
    try {
      const birth = parseISO(birthDate);
      const today = new Date();
      let age = today.getFullYear() - birth.getFullYear();
      const monthDiff = today.getMonth() - birth.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
      return `${age} thn`;
    } catch {
      return '-';
    }
  };

  // Billing items grouped by visit
  const billingItems = billing?.items || [];

  const itemTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      registration: 'Pendaftaran', procedure: 'Tindakan', radiology: 'Radiologi',
      laboratory: 'Laboratorium', consultation: 'Konsultasi', medicine: 'Obat',
      room: 'Biaya Kamar', other: 'Lainnya',
    };
    return labels[type] || type;
  };

  // Group items by source_visit_id, then by item_type within each visit
  const itemsByVisit = useMemo(() => {
    const visitMap = new Map<number | string, { visit: any; items: any[]; total: number }>();

    for (const item of billingItems) {
      const vid = item.source_visit_id || 'unknown';
      if (!visitMap.has(vid)) {
        const matchedVisit = item.source_visit
          ? item.source_visit
          : allVisits.find((v: any) => v.id === vid);
        visitMap.set(vid, { visit: matchedVisit || null, items: [], total: 0 });
      }
      const group = visitMap.get(vid)!;
      group.items.push(item);
      group.total += item.subtotal || 0;
    }

    return Array.from(visitMap.values());
  }, [billingItems, allVisits]);

  // === HANDLERS ===
  const handleGenerateBilling = async () => {
    if (!visitId) return;
    setGenerating(true);
    try {
      await billingApi.generate(parseInt(visitId));
      toast({ title: 'Berhasil', description: 'Tagihan berhasil dibuat.' });
      loadBilling();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({ variant: 'destructive', title: 'Error', description: err.response?.data?.error || 'Gagal membuat tagihan.' });
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerateBilling = async () => {
    if (!visitId) return;
    setRegenerating(true);
    try {
      await billingApi.generate(parseInt(visitId));
      toast({ title: 'Berhasil', description: 'Tagihan berhasil di-regenerate.' });
      loadBilling();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({ variant: 'destructive', title: 'Error', description: err.response?.data?.error || 'Gagal regenerate tagihan.' });
    } finally {
      setRegenerating(false);
    }
  };

  const handleFinalize = async () => {
    if (!billing) return;
    setFinalizing(true);
    try {
      await billingApi.finalize(billing.id);
      toast({ title: 'Berhasil', description: 'Tagihan difinalisasi. Silakan proses pembayaran.' });
      loadBilling();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({ variant: 'destructive', title: 'Error', description: err.response?.data?.error || 'Gagal memfinalisasi.' });
    } finally {
      setFinalizing(false);
    }
  };

  const handleCancel = async () => {
    if (!billing || !cancelReason) return;
    setCancelling(true);
    try {
      await billingApi.cancel(billing.id, cancelReason);
      toast({ title: 'Berhasil', description: 'Tagihan dibatalkan.' });
      setCancelDialogOpen(false);
      loadBilling();
      loadVisit();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({ variant: 'destructive', title: 'Error', description: err.response?.data?.error || 'Gagal membatalkan.' });
    } finally {
      setCancelling(false);
    }
  };

  const handleVoidPayment = async () => {
    if (!selectedPaymentId || !voidReason) return;
    setVoidingPayment(true);
    try {
      await billingApi.voidPayment(selectedPaymentId, voidReason);
      toast({ title: 'Berhasil', description: 'Pembayaran dibatalkan.' });
      setVoidPaymentDialogOpen(false);
      setSelectedPaymentId(null);
      setVoidReason('');
      loadBilling();
      loadVisit();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({ variant: 'destructive', title: 'Error', description: err.response?.data?.error || 'Gagal membatalkan pembayaran.' });
    } finally {
      setVoidingPayment(false);
    }
  };

  const handlePrintBilling = async (mode?: 'per_visit' | 'combined', visitId?: number) => {
    if (!billing) return;
    setPrinting(true);
    try {
      const options: { mode?: string; visit_id?: number } = {};
      if (mode === 'per_visit') options.mode = 'per_visit';
      if (visitId) options.visit_id = visitId;
      await printApi.billing(billing.id, Object.keys(options).length > 0 ? options : undefined);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({ variant: 'destructive', title: 'Error', description: err.response?.data?.error || 'Gagal mencetak.' });
    } finally {
      setPrinting(false);
    }
  };

  const handleUpdateDiscount = async () => {
    if (!billing) return;
    try {
      await billingApi.updateDiscount(billing.id, {
        discount_amount: discountAmount,
        discount_reason: discountReason,
        adjust_amount: billing.adjust_amount || 0,
        adjust_reason: billing.adjust_reason || '',
      });
      toast({ title: 'Berhasil', description: 'Diskon diperbarui.' });
      setDiscountDialogOpen(false);
      loadBilling();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({ variant: 'destructive', title: 'Error', description: err.response?.data?.error || 'Gagal memperbarui diskon.' });
    }
  };

  const handleUpdateAdjust = async () => {
    if (!billing) return;
    try {
      await billingApi.updateDiscount(billing.id, {
        discount_amount: billing.discount_amount || 0,
        discount_reason: billing.discount_reason || '',
        adjust_amount: adjustAmount,
        adjust_reason: adjustReason,
      });
      toast({ title: 'Berhasil', description: 'Penyesuaian diperbarui.' });
      setAdjustDialogOpen(false);
      loadBilling();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({ variant: 'destructive', title: 'Error', description: err.response?.data?.error || 'Gagal memperbarui penyesuaian.' });
    }
  };

  // === PAYMENT MODAL HANDLERS ===
  const openPaymentDialog = () => {
    if (!billing) return;
    setPaymentAmount(billing.remaining_amount || 0);
    setReceivedAmount(billing.remaining_amount || 0);
    setPaymentNotes('');
    setReferenceNumber('');
    setBankName('');
    setBpjsClaimCode('');
    setInsuranceClaimCode('');
    // Default method from billing
    if (billing.payment_method === 'bpjs') {
      setPaymentMethod('bpjs');
      setBpjsNumber(billing.bpjs_number || '');
    } else if (billing.payment_method === 'insurance') {
      setPaymentMethod('insurance');
      setInsuranceName(billing.insurance_name || '');
      setInsuranceNumber(billing.insurance_no || '');
    } else {
      setPaymentMethod('cash');
    }
    setPaymentDialogOpen(true);
  };

  const handleSubmitPayment = async () => {
    if (!billing) return;

    if (paymentAmount <= 0) {
      toast({ variant: 'destructive', title: 'Error', description: 'Jumlah pembayaran harus lebih dari 0.' });
      return;
    }
    if (paymentMethod === 'cash' && receivedAmount < paymentAmount) {
      toast({ variant: 'destructive', title: 'Error', description: 'Jumlah diterima kurang dari jumlah pembayaran.' });
      return;
    }
    if (paymentMethod === 'bpjs' && !bpjsNumber) {
      toast({ variant: 'destructive', title: 'Error', description: 'Nomor BPJS wajib diisi.' });
      return;
    }
    if (paymentMethod === 'insurance' && !insuranceClaimCode) {
      toast({ variant: 'destructive', title: 'Error', description: 'Kode klaim asuransi wajib diisi.' });
      return;
    }

    setSubmittingPayment(true);
    try {
      const data: CreatePaymentRequest = {
        payment_method: paymentMethod,
        amount: paymentAmount,
        received_amount: paymentMethod === 'cash' ? receivedAmount : paymentAmount,
        notes: paymentNotes,
        reference_number: referenceNumber,
        bank_name: bankName,
        bpjs_number: bpjsNumber,
        bpjs_claim_code: bpjsClaimCode,
        insurance_name: insuranceName,
        insurance_number: insuranceNumber,
        insurance_claim_code: insuranceClaimCode,
      };
      await billingApi.createPayment(billing.id, data);
      toast({ title: 'Berhasil', description: 'Pembayaran berhasil dicatat.' });
      setPaymentDialogOpen(false);
      loadBilling();
      loadVisit();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({ variant: 'destructive', title: 'Error', description: err.response?.data?.error || 'Gagal mencatat pembayaran.' });
    } finally {
      setSubmittingPayment(false);
    }
  };

  const changeAmount = paymentMethod === 'cash' ? Math.max(0, receivedAmount - paymentAmount) : 0;

  // === HELPERS ===
  const patient = visit?.registration?.patient;
  const reg = visit?.registration;

  const getPaymentIcon = (method?: string) => {
    switch (method) {
      case 'bpjs': return <Shield className="h-3.5 w-3.5" />;
      case 'insurance': return <Heart className="h-3.5 w-3.5" />;
      default: return <Banknote className="h-3.5 w-3.5" />;
    }
  };

  const getPaymentLabel = (method?: string) => {
    switch (method) {
      case 'bpjs': return 'BPJS';
      case 'insurance': return 'Asuransi';
      default: return 'Tunai';
    }
  };

  const billingStatusBadge = (status?: string) => {
    switch (status) {
      case 'draft': return <Badge variant="secondary">Draft</Badge>;
      case 'pending': return <Badge variant="outline" className="border-yellow-500 text-yellow-600">Menunggu Bayar</Badge>;
      case 'partial': return <Badge variant="outline" className="border-blue-500 text-blue-600">Bayar Sebagian</Badge>;
      case 'paid': return <Badge className="bg-green-500">Lunas</Badge>;
      case 'cancelled': return <Badge variant="destructive">Dibatalkan</Badge>;
      default: return null;
    }
  };

  const visitTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      outpatient: 'Rawat Jalan', inpatient: 'Rawat Inap', emergency: 'UGD',
      lab: 'Lab', radiology: 'Radiologi', surgery: 'Operasi',
    };
    return labels[type] || type;
  };

  const visitTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'emergency': return 'bg-red-100 text-red-700 border-red-200';
      case 'inpatient': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'outpatient': return 'bg-green-100 text-green-700 border-green-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const paymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      cash: 'Tunai', bpjs: 'BPJS', insurance: 'Asuransi',
      transfer: 'Transfer', debit: 'Debit', credit: 'Kredit', qris: 'QRIS',
    };
    return labels[method] || method;
  };

  // Can regenerate for all statuses except paid
  const canRegenerate = billing && billing.status !== 'paid' && hasPermission('billing.create');

  // RENDER: Loading
  if (loadingVisit) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!visit) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-lg font-semibold">Kunjungan tidak ditemukan</p>
          <Button onClick={() => navigate('/billing')} className="mt-4">Kembali</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ========== HEADER ========== */}
      <div className="sticky top-0 z-50 bg-background border-b flex-shrink-0">
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => navigate('/billing')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            {/* Patient info compact */}
            <div className="flex items-center gap-3 min-w-0">
              <div className="hidden sm:flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm flex-shrink-0">
                {patient?.nama_lengkap
                  ? patient.nama_lengkap.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase()
                  : '?'}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-sm font-semibold truncate">{patient?.nama_lengkap || '-'}</h1>
                  <span className="text-xs text-muted-foreground font-mono flex-shrink-0">{patient?.no_rm}</span>
                  {billing && billingStatusBadge(billing.status)}
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <span>{patient?.jenis_kelamin === 'L' ? 'Laki-laki' : patient?.jenis_kelamin === 'P' ? 'Perempuan' : '-'}</span>
                  {patient?.tanggal_lahir && (
                    <><span className="text-muted-foreground/30">·</span><span>{calculateAge(patient.tanggal_lahir)}</span></>
                  )}
                  <span className="text-muted-foreground/30">·</span>
                  <span className="flex items-center gap-1">{getPaymentIcon(reg?.payment_method)} {getPaymentLabel(reg?.payment_method)}</span>
                  <span className="text-muted-foreground/30">·</span>
                  <span>{visit.room?.name || '-'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {!billing && hasPermission('billing.create') && visit.status === 'completed' && (
              <Button size="sm" onClick={handleGenerateBilling} disabled={generating}>
                {generating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Receipt className="mr-1.5 h-3.5 w-3.5" />}
                Ambil Tagihan
              </Button>
            )}
            {billing && billing.status === 'draft' && hasPermission('billing.finalize') && (
              <Button size="sm" onClick={handleFinalize} disabled={finalizing}>
                {finalizing ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="mr-1.5 h-3.5 w-3.5" />}
                Finalisasi
              </Button>
            )}
            {canRegenerate && (
              <Button variant="outline" size="sm" onClick={handleRegenerateBilling} disabled={regenerating}>
                {regenerating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1.5 h-3.5 w-3.5" />}
                {billing?.status === 'cancelled' ? 'Buat Ulang' : 'Regenerate'}
              </Button>
            )}
            {billing && billing.status !== 'paid' && billing.status !== 'cancelled' && billing.status !== 'draft' && hasPermission('billing.payment') && (
              <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={openPaymentDialog}>
                <CreditCard className="mr-1.5 h-3.5 w-3.5" />
                Bayar
              </Button>
            )}
            {billing && billing.status !== 'paid' && billing.status !== 'cancelled' && hasPermission('billing.delete') && (
              <Button variant="outline" size="sm" onClick={() => setCancelDialogOpen(true)}>
                <XCircle className="mr-1.5 h-3.5 w-3.5" />
              </Button>
            )}
            {billing && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={printing}>
                    {printing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem onClick={() => handlePrintBilling('combined')} disabled={printing}>
                    <FileText className="mr-2 h-4 w-4" />
                    <div>
                      <p className="text-sm font-medium">Cetak Gabungan</p>
                      <p className="text-xs text-muted-foreground">Semua item per kategori</p>
                    </div>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handlePrintBilling('per_visit')} disabled={printing}>
                    <Stethoscope className="mr-2 h-4 w-4" />
                    <div>
                      <p className="text-sm font-medium">Cetak Per Kunjungan</p>
                      <p className="text-xs text-muted-foreground">Item dikelompokkan per visit</p>
                    </div>
                  </DropdownMenuItem>
                  {allVisits.length > 1 && (
                    <>
                      <DropdownMenuSeparator />
                      {allVisits.map((v: any) => (
                        <DropdownMenuItem key={v.id} onClick={() => handlePrintBilling(undefined, v.id)} disabled={printing}>
                          <Receipt className="mr-2 h-4 w-4" />
                          <div>
                            <p className="text-sm font-medium">Cetak {visitTypeLabel(v.visit_type)} - {v.room?.name || 'Visit'}</p>
                            <p className="text-xs text-muted-foreground">Hanya item kunjungan ini</p>
                          </div>
                        </DropdownMenuItem>
                      ))}
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {/* ========== MAIN CONTENT ========== */}
      <div className="flex-1 overflow-auto">
        <div className="px-4 sm:px-6 py-6 space-y-6">

          {/* Loading billing state */}
          {loadingBilling && (
            <div className="py-12 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
              <span className="text-muted-foreground">Memuat data...</span>
            </div>
          )}

          {/* No billing yet */}
          {!loadingBilling && !billing && (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <Receipt className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium mb-1">Tagihan belum dibuat</p>
              <p className="text-xs text-muted-foreground mb-4">
                {visit.status === 'completed'
                  ? 'Klik "Ambil Tagihan" untuk membuat tagihan otomatis.'
                  : 'Kunjungan harus selesai terlebih dahulu untuk membuat tagihan.'
                }
              </p>
            </div>
          )}

          {/* ===== BILLING EXISTS ===== */}
          {!loadingBilling && billing && (
            <>
              {/* ===== TOP SUMMARY: 3 CARDS ===== */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                
                {/* Patient Card */}
                <div className="rounded-xl border bg-card p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <User className="h-3.5 w-3.5" /> Informasi Pasien
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">No. RM</span>
                      <span className="text-sm font-mono font-semibold">{patient?.no_rm || '-'}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Jenis Kelamin</span>
                      <span className="text-sm">{patient?.jenis_kelamin === 'L' ? 'Laki-laki' : patient?.jenis_kelamin === 'P' ? 'Perempuan' : '-'}</span>
                    </div>
                    {patient?.tanggal_lahir && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Usia</span>
                        <span className="text-sm">{calculateAge(patient.tanggal_lahir)}</span>
                      </div>
                    )}
                    {(patient?.no_hp || patient?.no_telepon) && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">Telepon</span>
                        <span className="text-sm">{patient?.no_hp || patient?.no_telepon}</span>
                      </div>
                    )}
                    {patient?.alamat && (
                      <div className="flex items-start gap-2 pt-1 border-t">
                        <MapPin className="h-3 w-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <span className="text-xs text-muted-foreground line-clamp-2">{patient.alamat}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Visit(s) Card */}
                <div className="rounded-xl border bg-card p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <Stethoscope className="h-3.5 w-3.5" /> Kunjungan ({allVisits.length || 1})
                  </div>
                  <div className="space-y-2">
                    {(allVisits.length <= 1 ? [visit] : allVisits).map((v: any, idx: number) => (
                      <div key={v.id || idx} className={`${idx > 0 ? 'pt-2 border-t' : ''}`}>
                        <div className="flex items-center justify-between mb-1">
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${visitTypeBadgeColor(v.visit_type)}`}>
                            {visitTypeLabel(v.visit_type)}
                          </Badge>
                          {v.visit_number && <span className="text-[10px] font-mono text-muted-foreground">{v.visit_number}</span>}
                        </div>
                        <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs">
                          <span className="text-muted-foreground">Ruangan</span>
                          <span className="text-right">{v.room?.name || '-'}</span>
                          <span className="text-muted-foreground">Dokter</span>
                          <span className="text-right truncate">{v.doctor?.nama_lengkap || '-'}</span>
                          {v.start_time && (
                            <>
                              <span className="text-muted-foreground">Waktu</span>
                              <span className="text-right">{formatDateShort(v.start_time)}</span>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Payment Summary Card */}
                <div className="rounded-xl border bg-card p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    <CircleDollarSign className="h-3.5 w-3.5" /> Ringkasan Pembayaran
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-mono">{formatCurrency(billing.total_amount)}</span>
                    </div>
                    {billing.discount_amount > 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Diskon</span>
                        <span className="font-mono text-orange-600">- {formatCurrency(billing.discount_amount)}</span>
                      </div>
                    )}
                    {billing.adjust_amount !== 0 && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Penyesuaian</span>
                        <span className="font-mono">{billing.adjust_amount > 0 ? '+' : ''}{formatCurrency(billing.adjust_amount)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">Total</span>
                      <span className="text-base font-mono font-bold">{formatCurrency(billing.final_amount)}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-green-600 flex items-center gap-1"><BadgeCheck className="h-3 w-3" /> Terbayar</span>
                      <span className="font-mono text-green-600">{formatCurrency(billing.paid_amount)}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">Sisa</span>
                      <span className={`text-lg font-mono font-bold ${billing.remaining_amount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(billing.remaining_amount)}
                      </span>
                    </div>
                    {/* Quick pay button inside card */}
                    {billing.status !== 'paid' && billing.status !== 'cancelled' && billing.status !== 'draft' && hasPermission('billing.payment') && (
                      <Button className="w-full mt-2 bg-green-600 hover:bg-green-700" size="sm" onClick={openPaymentDialog}>
                        <CreditCard className="mr-2 h-4 w-4" />
                        Proses Pembayaran
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {/* ===== BILLING ITEMS GROUPED BY VISIT ===== */}
              <div className="rounded-xl border overflow-hidden">
                <div className="bg-muted/40 px-4 py-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Detail Tagihan
                    <span className="font-mono text-muted-foreground font-normal text-xs">#{billing.billing_number}</span>
                  </h2>
                  <div className="flex gap-1.5">
                    {billing.status !== 'paid' && billing.status !== 'cancelled' && hasPermission('billing.update') && (
                      <>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setDiscountDialogOpen(true)}>
                          <Percent className="mr-1 h-3 w-3" /> Diskon
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setAdjustDialogOpen(true)}>
                          <Plus className="mr-1 h-3 w-3" /> Penyesuaian
                        </Button>
                      </>
                    )}
                    {canRegenerate && (
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleRegenerateBilling} disabled={regenerating}>
                        <RefreshCw className={`mr-1 h-3 w-3 ${regenerating ? 'animate-spin' : ''}`} /> Regenerate
                      </Button>
                    )}
                  </div>
                </div>

                {billingItems.length === 0 && (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                    <AlertCircle className="h-5 w-5 mx-auto mb-2 text-muted-foreground/60" />
                    Belum ada item tagihan. Klik <strong>Regenerate</strong> untuk mengambil data dari kunjungan.
                  </div>
                )}

                {/* Items grouped by visit */}
                {itemsByVisit.map((visitGroup, vIdx) => {
                  const v = visitGroup.visit;
                  // Group items by type within this visit
                  const typeGroups = new Map<string, any[]>();
                  for (const item of visitGroup.items) {
                    const type = item.item_type || 'other';
                    if (!typeGroups.has(type)) typeGroups.set(type, []);
                    typeGroups.get(type)!.push(item);
                  }

                  return (
                    <div key={vIdx}>
                      {/* Visit header - only show if multiple visits */}
                      {itemsByVisit.length > 1 && (
                        <div className="px-4 py-2.5 bg-primary/5 border-t flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Stethoscope className="h-3.5 w-3.5 text-primary" />
                            <span className="text-xs font-semibold flex items-center gap-1.5">
                              {v ? (
                                <>
                                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${visitTypeBadgeColor(v.visit_type)}`}>
                                    {visitTypeLabel(v.visit_type)}
                                  </Badge>
                                  <span>{v.room?.name || 'Kunjungan'}</span>
                                  {v.doctor?.nama_lengkap && <span className="text-muted-foreground font-normal">- {v.doctor.nama_lengkap}</span>}
                                </>
                              ) : 'Kunjungan'}
                            </span>
                          </div>
                          <span className="text-xs font-mono font-bold">{formatCurrency(visitGroup.total)}</span>
                        </div>
                      )}

                      {/* Items by type within this visit */}
                      {Array.from(typeGroups.entries()).map(([type, items]) => (
                        <div key={`${vIdx}-${type}`}>
                          <div className="px-4 py-1.5 bg-muted/20 border-t">
                            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{itemTypeLabel(type)}</span>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow className="text-xs">
                                <TableHead className="text-xs">Deskripsi</TableHead>
                                <TableHead className="text-xs">Oleh</TableHead>
                                <TableHead className="text-xs text-center w-16">Qty</TableHead>
                                <TableHead className="text-xs text-right w-28">Harga</TableHead>
                                <TableHead className="text-xs text-right w-28">Subtotal</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {items.map((item: any) => (
                                <TableRow key={item.id} className="text-xs">
                                  <TableCell className="py-2">{item.description}</TableCell>
                                  <TableCell className="py-2">
                                    {item.performed_by_name ? (
                                      <span className="text-xs">{item.performed_by_name}</span>
                                    ) : (
                                      <span className="text-muted-foreground">-</span>
                                    )}
                                  </TableCell>
                                  <TableCell className="py-2 text-center">{item.quantity}</TableCell>
                                  <TableCell className="py-2 text-right font-mono">{formatCurrency(item.unit_price)}</TableCell>
                                  <TableCell className="py-2 text-right font-mono font-medium">{formatCurrency(item.subtotal)}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      ))}
                    </div>
                  );
                })}

                {/* Totals Summary */}
                {billingItems.length > 0 && (
                  <div className="border-t px-4 py-3 space-y-1.5 bg-muted/10">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-mono">{formatCurrency(billing.total_amount)}</span>
                    </div>
                    {billing.discount_amount > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Diskon {billing.discount_reason && `(${billing.discount_reason})`}</span>
                        <span className="font-mono text-orange-600">- {formatCurrency(billing.discount_amount)}</span>
                      </div>
                    )}
                    {billing.adjust_amount !== 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Penyesuaian {billing.adjust_reason && `(${billing.adjust_reason})`}</span>
                        <span className="font-mono">{billing.adjust_amount > 0 ? '+' : ''} {formatCurrency(billing.adjust_amount)}</span>
                      </div>
                    )}
                    <Separator />
                    <div className="flex justify-between text-base font-bold pt-1">
                      <span>Total Tagihan</span>
                      <span className="font-mono text-lg">{formatCurrency(billing.final_amount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Terbayar</span>
                      <span className="font-mono text-green-600">{formatCurrency(billing.paid_amount)}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold">
                      <span>Sisa Tagihan</span>
                      <span className={`font-mono text-lg ${billing.remaining_amount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrency(billing.remaining_amount)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* ===== PAYMENT HISTORY ===== */}
              <div className="rounded-xl border overflow-hidden">
                <div className="bg-muted/40 px-4 py-3">
                  <h2 className="text-sm font-semibold flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Riwayat Pembayaran
                    {payments.length > 0 && (
                      <Badge variant="secondary" className="text-xs font-normal">{payments.length}</Badge>
                    )}
                  </h2>
                </div>
                {payments.length === 0 ? (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                    Belum ada pembayaran.
                  </div>
                ) : (
                  <div className="divide-y">
                    {payments.map((payment) => (
                      <div key={payment.id} className="px-4 py-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                            payment.status === 'completed' 
                              ? 'bg-green-100 text-green-600' 
                              : 'bg-red-100 text-red-600'
                          }`}>
                            {payment.status === 'completed' ? <Banknote className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-mono text-muted-foreground">{payment.payment_number}</span>
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                {paymentMethodLabel(payment.payment_method)}
                              </Badge>
                              {payment.status === 'voided' && (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Dibatalkan</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{formatDate(payment.payment_date)}</span>
                              {payment.cashier?.full_name && (
                                <>
                                  <span className="text-muted-foreground/30">·</span>
                                  <span>{payment.cashier.full_name}</span>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`text-sm font-mono font-bold ${payment.status === 'completed' ? 'text-green-600' : 'text-muted-foreground line-through'}`}>
                            {formatCurrency(payment.amount)}
                          </span>
                          {payment.status === 'completed' && hasPermission('billing.void_payment') && (
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-destructive hover:text-destructive"
                              onClick={() => { setSelectedPaymentId(payment.id); setVoidPaymentDialogOpen(true); }}>
                              Void
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ========== PAYMENT MODAL ========== */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-[560px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Pembayaran
            </DialogTitle>
            <DialogDescription>
              {billing?.billing_number} — {patient?.nama_lengkap}
            </DialogDescription>
          </DialogHeader>

          {/* Amount summary bar */}
          <div className="rounded-lg border bg-muted/30 p-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
              <p className="text-sm font-mono font-bold">{formatCurrency(billing?.final_amount || 0)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Terbayar</p>
              <p className="text-sm font-mono font-bold text-green-600">{formatCurrency(billing?.paid_amount || 0)}</p>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Sisa</p>
              <p className="text-sm font-mono font-bold text-red-600">{formatCurrency(billing?.remaining_amount || 0)}</p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Payment Method */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">Metode Pembayaran</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih metode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">
                    <span className="flex items-center gap-2"><Banknote className="h-4 w-4" /> Tunai</span>
                  </SelectItem>
                  {billing?.payment_method === 'bpjs' && (
                    <SelectItem value="bpjs">
                      <span className="flex items-center gap-2"><Shield className="h-4 w-4" /> BPJS Kesehatan</span>
                    </SelectItem>
                  )}
                  {billing?.payment_method === 'insurance' && (
                    <SelectItem value="insurance">
                      <span className="flex items-center gap-2"><Heart className="h-4 w-4" /> Asuransi</span>
                    </SelectItem>
                  )}
                  <SelectItem value="transfer">
                    <span className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Transfer Bank</span>
                  </SelectItem>
                  <SelectItem value="debit">
                    <span className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Kartu Debit</span>
                  </SelectItem>
                  <SelectItem value="credit">
                    <span className="flex items-center gap-2"><CreditCard className="h-4 w-4" /> Kartu Kredit</span>
                  </SelectItem>
                  <SelectItem value="qris">
                    <span className="flex items-center gap-2"><Smartphone className="h-4 w-4" /> QRIS</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* BPJS notice */}
            {paymentMethod === 'bpjs' && (
              <div className="p-3 bg-green-50 rounded-lg border border-green-200 text-sm text-green-800">
                <strong>Pembayaran BPJS</strong> — Tagihan ditanggung sepenuhnya oleh BPJS Kesehatan.
              </div>
            )}

            {/* Amount & Received */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Jumlah Bayar</Label>
                <Input type="number" value={paymentAmount} onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)} />
                <p className="text-[10px] text-muted-foreground">Maks: {formatCurrency(billing?.remaining_amount || 0)}</p>
              </div>
              {paymentMethod === 'cash' ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">Jumlah Diterima</Label>
                  <Input type="number" value={receivedAmount} onChange={(e) => setReceivedAmount(parseFloat(e.target.value) || 0)} />
                </div>
              ) : (
                <div />
              )}
            </div>

            {/* Kembalian for cash */}
            {paymentMethod === 'cash' && changeAmount > 0 && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-3 flex items-center justify-between">
                <span className="text-sm text-green-800 font-medium">Kembalian</span>
                <span className="text-lg font-mono font-bold text-green-700">{formatCurrency(changeAmount)}</span>
              </div>
            )}

            {/* BPJS fields */}
            {paymentMethod === 'bpjs' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">No. BPJS</Label>
                  <Input value={bpjsNumber} disabled className="bg-muted" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Kode Klaim (Opsional)</Label>
                  <Input value={bpjsClaimCode} onChange={(e) => setBpjsClaimCode(e.target.value)} placeholder="Kode klaim" />
                </div>
              </div>
            )}

            {/* Insurance fields */}
            {paymentMethod === 'insurance' && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nama Asuransi</Label>
                    <Input value={insuranceName} disabled className="bg-muted" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">No. Polis</Label>
                    <Input value={insuranceNumber} disabled className="bg-muted" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Kode Klaim <span className="text-red-500">*</span></Label>
                  <Input value={insuranceClaimCode} onChange={(e) => setInsuranceClaimCode(e.target.value)} placeholder="Masukkan kode klaim" />
                </div>
              </div>
            )}

            {/* Bank / Reference fields for transfer/debit/credit/qris */}
            {(paymentMethod === 'transfer' || paymentMethod === 'debit' || paymentMethod === 'credit' || paymentMethod === 'qris') && (
              <div className="grid grid-cols-2 gap-3">
                {paymentMethod !== 'qris' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs">Nama Bank</Label>
                    <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="BCA, Mandiri, BNI..." />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs flex items-center gap-1"><Hash className="h-3 w-3" /> No. Referensi</Label>
                  <Input value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} placeholder="No. transaksi" />
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs">Catatan (Opsional)</Label>
              <Textarea value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} placeholder="Catatan tambahan..." rows={2} />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Batal</Button>
            <Button className="bg-green-600 hover:bg-green-700" onClick={handleSubmitPayment} disabled={submittingPayment}>
              {submittingPayment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CreditCard className="mr-2 h-4 w-4" />}
              Proses Pembayaran
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========== OTHER DIALOGS ========== */}
      <Dialog open={discountDialogOpen} onOpenChange={setDiscountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Diskon</DialogTitle>
            <DialogDescription>Masukkan jumlah diskon dan alasannya</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Jumlah Diskon</Label>
              <Input type="number" value={discountAmount} onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>Alasan</Label>
              <Textarea value={discountReason} onChange={(e) => setDiscountReason(e.target.value)} placeholder="Alasan diskon..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscountDialogOpen(false)}>Batal</Button>
            <Button onClick={handleUpdateDiscount}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Penyesuaian</DialogTitle>
            <DialogDescription>Positif untuk tambahan, negatif untuk pengurangan</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Jumlah Penyesuaian</Label>
              <Input type="number" value={adjustAmount} onChange={(e) => setAdjustAmount(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-2">
              <Label>Alasan</Label>
              <Textarea value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} placeholder="Alasan penyesuaian..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialogOpen(false)}>Batal</Button>
            <Button onClick={handleUpdateAdjust}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Batalkan Tagihan</DialogTitle>
            <DialogDescription>Apakah Anda yakin?</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Alasan Pembatalan</Label>
            <Textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Alasan..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Kembali</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling || !cancelReason}>
              {cancelling ? 'Membatalkan...' : 'Batalkan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={voidPaymentDialogOpen} onOpenChange={setVoidPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Batalkan Pembayaran</DialogTitle>
            <DialogDescription>Apakah Anda yakin ingin membatalkan pembayaran ini?</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Alasan Pembatalan</Label>
            <Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Alasan..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setVoidPaymentDialogOpen(false); setSelectedPaymentId(null); setVoidReason(''); }}>
              Kembali
            </Button>
            <Button variant="destructive" onClick={handleVoidPayment} disabled={voidingPayment || !voidReason}>
              {voidingPayment ? 'Membatalkan...' : 'Batalkan Pembayaran'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
