import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
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
import { billingApi, visitsApi, printApi, type Billing, type BillingPayment } from '@/lib/api';
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
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { id } from 'date-fns/locale';
import { PatientBillingInfo } from '@/components/billing/patient-billing-info';
import { BillingTabs } from '@/components/billing/billing-tabs';
import { VisitOverview } from '@/components/billing/visit-overview';
import { BillingDetail } from '@/components/billing/billing-detail';
import { PaymentHistory } from '@/components/billing/payment-history';

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
    patient?: {
      id: number;
      no_rm: string;
      nama_lengkap: string;
      jenis_kelamin: string;
      tanggal_lahir?: string;
      alamat?: string;
    };
  };
  room?: {
    id: number;
    code: string;
    name: string;
  };
  medicine_orders?: MedicineOrder[];
  procedure_orders?: ProcedureOrder[];
  visit_procedures?: VisitProcedure[];
}

interface MedicineOrder {
  id: number;
  order_number: string;
  status: string;
  total_amount: number;
  items?: MedicineOrderItem[];
}

interface MedicineOrderItem {
  id: number;
  medicine_id: number;
  quantity: number;
  price: number;
  subtotal: number;
  medicine?: {
    id: number;
    name: string;
  };
}

interface ProcedureOrder {
  id: number;
  order_number: string;
  order_type: string;
  status: string;
  total_amount: number;
  items?: ProcedureOrderItem[];
}

interface ProcedureOrderItem {
  id: number;
  procedure_id: number;
  price: number;
  procedure?: {
    id: number;
    name: string;
    code: string;
  };
}

interface VisitProcedure {
  id: number;
  procedure_id: number;
  quantity: number;
  price: number;
  subtotal: number;
  procedure?: {
    id: number;
    name: string;
    code: string;
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

  // Tabs
  const [activeTab, setActiveTab] = useState('overview');

  // Dialogs
  const [discountDialogOpen, setDiscountDialogOpen] = useState(false);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [voidPaymentDialogOpen, setVoidPaymentDialogOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null);
  const [voidReason, setVoidReason] = useState('');
  const [voidingPayment, setVoidingPayment] = useState(false);

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

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  const loadVisit = useCallback(async () => {
    if (!visitId) return;
    try {
      const response = await visitsApi.getById(parseInt(visitId));
      setVisit(response.data);
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error!',
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
        // Response is now { billing: Billing, visits: Visit[] }
        const { billing: billingData, visits } = response.data;
        setBilling(billingData);
        setAllVisits(visits || []);
        setDiscountAmount(billingData.discount_amount || 0);
        setDiscountReason(billingData.discount_reason || '');
        setAdjustAmount(billingData.adjust_amount || 0);
        setAdjustReason(billingData.adjust_reason || '');

        // Load payments
        const paymentsResponse = await billingApi.getPayments(billingData.id);
        setPayments(paymentsResponse.data || []);
      }
    } catch {
      // Billing not found is OK
      setBilling(null);
      setAllVisits([]);
    } finally {
      setLoadingBilling(false);
    }
  }, [visitId]);

