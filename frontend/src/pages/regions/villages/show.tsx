import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { regionsApi, type Village } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { 
  Loader2, 
  ArrowLeft,
  Home,
  Pencil
} from 'lucide-react';

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
    <div className="flex flex-1 flex-col gap-4 p-6">
      {/* Detail Info */}
      <Card className="shadow-md">
        <CardHeader className="border-b bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  if (district) {
                    navigate(`/regions/districts/${district.id}`);
                  } else {
                    navigate('/regions');
                  }
                }}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="space-y-1">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Home className="h-5 w-5" />
                  {village.name}
                </CardTitle>
                <CardDescription>
                  Detail lengkap desa/kelurahan
                </CardDescription>
              </div>
            </div>
            <Button 
              variant="outline"
              size="sm"
              onClick={() => navigate(`/regions/villages/${id}/edit`)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
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
        </CardContent>
      </Card>
    </div>
  );
}
