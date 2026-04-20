import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { regionsApi, type Village } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, ArrowLeft, Home } from 'lucide-react';

export default function VillageEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [village, setVillage] = useState<Village | null>(null);
  const [name, setName] = useState('');

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      try {
        const response = await regionsApi.getVillage(id);
        setVillage(response.data.data);
        setName(response.data.data.name);
        setPageTitle(`Edit ${response.data.data.name}`);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !id) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Nama desa/kelurahan wajib diisi.",
      });
      return;
    }

    setSaving(true);
    try {
      const response = await regionsApi.updateVillage(id, { name });
      toast({
        variant: "success",
        title: "Berhasil!",
        description: response.data.message,
      });
      navigate(`/regions/villages/${id}`);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal mengupdate desa/kelurahan.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!village) return null;

  const district = village.district;
  const regency = district?.regency;
  const province = regency?.province;

  return (
    <div className="flex flex-1 flex-col px-4">
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.history.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <Home className="h-5 w-5" />
              Edit Desa/Kelurahan
            </h1>
            <p className="text-sm text-muted-foreground">
              Edit data {village.name}
            </p>
          </div>
        </div>
        <div className="rounded-lg border p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Provinsi</Label>
              <Input
                value={province?.name || '-'}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label>Kabupaten/Kota</Label>
              <Input
                value={regency?.name || '-'}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label>Kecamatan</Label>
              <Input
                value={district?.name || '-'}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="id">Kode Desa/Kelurahan</Label>
              <Input
                id="id"
                value={village.id}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">Kode tidak dapat diubah</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nama Desa/Kelurahan</Label>
              <Input
                id="name"
                placeholder="Nama Desa/Kelurahan"
                value={name}
                onChange={(e) => setName(e.target.value.toUpperCase())}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => navigate(`/regions/villages/${id}`)}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