  useEffect(() => {
    setPageTitle('Kasir & Billing');
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

  const renderActiveTabContent = () => {
    switch (activeTab) {
      case 'overview':
        // Pass billing data if available, otherwise visit will show empty state
        return <VisitOverview visit={visit} billing={billing} formatCurrency={formatCurrency} />;
      case 'billing-detail':
        return billing ? (
          <BillingDetail 
            billing={billing} 
            allVisits={allVisits}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            onDiscountClick={() => setDiscountDialogOpen(true)}
            onAdjustClick={() => setAdjustDialogOpen(true)}
          />
        ) : null;
      case 'payment':
        return (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Untuk melakukan pembayaran, gunakan halaman pembayaran khusus
            </p>
            <Button onClick={() => billing && navigate(`/billing/${billing.id}/payment`)}>
              <CreditCard className="mr-2 h-4 w-4" />
              Proses Pembayaran
            </Button>
          </div>
        );
      case 'payment-history':
        return (
          <PaymentHistory 
            payments={payments}
            formatCurrency={formatCurrency}
            formatDate={formatDate}
            onVoidPayment={(paymentId) => {
              setSelectedPaymentId(paymentId);
              setVoidPaymentDialogOpen(true);
            }}
          />
        );
      default:
        return null;
    }
  };

  const renderActionButtons = () => {
    if (!visit) return null;

    return (
      <div className="flex items-center gap-1.5">
        {/* Tombol Ambil Tagihan */}
        {!billing && hasPermission('billing.create') && visit.status === 'completed' && (
          <Button size="sm" onClick={handleGenerateBilling} disabled={generating}>
            {generating ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Receipt className="mr-1.5 h-3.5 w-3.5" />
            )}
            Ambil Tagihan
          </Button>
        )}
        {/* Tombol Finalisasi */}
        {billing && billing.status === 'draft' && hasPermission('billing.finalize') && (
          <Button size="sm" onClick={handleFinalize} disabled={finalizing}>
            {finalizing ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
            )}
            Finalisasi
          </Button>
        )}
        {/* Tombol Regenerate Tagihan */}
        {billing && (billing.status === 'draft' || billing.status === 'cancelled') && hasPermission('billing.create') && (
          <Button variant="outline" size="sm" onClick={handleRegenerateBilling} disabled={regenerating}>
            {regenerating ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            )}
            {billing.status === 'cancelled' ? 'Buat Ulang' : 'Regenerate'}
          </Button>
        )}
        {/* Tombol Bayar */}
        {billing && billing.status !== 'paid' && billing.status !== 'cancelled' && billing.status !== 'draft' && hasPermission('billing.payment') && (
          <Button size="sm" onClick={() => navigate(`/billing/${billing.id}/payment`)}>
            <CreditCard className="mr-1.5 h-3.5 w-3.5" />
            Bayar
          </Button>
        )}
        {/* Tombol Batalkan */}
        {billing && billing.status !== 'paid' && billing.status !== 'cancelled' && hasPermission('billing.delete') && (
          <Button variant="outline" size="sm" onClick={() => setCancelDialogOpen(true)}>
            <XCircle className="mr-1.5 h-3.5 w-3.5" />
            Batalkan
          </Button>
        )}
        {/* Tombol Cetak */}
        {billing && (
          <Button variant="outline" size="sm" onClick={handlePrintBilling} disabled={printing}>
            {printing ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Printer className="mr-1.5 h-3.5 w-3.5" />
            )}
            Cetak
          </Button>
        )}
      </div>
    );
  };

  const handleGenerateBilling = async () => {
    if (!visitId) return;
    setGenerating(true);
    try {
      await billingApi.generate(parseInt(visitId));
      toast({
        title: 'Berhasil!',
        description: 'Tagihan berhasil dibuat.',
      });
      // Reload billing to get complete data with items
      loadBilling();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: 'destructive',
        title: 'Error!',
        description: err.response?.data?.error || 'Gagal membuat tagihan.',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerateBilling = async () => {
    if (!visitId) return;
    setRegenerating(true);
    try {
      await billingApi.generate(parseInt(visitId));
      toast({
        title: 'Berhasil!',
        description: 'Tagihan berhasil di-regenerate.',
      });
      // Reload billing to get updated data with items
      loadBilling();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: 'destructive',
        title: 'Error!',
        description: err.response?.data?.error || 'Gagal regenerate tagihan.',
      });
    } finally {
      setRegenerating(false);
    }
  };

  const handleFinalize = async () => {
    if (!billing) return;
    setFinalizing(true);
    try {
      await billingApi.finalize(billing.id);
      toast({
        title: 'Berhasil!',
        description: 'Tagihan berhasil difinalisasi. Silakan proses pembayaran.',
      });
      loadBilling();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: 'destructive',
        title: 'Error!',
        description: err.response?.data?.error || 'Gagal memfinalisasi tagihan.',
      });
    } finally {
      setFinalizing(false);
    }
  };

  const handleCancel = async () => {
    if (!billing || !cancelReason) return;
    setCancelling(true);
    try {
      await billingApi.cancel(billing.id, cancelReason);
      toast({
        title: 'Berhasil!',
        description: 'Tagihan berhasil dibatalkan. Status pendaftaran dikembalikan.',
      });
      setCancelDialogOpen(false);
      loadBilling();
      loadVisit(); // Reload visit to get updated registration status
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: 'destructive',
        title: 'Error!',
        description: err.response?.data?.error || 'Gagal membatalkan tagihan.',
      });
    } finally {
      setCancelling(false);
    }
  };

  const handleVoidPayment = async () => {
    if (!selectedPaymentId || !voidReason) return;
    setVoidingPayment(true);
    try {
      await billingApi.voidPayment(selectedPaymentId, voidReason);
      toast({
        title: 'Berhasil!',
        description: 'Pembayaran berhasil dibatalkan.',
      });
      setVoidPaymentDialogOpen(false);
      setSelectedPaymentId(null);
      setVoidReason('');
      loadBilling();
      loadVisit(); // Reload visit to get updated registration status
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: 'destructive',
        title: 'Error!',
        description: err.response?.data?.error || 'Gagal membatalkan pembayaran.',
      });
    } finally {
      setVoidingPayment(false);
    }
  };

  const handlePrintBilling = async () => {
    if (!billing) return;
    setPrinting(true);
    try {
      await printApi.billing(billing.id);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: 'destructive',
        title: 'Error!',
        description: err.response?.data?.error || 'Gagal mencetak billing.',
      });
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
      toast({
        title: 'Berhasil!',
        description: 'Diskon berhasil diperbarui.',
      });
      setDiscountDialogOpen(false);
      loadBilling();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: 'destructive',
        title: 'Error!',
        description: err.response?.data?.error || 'Gagal memperbarui diskon.',
      });
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
      toast({
        title: 'Berhasil!',
        description: 'Penyesuaian berhasil diperbarui.',
      });
      setAdjustDialogOpen(false);
      loadBilling();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: 'destructive',
        title: 'Error!',
        description: err.response?.data?.error || 'Gagal memperbarui penyesuaian.',
      });
    }
  };

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
          <Button onClick={() => navigate('/billing')} className="mt-4">
            Kembali
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Patient Info Header + Actions - Sticky */}
      <div className="sticky top-0 z-50 bg-background px-6 pt-4 pb-2 border-b flex-shrink-0">
        <PatientBillingInfo visit={visit} billing={billing} actionButtons={renderActionButtons()} />
      </div>

      {/* Main Content Area with Tabs and Form */}
      <div className="flex-1 min-h-0 px-6 pb-6 pt-4">
        <div className="grid grid-cols-1 lg:grid-cols-[190px_1fr] gap-6">
          {/* Left Sidebar: Tabs Navigation - Sticky */}
          <div className="self-start sticky top-[80px] z-30">
            <h3 className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-2.5 mb-2">
              Menu
            </h3>
            <BillingTabs
              activeTab={activeTab}
              onTabChange={handleTabChange}
              hasBilling={!!billing}
              billingStatus={billing?.status}
            />
          </div>

          {/* Right Content: Active Tab Form */}
          <div>
            {loadingBilling ? (
              <div className="py-12 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground mr-2" />
                <span className="text-muted-foreground">Memuat data...</span>
              </div>
            ) : (
              renderActiveTabContent()
            )}
          </div>
        </div>
      </div>

      {/* Discount Dialog */}
      <Dialog open={discountDialogOpen} onOpenChange={setDiscountDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Diskon</DialogTitle>
            <DialogDescription>
              Masukkan jumlah diskon dan alasannya
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Jumlah Diskon</Label>
              <Input
                type="number"
                value={discountAmount}
                onChange={(e) => setDiscountAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label>Alasan</Label>
              <Textarea
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
                placeholder="Masukkan alasan diskon..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiscountDialogOpen(false)}>Batal</Button>
            <Button onClick={handleUpdateDiscount}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust Dialog */}
      <Dialog open={adjustDialogOpen} onOpenChange={setAdjustDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Penyesuaian</DialogTitle>
            <DialogDescription>
              Masukkan jumlah penyesuaian (positif untuk tambahan, negatif untuk pengurangan)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Jumlah Penyesuaian</Label>
              <Input
                type="number"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(parseFloat(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-2">
              <Label>Alasan</Label>
              <Textarea
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="Masukkan alasan penyesuaian..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialogOpen(false)}>Batal</Button>
            <Button onClick={handleUpdateAdjust}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Batalkan Tagihan</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin membatalkan tagihan ini?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Alasan Pembatalan</Label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Masukkan alasan pembatalan..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>Kembali</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling || !cancelReason}>
              {cancelling ? 'Membatalkan...' : 'Batalkan'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Void Payment Dialog */}
      <Dialog open={voidPaymentDialogOpen} onOpenChange={setVoidPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Batalkan Pembayaran</DialogTitle>
            <DialogDescription>
              Apakah Anda yakin ingin membatalkan pembayaran ini? 
              Jika billing sudah lunas, status pendaftaran akan dikembalikan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Alasan Pembatalan</Label>
            <Textarea
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="Masukkan alasan pembatalan pembayaran..."
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setVoidPaymentDialogOpen(false);
              setSelectedPaymentId(null);
              setVoidReason('');
            }}>
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
