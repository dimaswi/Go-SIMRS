import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { regionsApi, type Village } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { 
  Loader2, 
  Home,
  Pencil
} from 'lucide-react';
import { PageShell, PageHeader, PageContent } from '@/components/layout/page-shell';

export default function VillageShowPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [village, setVillage] = useState<Village | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      try {
        const response = await regionsApi.getVillage(id);
        setVillage(response.data.data);
        setPageTitle(`Desa/Kelurahan ${response.data.data.name}`);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error!",
          description: "Gagal memuat data desa/kelurahan.",
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

  if (!village) {
    return null;
  }

  const district = village.district;
  const regency = district?.regency;
  const province = regency?.province;

  return (
    <PageShell>
      <PageHeader
        icon={Home}
        title={village.name}
        description="Detail lengkap desa/kelurahan"
        onBack={() => {
          if (district) {
            navigate(`/regions/districts/${district.id}`);
          } else {
            navigate('/regions');
          }
        }}
        actions={
          <Button 
            variant="outline"
            size="sm"
            onClick={() => navigate(`/regions/villages/${id}/edit`)}
          >
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        }
      />
      <PageContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Nama Desa/Kelurahan</p>
              <p className="font-medium">{village.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Kode Kemendagri</p>
              <p className="font-mono font-medium">{village.id}</p>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Alamat Lengkap</p>
              <p className="font-medium">
                {village.name}, {district?.name}, {regency?.name}, {province?.name}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Kode Kecamatan</p>
              <p className="font-mono font-medium">{village.district_id}</p>
            </div>
          </div>
        </div>
      </PageContent>
    </PageShell>
  );
}
