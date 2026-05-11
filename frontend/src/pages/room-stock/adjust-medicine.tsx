import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { PageShell, PageHeader, PageContent } from '@/components/layout/page-shell';
import { roomMedicinesApi } from '@/lib/api/medicines';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, ArrowLeft, Plus, Minus, RefreshCw, Building2, ClipboardList } from 'lucide-react';

const formSchema = z.object({
  adjustment_type: z.enum(['add', 'subtract', 'set']),
  quantity: z.coerce.number().min(1, 'Jumlah harus lebih dari 0'),
  reason: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface RoomMedicine {
  id: number;
  quantity: number;
  min_quantity: number;
  room?: { id: number; name: string; code: string };
  medicine?: { id: number; name: string; code: string; unit: string };
}

function SectionPanel({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="border border-border/70 bg-background/95 shadow-sm">
      <div className="border-b border-border/70 bg-muted/20 px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="border border-border/70 bg-background p-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
            <p className="mt-1 text-xs text-muted-foreground">{description}</p>
          </div>
        </div>
      </div>
      <div className="space-y-4 p-3 sm:p-4">{children}</div>
    </div>
  );
}

function SummaryCue({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <div className={`border border-border/70 bg-gradient-to-br px-4 py-3 ${tone}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

export default function AdjustMedicineStockPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [roomMedicine, setRoomMedicine] = useState<RoomMedicine | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      adjustment_type: 'add',
      quantity: 1,
      reason: '',
    },
  });

  const adjustmentType = form.watch('adjustment_type');
  const quantity = form.watch('quantity');

  useEffect(() => {
    setPageTitle('Sesuaikan Stok Obat');
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    try {
      setDataLoading(true);
      const response = await roomMedicinesApi.getById(parseInt(id));
      setRoomMedicine(response.data.data);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data.",
      });
      navigate(-1);
    } finally {
      setDataLoading(false);
    }
  };

  const calculateNewStock = () => {
    if (!roomMedicine) return 0;
    switch (adjustmentType) {
      case 'add':
        return roomMedicine.quantity + (quantity || 0);
      case 'subtract':
        return Math.max(0, roomMedicine.quantity - (quantity || 0));
      case 'set':
        return quantity || 0;
      default:
        return roomMedicine.quantity;
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!id) return;
    setLoading(true);
    try {
      await roomMedicinesApi.adjustStock(parseInt(id), {
        adjustment_type: data.adjustment_type,
        quantity: data.quantity,
        reason: data.reason,
      });
      
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Stok obat berhasil disesuaikan.",
      });
      navigate('/room-stock/medicines');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menyesuaikan stok.",
      });
    } finally {
      setLoading(false);
    }
  };

  if (dataLoading) {
    return (
      <PageShell>
        <PageHeader title="Sesuaikan Stok Obat" description="Tambahkan, kurangi, atau set ulang stok obat ruangan dengan ringkasan hasil akhirnya." />
        <PageContent className="flex-none pb-8">
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </PageContent>
      </PageShell>
    );
  }

  if (!roomMedicine) {
    return null;
  }

  const newStock = calculateNewStock();

  return (
    <PageShell>
      <PageHeader
        title="Sesuaikan Stok Obat"
        description="Tambah, kurangi, atau set stok baru dengan preview hasil akhir sebelum disimpan."
        actions={
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Kembali
          </Button>
        }
      />
      <PageContent className="flex-none pb-8">
        <div className="space-y-6">
          <SectionPanel
            icon={Building2}
            title="Ringkasan Stok"
            description="Lihat ruangan, obat, stok saat ini, dan hasil stok setelah penyesuaian sebelum menyimpan perubahan."
          >
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <SummaryCue label="Ruangan" value={roomMedicine.room?.name || '-'} tone="from-slate-50 via-background to-background" />
              <SummaryCue label="Obat" value={roomMedicine.medicine?.name || '-'} tone="from-blue-50 via-background to-background" />
              <SummaryCue label="Stok Saat Ini" value={`${roomMedicine.quantity} ${roomMedicine.medicine?.unit || ''}`.trim()} tone="from-emerald-50 via-background to-background" />
              <SummaryCue label="Stok Setelah Adjust" value={`${newStock} ${roomMedicine.medicine?.unit || ''}`.trim()} tone="from-amber-50 via-background to-background" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Kode: {roomMedicine.medicine?.code || '-'}</Badge>
              <Badge variant="outline">Minimum: {roomMedicine.min_quantity} {roomMedicine.medicine?.unit || ''}</Badge>
            </div>
          </SectionPanel>

          <SectionPanel
            icon={ClipboardList}
            title="Form Penyesuaian"
            description="Pilih metode penyesuaian, isi jumlah, lalu catat alasan agar histori stok tetap jelas."
          >
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="adjustment_type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tipe Penyesuaian *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="add">
                            <div className="flex items-center gap-2">
                              <Plus className="h-4 w-4 text-green-600" />
                              Tambah Stok
                            </div>
                          </SelectItem>
                          <SelectItem value="subtract">
                            <div className="flex items-center gap-2">
                              <Minus className="h-4 w-4 text-red-600" />
                              Kurangi Stok
                            </div>
                          </SelectItem>
                          <SelectItem value="set">
                            <div className="flex items-center gap-2">
                              <RefreshCw className="h-4 w-4 text-blue-600" />
                              Set Stok Baru
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {adjustmentType === 'set' ? 'Stok Baru' : 'Jumlah'} *
                      </FormLabel>
                      <FormControl>
                        <Input type="number" min="1" {...field} />
                      </FormControl>
                      <FormDescription>
                        Stok akan menjadi: <strong>{newStock} {roomMedicine.medicine?.unit}</strong>
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Alasan</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={3}
                          placeholder="Masukkan alasan penyesuaian..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="sticky bottom-0 z-10 flex justify-end gap-2 border-t bg-background py-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(-1)}
                  >
                    Batal
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Simpan
                  </Button>
                </div>
              </form>
            </Form>
          </SectionPanel>
        </div>
      </PageContent>
    </PageShell>
  );
}
