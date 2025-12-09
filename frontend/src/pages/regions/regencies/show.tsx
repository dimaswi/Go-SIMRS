import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DataTable } from '@/components/ui/data-table';
import { regionsApi, type Regency } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { createDistrictColumns } from '../districts/columns';
import { 
  Loader2, 
  ArrowLeft,
  Building2,
  Map,
  Pencil,
  Plus
} from 'lucide-react';

export default function RegencyShowPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [regency, setRegency] = useState<Regency | null>(null);
  const [loading, setLoading] = useState(true);

  const columns = useMemo(
    () =>
      createDistrictColumns({
        onView: (district) => navigate(`/regions/districts/${district.id}`),
        onEdit: (district) => navigate(`/regions/districts/${district.id}/edit`),
      }),
    [navigate]
  );

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      try {
        const response = await regionsApi.getRegency(id);
        setRegency(response.data.data);
        setPageTitle(`Kabupaten/Kota ${response.data.data.name}`);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error!",
          description: "Gagal memuat data kabupaten/kota.",
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

  if (!regency) {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      {/* Districts List */}
      <Card className="shadow-md">
        <CardHeader className="border-b bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (regency.province) {
                    navigate(`/regions/provinces/${regency.province.id}`);
                  } else {
                    navigate('/regions');
                  }
                }}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  {regency.name}
                </CardTitle>
                <CardDescription>
                  {regency.districts && regency.districts.length > 0 
                    ? `${regency.districts.length} kecamatan` 
                    : 'Belum ada data kecamatan'}
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline"
                size="sm"
                onClick={() => navigate(`/regions/regencies/${id}/edit`)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button 
                variant="outline"
                size="sm"
                onClick={() => navigate(`/regions/districts/create?regencyId=${id}`)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Tambah Kecamatan
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {!regency.districts || regency.districts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Map className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Belum ada data kecamatan</p>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={regency.districts}
              searchPlaceholder="Cari kecamatan..."
              tableId="regency_districts"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
