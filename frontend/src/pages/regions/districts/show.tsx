import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { regionsApi, type District } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { createVillageColumns } from '../villages/columns';
import { 
  Loader2, 
  ArrowLeft,
  Map,
  Home,
  Pencil,
  Plus
} from 'lucide-react';

export default function DistrictShowPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [district, setDistrict] = useState<District | null>(null);
  const [loading, setLoading] = useState(true);

  const columns = useMemo(
    () =>
      createVillageColumns({
        onView: (village) => navigate(`/regions/villages/${village.id}`),
        onEdit: (village) => navigate(`/regions/villages/${village.id}/edit`),
      }),
    [navigate]
  );

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      try {
        const response = await regionsApi.getDistrict(id);
        setDistrict(response.data.data);
        setPageTitle(`Kecamatan ${response.data.data.name}`);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error!",
          description: "Gagal memuat data kecamatan.",
        });
        navigate('/regions');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, navigate, toast]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!district) {
    return null;
  }

  const regency = district.regency;

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      {/* Villages List */}
      <Card className="shadow-md">
        <CardHeader className="border-b bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (regency) {
                    navigate(`/regions/regencies/${regency.id}`);
                  } else {
                    navigate('/regions');
                  }
                }}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Map className="h-5 w-5" />
                  {district.name}
                </CardTitle>
                <CardDescription>
                  {district.villages && district.villages.length > 0 
                    ? `${district.villages.length} desa/kelurahan` 
                    : 'Belum ada data desa/kelurahan'}
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline"
                size="sm"
                onClick={() => navigate(`/regions/districts/${id}/edit`)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button 
                variant="outline"
                size="sm"
                onClick={() => navigate(`/regions/villages/create?districtId=${id}`)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Tambah Desa/Kelurahan
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {!district.villages || district.villages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Home className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Belum ada data desa/kelurahan</p>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={district.villages}
              searchPlaceholder="Cari desa/kelurahan..."
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
