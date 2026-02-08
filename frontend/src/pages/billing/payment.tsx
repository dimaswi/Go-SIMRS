import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

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
import { billingApi, type Billing } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { 
  ArrowLeft, 
  Loader2, 
  CreditCard,
  Banknote,
  Building2,
  Smartphone,
  Shield,
  Heart,
} from 'lucide-react';


export default function BillingPayment() {
  const { id: billingId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [billing, setBilling] = useState<Billing | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form values
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [amount, setAmount] = useState(0);
  const [receivedAmount, setReceivedAmount] = useState(0);
  const [notes, setNotes] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [bankName, setBankName] = useState('');
  
  // BPJS fields
  const [bpjsNumber, setBpjsNumber] = useState('');
  const [bpjsClaimCode, setBpjsClaimCode] = useState('');
  
  // Insurance fields
  const [insuranceName, setInsuranceName] = useState('');
  const [insuranceNumber, setInsuranceNumber] = useState('');
  const [insuranceClaimCode, setInsuranceClaimCode] = useState('');

  const loadBilling = useCallback(async () => {
    if (!billingId) return;
    try {
      const response = await billingApi.getById(parseInt(billingId));
      const billingData = response.data;
      setBilling(billingData);
      setAmount(billingData.remaining_amount || 0);
      setReceivedAmount(billingData.remaining_amount || 0);
      
      // Set default payment method based on billing payment method
      if (billingData.payment_method === 'bpjs') {
        setPaymentMethod('bpjs');
        setBpjsNumber(billingData.bpjs_number || '');
      } else if (billingData.payment_method === 'insurance') {
        setPaymentMethod('insurance');
        setInsuranceName(billingData.insurance_name || '');
        setInsuranceNumber(billingData.insurance_no || '');
      }
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error!',
        description: 'Gagal memuat data tagihan.',
      });
      navigate('/billing/list');
    } finally {
      setLoading(false);
    }
  }, [billingId, toast, navigate]);

  useEffect(() => {
    setPageTitle('Pembayaran');
    loadBilling();
  }, [loadBilling]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billingId) return;

    if (amount <= 0) {
      toast({
        variant: 'destructive',
        title: 'Error!',
        description: 'Jumlah pembayaran harus lebih dari 0.',
      });
      return;
    }

    if (paymentMethod === 'cash' && receivedAmount < amount) {
      toast({
        variant: 'destructive',
        title: 'Error!',
        description: 'Jumlah diterima kurang dari jumlah pembayaran.',
      });
      return;
    }

    // Validate BPJS fields
    if (paymentMethod === 'bpjs') {
      if (!bpjsNumber) {
        toast({
          variant: 'destructive',
          title: 'Error!',
          description: 'Nomor BPJS wajib diisi.',
        });
        return;
      }
    }

    // BPJS tidak perlu validasi - tidak dibayar pasien
    // Kode klaim BPJS opsional untuk dokumentasi

    // Validate Insurance fields
    if (paymentMethod === 'insurance') {
      // Hanya wajib kode klaim, nama asuransi dari master data
      if (!insuranceClaimCode) {
        toast({
          variant: 'destructive',
          title: 'Error!',
          description: 'Kode klaim asuransi wajib diisi.',
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      const response = await billingApi.createPayment(parseInt(billingId), {
        payment_method: paymentMethod,
        amount,
        received_amount: paymentMethod === 'cash' ? receivedAmount : amount,
        notes,
        reference_number: referenceNumber,
        bank_name: bankName,
        bpjs_number: bpjsNumber,
        bpjs_claim_code: bpjsClaimCode,
        insurance_name: insuranceName,
        insurance_number: insuranceNumber,
        insurance_claim_code: insuranceClaimCode,
      });
      toast({
        title: 'Berhasil!',
        description: 'Pembayaran berhasil dicatat.',
      });
      // Navigate using visit_id from billing
      const visitId = response.data.billing?.visit_id || billing?.visit_id;
      navigate(`/billing/${visitId}`);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: 'destructive',
        title: 'Error!',
        description: err.response?.data?.error || 'Gagal mencatat pembayaran.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const changeAmount = paymentMethod === 'cash' ? Math.max(0, receivedAmount - amount) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!billing) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-lg font-semibold">Tagihan tidak ditemukan</p>
          <Button onClick={() => navigate('/billing/list')} className="mt-4">
            Kembali
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/billing/${billing?.visit_id}`)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold">
              Pembayaran - {billing.billing_number}
            </h1>
            <p className="text-sm text-muted-foreground">
              {billing.registration?.patient?.nama_lengkap} • No. RM: {billing.registration?.patient?.no_rm}
            </p>
          </div>
        </div>
        <Badge className="bg-yellow-500 text-black">
          Sisa: {formatCurrency(billing.remaining_amount)}
        </Badge>
      </div>

      <div className="rounded-lg border p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-muted-foreground">Total Tagihan</p>
              <p className="text-xl font-bold">{formatCurrency(billing.final_amount)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Terbayar</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(billing.paid_amount)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Sisa</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(billing.remaining_amount)}</p>
            </div>
          </div>
      </div>

      {/* Payment Form Card */}
      <div className="rounded-lg border">
        <div className="flex items-center gap-2 px-6 py-4">
          <h3 className="text-sm font-medium">Form Pembayaran</h3>
          <p className="text-sm text-muted-foreground">Masukkan detail pembayaran</p>
        </div>
        <div className="px-6 pb-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Payment Method */}
              <div className="space-y-2">
                <Label>Metode Pembayaran</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih metode" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">
                      <div className="flex items-center gap-2">
                        <Banknote className="h-4 w-4" />
                        Tunai
                      </div>
                    </SelectItem>
                    {billing.payment_method === 'bpjs' && (
                      <SelectItem value="bpjs">
                        <div className="flex items-center gap-2">
                          <Shield className="h-4 w-4" />
                          BPJS Kesehatan
                        </div>
                      </SelectItem>
                    )}
                    {billing.payment_method === 'insurance' && (
                      <SelectItem value="insurance">
                        <div className="flex items-center gap-2">
                          <Heart className="h-4 w-4" />
                          Asuransi
                        </div>
                      </SelectItem>
                    )}
                    <SelectItem value="transfer">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        Transfer Bank
                      </div>
                    </SelectItem>
                    <SelectItem value="debit">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Kartu Debit
                      </div>
                    </SelectItem>
                    <SelectItem value="credit">
                      <div className="flex items-center gap-2">
                        <CreditCard className="h-4 w-4" />
                        Kartu Kredit
                      </div>
                    </SelectItem>
                    <SelectItem value="qris">
                      <div className="flex items-center gap-2">
                        <Smartphone className="h-4 w-4" />
                        QRIS
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label>Jumlah Pembayaran</Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  max={billing.remaining_amount}
                />
                <p className="text-xs text-muted-foreground">
                  Maksimal: {formatCurrency(billing.remaining_amount)}
                </p>
              </div>

              {/* Received Amount (for cash only) */}
              {paymentMethod === 'cash' && (
                <div className="space-y-2">
                  <Label>Jumlah Diterima</Label>
                  <Input
                    type="number"
                    value={receivedAmount}
                    onChange={(e) => setReceivedAmount(parseFloat(e.target.value) || 0)}
                  />
                </div>
              )}

              {/* Change (for cash only) */}
              {paymentMethod === 'cash' && (
                <div className="space-y-2">
                  <Label>Kembalian</Label>
                  <div className="h-10 px-3 py-2 rounded-md border bg-muted flex items-center">
                    <span className="font-bold text-green-600">{formatCurrency(changeAmount)}</span>
                  </div>
                </div>
              )}

              {/* BPJS Fields - Info saja, tidak perlu input karena tidak dibayar pasien */}
              {paymentMethod === 'bpjs' && (
                <>
                  <div className="md:col-span-2 p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-green-800">
                      <strong>Pembayaran BPJS</strong> - Tagihan ditanggung sepenuhnya oleh BPJS Kesehatan.
                      Pasien tidak perlu membayar.
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label>Nomor BPJS</Label>
                    <Input
                      value={bpjsNumber || billing?.bpjs_number || '-'}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Kode Klaim BPJS (Opsional)</Label>
                    <Input
                      value={bpjsClaimCode}
                      onChange={(e) => setBpjsClaimCode(e.target.value)}
                      placeholder="Masukkan kode klaim jika ada"
                    />
                  </div>
                </>
              )}

              {/* Insurance Fields */}
              {paymentMethod === 'insurance' && (
                <>
                  <div className="space-y-2">
                    <Label>Nama Asuransi</Label>
                    <Input
                      value={insuranceName || billing?.insurance_name || '-'}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Nomor Polis</Label>
                    <Input
                      value={insuranceNumber || billing?.insurance_no || '-'}
                      disabled
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Kode Klaim <span className="text-red-500">*</span></Label>
                    <Input
                      value={insuranceClaimCode}
                      onChange={(e) => setInsuranceClaimCode(e.target.value)}
                      placeholder="Masukkan kode klaim asuransi"
                    />
                  </div>
                </>
              )}

              {/* Bank Name (for transfer/card) */}
              {(paymentMethod === 'transfer' || paymentMethod === 'debit' || paymentMethod === 'credit') && (
                <div className="space-y-2">
                  <Label>Nama Bank <span className="text-red-500">*</span></Label>
                  <Input
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="BCA, Mandiri, BNI, dll"
                  />
                </div>
              )}

              {/* Reference Number (for non-cash, non-bpjs, non-insurance) */}
              {paymentMethod !== 'cash' && paymentMethod !== 'bpjs' && paymentMethod !== 'insurance' && (
                <div className="space-y-2">
                  <Label>No. Referensi <span className="text-red-500">*</span></Label>
                  <Input
                    value={referenceNumber}
                    onChange={(e) => setReferenceNumber(e.target.value)}
                    placeholder="No. transaksi / approval code"
                  />
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Catatan</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan tambahan (opsional)"
              />
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => navigate(`/billing/${billing?.visit_id}`)}>
                Batal
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CreditCard className="mr-2 h-4 w-4" />
                )}
                Proses Pembayaran
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
