import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { masterDataApi, type MasterData } from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, Plus, ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';

// Category name mapping
const CATEGORY_NAMES: Record<string, string> = {
  gender: 'Jenis Kelamin',
  religion: 'Agama',
  marital_status: 'Status Perkawinan',
  education_level: 'Pendidikan Terakhir',
  employee_type: 'Tipe Karyawan',
  employment_status: 'Status Kepegawaian',
  blood_type: 'Golongan Darah',
  relationship: 'Hubungan Keluarga',
  bank: 'Bank',
  department: 'Departemen',
  position: 'Jabatan',
  specialization: 'Spesialisasi',
  body_marker_category: 'Kategori Marker Tubuh',
  body_marker_image: 'Gambar Marker Tubuh',
  o2_type: 'Jenis Oksigen',
};

export default function CategoryListPage() {
  const navigate = useNavigate();
  const { category } = useParams<{ category: string }>();
  const { hasPermission } = usePermission();
  const { toast } = useToast();
  const [data, setData] = useState<MasterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<number | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const categoryName = category ? CATEGORY_NAMES[category] || category : '';

  const loadData = useCallback(async () => {
    if (!category) return;
    try {
      const response = await masterDataApi.getByCategory(category, { include_inactive: showInactive });
      setData(response.data.data || []);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error instanceof Error ? error.message : "Gagal memuat data.",
      });
    } finally {
      setLoading(false);
    }
  }, [category, showInactive, toast]);

  useEffect(() => {
    setPageTitle(`Master Data - ${categoryName}`);
    loadData();
  }, [loadData, categoryName]);

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    
    try {
      await masterDataApi.delete(itemToDelete);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Data berhasil dihapus.",
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus data.",
      });
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  const handleEdit = (id: number) => {
    navigate(`/master-data/${id}/edit`);
  };

  const handleDelete = (id: number) => {
    setItemToDelete(id);
    setDeleteDialogOpen(true);
  };

  const columns: ColumnDef<MasterData>[] = [
    {
      accessorKey: 'sort_order',
      header: 'No',
      cell: ({ row }) => row.index + 1,
      size: 60,
    },
    {
      accessorKey: 'code',
      header: 'Kode',
      size: 120,
    },
    {
      accessorKey: 'name',
      header: 'Nama',
    },
    {
      accessorKey: 'description',
      header: 'Deskripsi',
      cell: ({ row }) => row.original.description || '-',
    },
    {
      accessorKey: 'is_active',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant={row.original.is_active ? 'default' : 'secondary'}>
          {row.original.is_active ? 'Aktif' : 'Nonaktif'}
        </Badge>
      ),
      size: 100,
    },
    {
      accessorKey: 'is_default',
      header: 'Default',
      cell: ({ row }) => row.original.is_default ? (
        <Badge variant="outline">Default</Badge>
      ) : null,
      size: 100,
    },
    {
      id: 'actions',
      header: 'Aksi',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {hasPermission('master_data.update') && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                handleEdit(row.original.id);
              }}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
          {hasPermission('master_data.delete') && (
            <Button 
              variant="outline" 
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(row.original.id);
              }}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      ),
      size: 120,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-4">
      <div className="grid gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => window.history.back()} className="h-9 w-9">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="space-y-1">
              <h1 className="text-lg font-semibold">{categoryName}</h1>
              <p className="text-sm text-muted-foreground">Kelola data {categoryName.toLowerCase()}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                checked={showInactive}
                onCheckedChange={setShowInactive}
              />
              <span className="text-sm text-muted-foreground">Tampilkan nonaktif</span>
            </div>
            {hasPermission('master_data.create') && (
              <Button onClick={() => navigate(`/master-data/create?category=${category}`)} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Tambah {categoryName}
              </Button>
            )}
          </div>
        </div>
        <div className="rounded-lg border p-6">
            <DataTable
              columns={columns}
              data={data}
              searchPlaceholder={`Cari ${categoryName.toLowerCase()}...`}
              pageSize={10}
              tableId={`master_data_${category}`}
            />
        </div>
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Hapus Data"
        description="Apakah Anda yakin ingin menghapus data ini? Data yang sudah dihapus tidak dapat dikembalikan."
        onConfirm={confirmDelete}
        confirmText="Hapus"
        cancelText="Batal"
        variant="destructive"
      />
    </div>
  );
}
