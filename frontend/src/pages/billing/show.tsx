import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
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
import { billingApi, visitsApi, type Billing, type BillingPayment } from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { 
  ArrowLeft, 
  Loader2, 
  Receipt,
  User,
  MapPin,
  Calendar,
  CreditCard,
  CheckCircle,
  XCircle,
  Percent,
  Plus,
  RefreshCw,
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

const visitStatusLabels: Record<string, string> = {
  waiting: 'Menunggu',
  in_progress: 'Dalam Proses',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

const visitStatusColors: Record<string, string> = {
  waiting: 'bg-yellow-500 text-black',
  in_progress: 'bg-blue-500',
  completed: 'bg-green-500',
  cancelled: 'bg-red-500',
};

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
    setPageTitle('Detail Kunjungan');
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
      return format(parseISO(dateString), 'dd MMMM yyyy HH:mm', { locale: id });
    } catch {
      return '-';
    }
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

  // Calculate totals from visit
  const calculateVisitTotals = () => {
    if (!visit) return { procedures: 0, medicines: 0, orders: 0, total: 0 };

    let procedures = 0;
    let medicines = 0;
    let orders = 0;

    visit.visit_procedures?.forEach((vp) => {
      procedures += vp.subtotal || vp.price * (vp.quantity || 1);
    });

    visit.medicine_orders?.forEach((mo) => {
      medicines += mo.total_amount || 0;
    });

    visit.procedure_orders?.forEach((po) => {
      orders += po.total_amount || 0;
    });

    return {
      procedures,
      medicines,
      orders,
      total: procedures + medicines + orders,
    };
  };

  const visitTotals = calculateVisitTotals();

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="outline">Draft</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-500 text-black">Pending</Badge>;
      case 'partial':
        return <Badge className="bg-blue-500">Partial</Badge>;
      case 'paid':
        return <Badge className="bg-green-500">Lunas</Badge>;
      case 'cancelled':
        return <Badge variant="destructive">Dibatalkan</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
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
    <div className="flex flex-1 flex-col gap-4 p-6">
      <Card className="shadow-md">
        <CardHeader className="border-b bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/billing')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <User className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <CardTitle className="text-base font-semibold">
                    {visit.registration?.patient?.nama_lengkap || '-'}
                  </CardTitle>
                  <CardDescription>
                    No. RM: {visit.registration?.patient?.no_rm} • {visit.visit_number}
                  </CardDescription>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={visitStatusColors[visit.status] || ''}>
                {visitStatusLabels[visit.status] || visit.status}
              </Badge>
              {/* Tombol Ambil Tagihan */}
              {!billing && hasPermission('billing.create') && visit.status === 'completed' && (
                <Button onClick={handleGenerateBilling} disabled={generating}>
                  {generating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Receipt className="mr-2 h-4 w-4" />
                  )}
                  Ambil Tagihan
                </Button>
              )}
              {/* Tombol Finalisasi */}
              {billing && billing.status === 'draft' && hasPermission('billing.finalize') && (
                <Button onClick={handleFinalize} disabled={finalizing}>
                  {finalizing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="mr-2 h-4 w-4" />
                  )}
                  Finalisasi
                </Button>
              )}
              {/* Tombol Regenerate Tagihan - untuk draft dan cancelled */}
              {billing && (billing.status === 'draft' || billing.status === 'cancelled') && hasPermission('billing.create') && (
                <Button variant="outline" onClick={handleRegenerateBilling} disabled={regenerating}>
                  {regenerating ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  {billing.status === 'cancelled' ? 'Buat Ulang' : 'Regenerate'}
                </Button>
              )}
              {/* Tombol Bayar */}
              {billing && billing.status !== 'paid' && billing.status !== 'cancelled' && billing.status !== 'draft' && hasPermission('billing.payment') && (
                <Button onClick={() => navigate(`/billing/${billing.id}/payment`)}>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Bayar
                </Button>
              )}
              {/* Tombol Batalkan */}
              {billing && billing.status !== 'paid' && billing.status !== 'cancelled' && hasPermission('billing.delete') && (
                <Button variant="destructive" onClick={() => setCancelDialogOpen(true)}>
                  <XCircle className="mr-2 h-4 w-4" />
                  Batalkan
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Info Kunjungan */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="flex items-start gap-3">
              <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Ruangan</p>
                <p className="font-medium">{visit.room?.name || '-'}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Waktu Kunjungan</p>
                <p className="font-medium">{formatDate(visit.start_time)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CreditCard className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-sm text-muted-foreground">Pembayaran</p>
                <Badge variant={visit.registration?.payment_method === 'bpjs' ? 'default' : 'secondary'}>
                  {visit.registration?.payment_method === 'cash' ? 'Tunai' :
                   visit.registration?.payment_method === 'bpjs' ? 'BPJS' :
                   visit.registration?.payment_method === 'insurance' ? 'Asuransi' :
                   visit.registration?.payment_method}
                </Badge>
              </div>
            </div>
            {billing && (
              <div className="flex items-start gap-3">
                <Receipt className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Status Tagihan</p>
                  {getStatusBadge(billing.status)}
                </div>
              </div>
            )}
          </div>

          {/* Loading Billing */}
          {loadingBilling && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-muted-foreground">Memuat tagihan...</span>
            </div>
          )}

          {/* Jika belum ada billing, tampilkan preview dari visit */}
          {!loadingBilling && !billing && (
            <>
              {/* Tindakan */}
              {visit.visit_procedures && visit.visit_procedures.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm">Tindakan Medis</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Kode</TableHead>
                          <TableHead>Nama Tindakan</TableHead>
                          <TableHead className="text-center">Qty</TableHead>
                          <TableHead className="text-right">Harga</TableHead>
                          <TableHead className="text-right">Subtotal</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visit.visit_procedures.map((vp) => (
                          <TableRow key={vp.id}>
                            <TableCell>{vp.procedure?.code || '-'}</TableCell>
                            <TableCell>{vp.procedure?.name || '-'}</TableCell>
                            <TableCell className="text-center">{vp.quantity || 1}</TableCell>
                            <TableCell className="text-right">{formatCurrency(vp.price)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(vp.subtotal || vp.price * (vp.quantity || 1))}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <TableFooter>
                        <TableRow>
                          <TableCell colSpan={4} className="font-medium">Total Tindakan</TableCell>
                          <TableCell className="text-right font-bold">{formatCurrency(visitTotals.procedures)}</TableCell>
                        </TableRow>
                      </TableFooter>
                    </Table>
                  </div>
                </>
              )}

              {/* Order Radiologi/Lab */}
              {visit.procedure_orders && visit.procedure_orders.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm">Order Radiologi/Laboratorium</h3>
                    {visit.procedure_orders.map((po) => (
                      <div key={po.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{po.order_number}</span>
                          <Badge variant="outline">{po.order_type === 'radiology' ? 'Radiologi' : 'Laboratorium'}</Badge>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Kode</TableHead>
                              <TableHead>Nama Pemeriksaan</TableHead>
                              <TableHead className="text-right">Harga</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {po.items?.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell>{item.procedure?.code || '-'}</TableCell>
                                <TableCell>{item.procedure?.name || '-'}</TableCell>
                                <TableCell className="text-right">{formatCurrency(item.price)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                          <TableFooter>
                            <TableRow>
                              <TableCell colSpan={2} className="font-medium">Subtotal</TableCell>
                              <TableCell className="text-right font-bold">{formatCurrency(po.total_amount)}</TableCell>
                            </TableRow>
                          </TableFooter>
                        </Table>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Order Obat */}
              {visit.medicine_orders && visit.medicine_orders.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm">Order Obat</h3>
                    {visit.medicine_orders.map((mo) => (
                      <div key={mo.id} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm">{mo.order_number}</span>
                          <Badge variant={mo.status === 'completed' ? 'default' : 'secondary'}>
                            {mo.status === 'completed' ? 'Selesai' : mo.status}
                          </Badge>
                        </div>
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Nama Obat</TableHead>
                              <TableHead className="text-center">Qty</TableHead>
                              <TableHead className="text-right">Harga</TableHead>
                              <TableHead className="text-right">Subtotal</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {mo.items?.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell>{item.medicine?.name || '-'}</TableCell>
                                <TableCell className="text-center">{item.quantity}</TableCell>
                                <TableCell className="text-right">{formatCurrency(item.price)}</TableCell>
                                <TableCell className="text-right">{formatCurrency(item.subtotal)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                          <TableFooter>
                            <TableRow>
                              <TableCell colSpan={3} className="font-medium">Subtotal</TableCell>
                              <TableCell className="text-right font-bold">{formatCurrency(mo.total_amount)}</TableCell>
                            </TableRow>
                          </TableFooter>
                        </Table>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Total Summary Preview */}
              <Separator className="my-4" />
              <div className="bg-muted/30 rounded-lg p-4">
                <h3 className="font-semibold text-sm mb-4">Ringkasan Biaya (Estimasi)</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Tindakan Medis</span>
                    <span>{formatCurrency(visitTotals.procedures)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Radiologi/Laboratorium</span>
                    <span>{formatCurrency(visitTotals.orders)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Obat</span>
                    <span>{formatCurrency(visitTotals.medicines)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total Estimasi</span>
                    <span>{formatCurrency(visitTotals.total)}</span>
                  </div>
                </div>
                {visit.status === 'completed' && !billing && (
                  <p className="text-sm text-muted-foreground mt-4">
                    Klik tombol "Ambil Tagihan" untuk membuat tagihan resmi.
                  </p>
                )}
                {visit.status !== 'completed' && (
                  <p className="text-sm text-yellow-600 mt-4">
                    Kunjungan belum selesai. Tagihan hanya dapat dibuat setelah kunjungan selesai.
                  </p>
                )}
              </div>
            </>
          )}

          {/* Jika sudah ada billing, tampilkan billing */}
          {!loadingBilling && billing && (
            <>
              {/* Billing Items */}
              <Separator className="my-4" />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Detail Tagihan - {billing.billing_number}</h3>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipe</TableHead>
                      <TableHead>Deskripsi</TableHead>
                      <TableHead>Oleh</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">Harga</TableHead>
                      <TableHead className="text-right">Subtotal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {billing.items?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Badge variant="outline">
                            {item.item_type === 'registration' ? 'Pendaftaran' :
                             item.item_type === 'procedure' ? 'Tindakan' :
                             item.item_type === 'radiology' ? 'Radiologi' :
                             item.item_type === 'laboratory' ? 'Lab' :
                             item.item_type === 'medicine' ? 'Obat' :
                             item.item_type === 'room_charge' ? 'Kamar' :
                             item.item_type}
                          </Badge>
                        </TableCell>
                        <TableCell>{item.description}</TableCell>
                        <TableCell>
                          {item.performed_by_name ? (
                            <div className="text-sm">
                              <span className="font-medium">{item.performed_by_name}</span>
                              {item.performed_by_role && (
                                <Badge variant="secondary" className="ml-2 text-xs">
                                  {item.performed_by_role === 'dokter' ? 'Dokter' :
                                   item.performed_by_role === 'petugas' ? 'Petugas' :
                                   item.performed_by_role === 'admin' ? 'Admin' :
                                   item.performed_by_role === 'apoteker' ? 'Apoteker' :
                                   item.performed_by_role}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.subtotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={5} className="font-medium">Subtotal</TableCell>
                      <TableCell className="text-right font-bold">{formatCurrency(billing.total_amount)}</TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>

              {/* Summary */}
              <Separator className="my-4" />
              <div className="bg-muted/30 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-sm">Ringkasan Pembayaran</h3>
                  {billing.status !== 'paid' && billing.status !== 'cancelled' && hasPermission('billing.update') && (
                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" onClick={() => setDiscountDialogOpen(true)}>
                        <Percent className="mr-2 h-4 w-4" />
                        Diskon
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setAdjustDialogOpen(true)}>
                        <Plus className="mr-2 h-4 w-4" />
                        Penyesuaian
                      </Button>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(billing.total_amount)}</span>
                  </div>
                  {billing.discount_amount > 0 && (
                    <div className="flex justify-between text-red-500">
                      <span>Diskon ({billing.discount_reason || '-'})</span>
                      <span>- {formatCurrency(billing.discount_amount)}</span>
                    </div>
                  )}
                  {billing.adjust_amount !== 0 && (
                    <div className="flex justify-between text-blue-500">
                      <span>Penyesuaian ({billing.adjust_reason || '-'})</span>
                      <span>{billing.adjust_amount > 0 ? '+' : ''} {formatCurrency(billing.adjust_amount)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total</span>
                    <span>{formatCurrency(billing.final_amount)}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>Terbayar</span>
                    <span>{formatCurrency(billing.paid_amount)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold">
                    <span>Sisa</span>
                    <span>{formatCurrency(billing.remaining_amount)}</span>
                  </div>
                </div>
              </div>

              {/* All Visits in Registration */}
              {allVisits.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm">Daftar Kunjungan ({allVisits.length} kunjungan)</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>No. Kunjungan</TableHead>
                          <TableHead>Tipe</TableHead>
                          <TableHead>Ruangan</TableHead>
                          <TableHead>Dokter</TableHead>
                          <TableHead>Waktu Masuk</TableHead>
                          <TableHead>Waktu Keluar</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {allVisits.map((v) => (
                          <TableRow key={v.id} className={v.id === visit?.id ? 'bg-muted/50' : ''}>
                            <TableCell className="font-medium">
                              {v.visit_number}
                              {v.id === visit?.id && (
                                <Badge variant="outline" className="ml-2">Utama</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {v.visit_type === 'outpatient' ? 'Rawat Jalan' :
                                 v.visit_type === 'inpatient' ? 'Rawat Inap' :
                                 v.visit_type === 'emergency' ? 'UGD' :
                                 v.visit_type === 'lab' ? 'Laboratorium' :
                                 v.visit_type === 'radiology' ? 'Radiologi' :
                                 v.visit_type}
                              </Badge>
                            </TableCell>
                            <TableCell>{(v.room as { name?: string })?.name || '-'}</TableCell>
                            <TableCell>
                              {v.doctor?.nama_lengkap ? (
                                <span className="text-sm">{v.doctor.nama_lengkap}</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>{formatDate(v.start_time)}</TableCell>
                            <TableCell>{formatDate(v.end_time)}</TableCell>
                            <TableCell>
                              <Badge className={visitStatusColors[v.status] || ''}>
                                {visitStatusLabels[v.status] || v.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}

              {/* Payments History */}
              {payments.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-4">
                    <h3 className="font-semibold text-sm">Riwayat Pembayaran</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>No. Pembayaran</TableHead>
                          <TableHead>Tanggal</TableHead>
                          <TableHead>Metode</TableHead>
                          <TableHead className="text-right">Jumlah</TableHead>
                          <TableHead>Kasir</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="text-center">Aksi</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payments.map((payment) => (
                          <TableRow key={payment.id}>
                            <TableCell className="font-medium">{payment.payment_number}</TableCell>
                            <TableCell>{formatDate(payment.payment_date)}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {payment.payment_method === 'cash' ? 'Tunai' :
                                 payment.payment_method === 'bpjs' ? 'BPJS' :
                                 payment.payment_method === 'insurance' ? 'Asuransi' :
                                 payment.payment_method === 'transfer' ? 'Transfer' :
                                 payment.payment_method === 'debit' ? 'Debit' :
                                 payment.payment_method === 'credit' ? 'Kredit' :
                                 payment.payment_method === 'qris' ? 'QRIS' :
                                 payment.payment_method}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(payment.amount)}</TableCell>
                            <TableCell>{payment.cashier?.full_name || '-'}</TableCell>
                            <TableCell>
                              <Badge variant={payment.status === 'completed' ? 'default' : 'destructive'}>
                                {payment.status === 'completed' ? 'Selesai' : 'Dibatalkan'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              {payment.status === 'completed' && hasPermission('billing.payment') && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => {
                                    setSelectedPaymentId(payment.id);
                                    setVoidPaymentDialogOpen(true);
                                  }}
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Batalkan
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </>
          )}
        </CardContent>
      </Card>

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
