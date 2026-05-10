import { useEffect, useState, useCallback, type ComponentType, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable } from '@/components/ui/data-table';
import { createRoomMedicineColumns } from './columns-medicine';
import { roomMedicinesApi } from '@/lib/api/medicines';
import { roomsApi } from '@/lib/api/rooms';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { PageShell, PageHeader, PageContent } from '@/components/layout/page-shell';
import { setPageTitle } from '@/lib/page-title';
import { Building2, Loader2, Pill, TriangleAlert } from 'lucide-react';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';
import { Badge } from '@/components/ui/badge';

interface RoomMedicine {
  id: number;
  room_id: number;
  medicine_id: number;
  quantity: number;
  min_quantity: number;
  notes: string;
  room?: { id: number; name: string; code: string };
  medicine?: { id: number; name: string; code: string; unit: string };
}

interface Room {
  id: number;
  name: string;
  code: string;
}

function SectionPanel({
  icon: Icon,
  title,
  description,
  actions,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="border border-border/70 bg-background/95 shadow-sm">
      <div className="border-b border-border/70 bg-muted/20 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="border border-border/70 bg-background p-2">
              <Icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</div>
              <p className="mt-1 text-xs text-muted-foreground">{description}</p>
            </div>
          </div>
          {actions}
        </div>
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </div>
  );
}

export default function RoomMedicinePage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const { toast } = useToast();
  const [roomMedicines, setRoomMedicines] = useState<RoomMedicine[]>([]);
  const [roomOptions, setRoomOptions] = useState<ComboboxOption[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);

  const loadRooms = useCallback(async () => {
    try {
      const response = await roomsApi.getAll({ limit: 100 });
      const allRooms = response.data.data || [];
      setRoomOptions([
        { value: '', label: 'Semua Ruangan' },
        ...allRooms.map((r: Room) => ({
          value: r.id.toString(),
          label: `${r.code} - ${r.name}`,
        })),
      ]);
    } catch (error) {
      console.error('Failed to load rooms:', error);
    }
  }, []);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = { limit: 100 };
      if (selectedRoom) {
        params.room_id = parseInt(selectedRoom);
      }
      const response = await roomMedicinesApi.getAll(params);
      setRoomMedicines(response.data.data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error instanceof Error ? error.message : "Gagal memuat data stok obat.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, selectedRoom]);

  useEffect(() => {
    setPageTitle('Stok Obat Ruangan');
    loadRooms();
  }, [loadRooms]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    
    try {
      await roomMedicinesApi.delete(itemToDelete);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Stok obat berhasil dihapus.",
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus stok obat.",
      });
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const handleEdit = (id: number) => {
    navigate(`/room-stock/medicines/${id}/edit`);
  };

  const handleDelete = (id: number) => {
    setItemToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleAdjust = (id: number) => {
    navigate(`/room-stock/medicines/${id}/adjust`);
  };

  const columns = createRoomMedicineColumns({
    onEdit: handleEdit,
    onDelete: handleDelete,
    onAdjust: handleAdjust,
    hasEditPermission: hasPermission('room-medicines.update'),
    hasDeletePermission: hasPermission('room-medicines.delete'),
  });

  const lowStockCount = roomMedicines.filter((item) => item.quantity <= item.min_quantity).length;
  const uniqueRooms = new Set(roomMedicines.map((item) => item.room_id)).size;

  if (loading && roomOptions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Stok Obat Ruangan"
        description="Kelola stok obat per ruangan"
        count={roomMedicines.length}
        icon={Pill}
        actions={
          <div className="w-full sm:w-[250px]">
            <Combobox
              options={roomOptions}
              value={selectedRoom}
              onValueChange={setSelectedRoom}
              placeholder="Pilih Ruangan"
              searchPlaceholder="Cari ruangan..."
              emptyText="Tidak ada ruangan"
              className="w-full"
            />
          </div>
        }
      />
      <PageContent>
        <div className="border border-border/70 bg-background">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Daftar Obat
          </div>
          <div className="p-3 sm:p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={roomMedicines}
            tableId="room_medicines"
            searchPlaceholder="Cari obat, kode, atau ruangan..."
          />
        )}
          </div>
        </div>
      </PageContent>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Hapus Stok Obat"
        description="Apakah Anda yakin ingin menghapus stok obat ini? Tindakan ini tidak dapat dibatalkan."
        onConfirm={confirmDelete}
      />
    </PageShell>
  );
}
