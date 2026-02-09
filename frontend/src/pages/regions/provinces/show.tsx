import { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { DataTable } from '@/components/ui/data-table';
import { regionsApi, type Province, type Regency } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { createRegencyColumns } from '../regencies/columns';
import { 
  Loader2, 
  ArrowLeft, 
  MapPin,
  Building2,
  Pencil,
  Plus
} from 'lucide-react';

export default function ProvinceShowPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [province, setProvince] = useState<Province & { regencies?: Regency[] } | null>(null);
  const [loading, setLoading] = useState(true);

  const columns = useMemo(
    () =>
      createRegencyColumns({
        onView: (regency) => navigate(`/regions/regencies/${regency.id}`),
        onEdit: (regency) => navigate(`/regions/regencies/${regency.id}/edit`),
      }),
    [navigate]
  );

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      try {
        const response = await regionsApi.getProvince(id);
        setProvince(response.data.data);
        setPageTitle(`Provinsi ${response.data.data.name}`);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error!",
          description: "Gagal memuat data provinsi.",
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

  if (!province) {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      {/* Regencies List */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/regions')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {province.name}
            </h1>
            <p className="text-sm text-muted-foreground">
              {province.regencies && province.regencies.length > 0 
                ? `${province.regencies.length} kabupaten/kota` 
                : 'Belum ada data kabupaten/kota'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="outline"
            size="sm"
            onClick={() => navigate(`/regions/provinces/${id}/edit`)}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button 
            variant="outline"
            size="sm"
            onClick={() => navigate(`/regions/regencies/create?provinceId=${id}`)}
          >
            <Plus className="mr-2 h-4 w-4" />
            Tambah Kabupaten/Kota
          </Button>
        </div>
      </div>
      <div className="rounded-lg border p-6">
          {!province.regencies || province.regencies.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Belum ada data kabupaten/kota</p>
            </div>
          ) : (
            <DataTable
              columns={columns}
              data={province.regencies}
              searchPlaceholder="Cari kabupaten/kota..."
              tableId="province_regencies"
            />
          )}
      </div>
    </div>
  );
}
