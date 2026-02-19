import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

import { DataTable } from '@/components/ui/data-table';
import { createProvinceColumns } from './columns';
import { regionsApi, type Province } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { 
  Loader2, 
  Plus
} from 'lucide-react';

export default function RegionsPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const provincesRes = await regionsApi.getProvinces();
      setProvinces(provincesRes.data.data);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data wilayah.",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    setPageTitle('Wilayah Indonesia');
    loadData();
  }, [loadData]);

  const handleView = (id: string) => {
    navigate(`/regions/provinces/${id}`);
  };

  const columns = createProvinceColumns({
    onView: handleView,
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Daftar Provinsi</h1>
          <p className="text-sm text-muted-foreground">Data wilayah administratif Indonesia</p>
        </div>
        <div className="flex gap-2">
          <Button 
            size="sm"
            onClick={() => navigate('/regions/provinces/create')}
          >
            <Plus className="mr-2 h-4 w-4" />
            Tambah Provinsi
          </Button>
        </div>
      </div>
      <DataTable
        columns={columns}
        data={provinces}
        searchPlaceholder="Cari provinsi..."
        tableId="regions"
      />
    </div>
  );
}
