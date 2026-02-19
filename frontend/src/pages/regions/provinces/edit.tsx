import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { regionsApi, type Province } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, ArrowLeft, MapPin } from 'lucide-react';

export default function ProvinceEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [province, setProvince] = useState<Province | null>(null);
  const [name, setName] = useState('');

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      try {
        const response = await regionsApi.getProvince(id);
        setProvince(response.data.data);
        setName(response.data.data.name);
        setPageTitle(`Edit ${response.data.data.name}`);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !id) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Nama provinsi wajib diisi.",
      });
      return;
    }

    setSaving(true);
    try {
      const response = await regionsApi.updateProvince(id, { name });
      toast({
        variant: "success",
        title: "Berhasil!",
        description: response.data.message,
      });
      navigate(`/regions/provinces/${id}`);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal mengupdate provinsi.",
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

  if (!province) return null;

  return (
    <div className="flex flex-1 flex-col p-4">
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/regions/provinces/${id}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Edit Provinsi
            </h1>
            <p className="text-sm text-muted-foreground">
              Edit data provinsi {province.name}
            </p>
          </div>
        </div>
        <div className="rounded-lg border p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="id">Kode Provinsi</Label>
              <Input
                id="id"
                value={province.id}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">Kode provinsi tidak dapat diubah</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nama Provinsi</Label>
              <Input
                id="name"
                placeholder="Nama Provinsi"
                value={name}
                onChange={(e) => setName(e.target.value.toUpperCase())}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => navigate(`/regions/provinces/${id}`)}>
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
