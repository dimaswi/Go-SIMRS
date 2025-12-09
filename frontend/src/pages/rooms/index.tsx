import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { createRoomColumns } from './columns';
import { roomsApi, masterDataApi, type Room, type MasterData } from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, Plus } from 'lucide-react';

export default function RoomsPage() {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const { toast } = useToast();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [roomToDelete, setRoomToDelete] = useState<number | null>(null);
  const [masterData, setMasterData] = useState<Record<string, MasterData[]>>({});

  const loadData = useCallback(async () => {
    try {
      const [roomsRes, masterDataRes] = await Promise.all([
        roomsApi.getAll({ limit: 100 }),
        masterDataApi.getMultiple(['room_type', 'room_class', 'bed_status'])
      ]);
      setRooms(roomsRes.data.data);
      setMasterData(masterDataRes.data.data || {});
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error instanceof Error ? error.message : "Gagal memuat data ruangan.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setPageTitle('Ruangan');
    loadData();
  }, [loadData]);

  const confirmDelete = async () => {
    if (!roomToDelete) return;
    
    try {
      await roomsApi.delete(roomToDelete);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Ruangan berhasil dihapus.",
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus ruangan.",
      });
    } finally {
      setDeleteDialogOpen(false);
      setRoomToDelete(null);
    }
  };

  const handleView = (id: number) => {
    navigate(`/rooms/${id}`);
  };

  const handleEdit = (id: number) => {
    navigate(`/rooms/${id}/edit`);
  };

  const handleDeleteRoom = (id: number) => {
    setRoomToDelete(id);
    setDeleteDialogOpen(true);
  };

  // Helper to get master data name
  const getMasterDataName = (category: string, code: string): string => {
    const items = masterData[category] || [];
    const item = items.find(i => i.code === code);
    return item?.name || code;
  };

  const handleViewQueue = (id: number) => {
    navigate(`/room-queue/room/${id}`);
  };

  const columns = createRoomColumns({
    onView: handleView,
    onEdit: handleEdit,
    onDelete: handleDeleteRoom,
    onViewQueue: handleViewQueue,
    hasViewPermission: hasPermission('rooms.view'),
    hasEditPermission: hasPermission('rooms.update'),
    hasDeletePermission: hasPermission('rooms.delete'),
    getMasterDataName,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="grid gap-4">
        <Card className="shadow-md">
          <CardHeader className="border-b bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold">Ruangan</CardTitle>
                <CardDescription>Kelola data ruangan rumah sakit</CardDescription>
              </div>
              {hasPermission('rooms.create') && (
                <Button onClick={() => navigate('/rooms/create')} size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Tambah Ruangan
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <DataTable
              columns={columns}
              data={rooms}
              searchPlaceholder="Cari ruangan berdasarkan kode atau nama..."
              pageSize={10}
              tableId="rooms"
            />
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Hapus Ruangan"
        description="Apakah Anda yakin ingin menghapus ruangan ini? Pastikan tidak ada tempat tidur yang terdaftar di ruangan ini."
        confirmText="Hapus"
        cancelText="Batal"
        variant="destructive"
      />
    </div>
  );
}
