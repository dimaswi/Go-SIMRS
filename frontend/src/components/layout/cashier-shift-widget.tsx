import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Banknote, AlertCircle, PlayCircle, StopCircle, RefreshCw } from 'lucide-react';
import { cashierShiftApi } from '@/lib/api/cashier-shifts';
import type { CashierShift } from '@/lib/api/cashier-shifts';
import { useToast } from '@/hooks/use-toast';
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
import { useAuthStore } from '@/lib/store';
import { usePermission } from '@/hooks/usePermission';

export function CashierShiftWidget() {
  const { user } = useAuthStore();
  const { toast } = useToast();
  const { hasAnyPermission, hasPermission } = usePermission();
  
  const [shift, setShift] = useState<CashierShift | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [openModalOpen, setOpenModalOpen] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  
  const [openingBalance, setOpeningBalance] = useState(0);
  const [actualBalance, setActualBalance] = useState(0);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSeeShiftWidget = hasAnyPermission([
    'cashier_shifts.view',
    'cashier_shifts.open',
    'cashier_shifts.close',
  ]);
  const canViewShift = hasPermission('cashier_shifts.view');
  const canOpenShift = hasPermission('cashier_shifts.open');
  const canCloseShift = hasPermission('cashier_shifts.close');

  const fetchShift = async () => {
    if (!canViewShift) {
      setShift(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const current = await cashierShiftApi.getCurrent();
      setShift(current);
    } catch (error: any) {
      console.error('Failed to fetch shift:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && canSeeShiftWidget) {
      fetchShift();
    } else {
      setShift(null);
      setLoading(false);
    }
  }, [user, canSeeShiftWidget, canViewShift]);

  if (!user || !canSeeShiftWidget) return null;

  const handleOpenShift = async () => {
    if (!canOpenShift) {
      toast({
        variant: 'destructive',
        title: 'Akses Ditolak',
        description: 'Anda tidak memiliki permission untuk membuka shift kasir.',
      });
      return;
    }

    try {
      setSubmitting(true);
      const newShift = await cashierShiftApi.openShift({
        opening_balance: openingBalance,
        notes: notes,
      });
      setShift(newShift);
      toast({ title: 'Shift Dibuka', description: 'Anda telah berhasil membuka shift kasir.' });
      setOpenModalOpen(false);
      setOpeningBalance(0);
      setNotes('');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Gagal',
        description: error.response?.data?.error || 'Gagal membuka shift kasir',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseShift = async () => {
    if (!canCloseShift) {
      toast({
        variant: 'destructive',
        title: 'Akses Ditolak',
        description: 'Anda tidak memiliki permission untuk menutup shift kasir.',
      });
      return;
    }

    try {
      setSubmitting(true);
      await cashierShiftApi.closeShift({
        actual_balance: actualBalance,
        notes: notes,
      });
      setShift(null);
      toast({ title: 'Shift Ditutup', description: 'Anda telah berhasil menutup shift kasir.' });
      setCloseModalOpen(false);
      setActualBalance(0);
      setNotes('');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Gagal',
        description: error.response?.data?.error || 'Gagal menutup shift kasir',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(val);
  };

  return (
    <>
      <Button
        variant={shift ? "outline" : "destructive"}
        size="sm"
        className={`h-8 gap-1.5 rounded-full px-3 text-xs font-semibold ${shift ? 'border-green-500 text-green-700 bg-green-50 hover:bg-green-100 hover:text-green-800' : ''}`}
        onClick={() => shift ? setCloseModalOpen(true) : setOpenModalOpen(true)}
        disabled={loading || (!shift && !canOpenShift) || (shift && !canCloseShift)}
      >
        {loading ? (
          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
        ) : shift ? (
          <>
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            Shift Aktif
          </>
        ) : (
          <>
            <AlertCircle className="h-3.5 w-3.5" />
            Buka Shift
          </>
        )}
      </Button>

      {/* MODAL BUKA SHIFT */}
      <Dialog open={openModalOpen} onOpenChange={setOpenModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-primary" />
              Buka Shift Kasir
            </DialogTitle>
            <DialogDescription>
              Masukkan modal awal kasir untuk memulai shift Anda.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Modal Awal (Tunai di Laci Kasir)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">Rp</span>
                <Input
                  type="number"
                  className="pl-9 font-mono"
                  value={openingBalance || ''}
                  onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
              <p className="text-xs text-muted-foreground">{formatCurrency(openingBalance)}</p>
            </div>
            <div className="space-y-2">
              <Label>Catatan Tambahan</Label>
              <Textarea
                placeholder="Misal: Laci kasir kuncinya agak macet..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenModalOpen(false)}>Batal</Button>
            <Button onClick={handleOpenShift} disabled={submitting || !canOpenShift}>
              {submitting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <Banknote className="mr-2 h-4 w-4" />}
              Buka Transaksi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL TUTUP SHIFT */}
      <Dialog open={closeModalOpen} onOpenChange={(open) => {
        if (open && shift) {
          // Preset the actual balance to expected by default for convenience, or 0 to force count
          setActualBalance(0);
          setNotes('');
        }
        setCloseModalOpen(open);
      }}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <StopCircle className="h-5 w-5" />
              Tutup Shift Kasir
            </DialogTitle>
            <DialogDescription>
              Anda akan mengakhiri shift kasir saat ini. Hitung uang fisik di laci dan masukkan totalnya.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted/50 p-3 flex flex-col gap-1.5 border">
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Waktu Buka:</span>
                <span className="font-medium">{shift ? new Date(shift.start_time).toLocaleString('id-ID') : '-'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">Modal Awal:</span>
                <span className="font-mono font-medium">{shift ? formatCurrency(shift.opening_balance) : '-'}</span>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <Label className="text-primary font-bold">Uang Fisik Aktual (Hitungan Kasir)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-medium">Rp</span>
                <Input
                  type="number"
                  className="pl-9 font-mono border-primary/50 focus-visible:ring-primary"
                  value={actualBalance || ''}
                  onChange={(e) => setActualBalance(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                />
              </div>
              <p className="text-xs text-muted-foreground">{formatCurrency(actualBalance)}</p>
            </div>
            
            <div className="space-y-2">
              <Label>Catatan Penutupan</Label>
              <Textarea
                placeholder="Tambahkan keterangan jika ada selisih uang atau masalah lainnya..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseModalOpen(false)}>Kembali</Button>
            <Button variant="destructive" onClick={handleCloseShift} disabled={submitting || !canCloseShift}>
              {submitting ? <RefreshCw className="mr-2 h-4 w-4 animate-spin" /> : <StopCircle className="mr-2 h-4 w-4" />}
              Tutup Shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
