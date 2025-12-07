import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import { roomInventoriesApi } from '@/lib/api/inventories';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, ArrowLeft, Package, Plus, Minus, RefreshCw } from 'lucide-react';

const formSchema = z.object({
  adjustment_type: z.enum(['add', 'subtract', 'set']),
  quantity: z.coerce.number().min(1, 'Jumlah harus lebih dari 0'),
  reason: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface RoomInventory {
  id: number;
  quantity: number;
  min_quantity: number;
  room?: { id: number; name: string; code: string };
  inventory?: { id: number; name: string; code: string; unit: string };
}

export default function AdjustInventoryStockPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [roomInventory, setRoomInventory] = useState<RoomInventory | null>(null);

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
    setPageTitle('Sesuaikan Stok Inventaris');
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    try {
      setDataLoading(true);
      const response = await roomInventoriesApi.getById(parseInt(id));
      setRoomInventory(response.data.data);
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
    if (!roomInventory) return 0;
    switch (adjustmentType) {
      case 'add':
        return roomInventory.quantity + (quantity || 0);
      case 'subtract':
        return Math.max(0, roomInventory.quantity - (quantity || 0));
      case 'set':
        return quantity || 0;
      default:
        return roomInventory.quantity;
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!id) return;
    setLoading(true);
    try {
      await roomInventoriesApi.adjustStock(parseInt(id), {
        adjustment_type: data.adjustment_type,
        quantity: data.quantity,
        reason: data.reason,
      });
      
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Stok inventaris berhasil disesuaikan.",
      });
      navigate('/room-stock/inventories');
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
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!roomInventory) {
    return null;
  }

  const newStock = calculateNewStock();

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <Card className="shadow-md">
        <CardHeader className="border-b bg-muted/50">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Sesuaikan Stok Inventaris</CardTitle>
              <CardDescription>Tambah, kurangi, atau set stok baru</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          {/* Current Info */}
          <div className="mb-6 p-4 bg-muted rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Ruangan</p>
                <p className="font-medium">{roomInventory.room?.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Inventaris</p>
                <p className="font-medium">{roomInventory.inventory?.name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Stok Saat Ini</p>
                <Badge variant="secondary" className="text-lg">
                  {roomInventory.quantity} {roomInventory.inventory?.unit}
                </Badge>
              </div>
            </div>
          </div>

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
                      Stok akan menjadi: <strong>{newStock} {roomInventory.inventory?.unit}</strong>
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

              <div className="flex justify-end gap-2">
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
        </CardContent>
      </Card>
    </div>
  );
}
