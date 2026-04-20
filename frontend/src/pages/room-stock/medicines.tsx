import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { DataTable } from '@/components/ui/data-table';
import { createRoomMedicineColumns } from './columns-medicine';
import { roomMedicinesApi } from '@/lib/api/medicines';
import { roomsApi } from '@/lib/api/rooms';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, Pill } from 'lucide-react';
import { Combobox, type ComboboxOption } from '@/components/ui/combobox';

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

  if (loading && roomOptions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Pill className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-semibold">Stok Obat Ruangan</h1>
            <p className="text-sm text-muted-foreground">
              Kelola stok obat per ruangan
            </p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Combobox
            options={roomOptions}
            value={selectedRoom}
            onValueChange={setSelectedRoom}
            placeholder="Pilih Ruangan"
            searchPlaceholder="Cari ruangan..."
            emptyText="Tidak ada ruangan"
            className="w-full sm:w-[250px]"
          />
        </div>
      </div>
      <div className="rounded-lg border p-6">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <DataTable columns={columns} data={roomMedicines} tableId="room_medicines" />
        )}
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Hapus Stok Obat"
        description="Apakah Anda yakin ingin menghapus stok obat ini? Tindakan ini tidak dapat dibatalkan."
        onConfirm={confirmDelete}
      />
    </div>
  );
}
