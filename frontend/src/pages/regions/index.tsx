import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
    <div className="flex flex-1 flex-col gap-4 p-6">
      {/* DataTable */}
      <Card className="shadow-md">
        <CardHeader className="border-b bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold">Daftar Provinsi</CardTitle>
              <CardDescription>
                Data wilayah administratif Indonesia
              </CardDescription>
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
        </CardHeader>
        <CardContent className="pt-6">
          <DataTable
            columns={columns}
            data={provinces}
            searchPlaceholder="Cari provinsi..."
          />
        </CardContent>
      </Card>
    </div>
  );
}
