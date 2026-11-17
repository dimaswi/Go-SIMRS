import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { regionsApi, type District } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, Map } from 'lucide-react';
import { PageShell, PageHeader, PageContent } from '@/components/layout/page-shell';

export default function DistrictEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [district, setDistrict] = useState<District | null>(null);
  const [name, setName] = useState('');

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      try {
        const response = await regionsApi.getDistrict(id);
        setDistrict(response.data.data);
        setName(response.data.data.name);
        setPageTitle(`Edit ${response.data.data.name}`);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !id) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Nama kecamatan wajib diisi.",
      });
      return;
    }

    setSaving(true);
    try {
      const response = await regionsApi.updateDistrict(id, { name });
      toast({
        variant: "success",
        title: "Berhasil!",
        description: response.data.message,
      });
      navigate(`/regions/districts/${id}`);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal mengupdate kecamatan.",
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

  if (!district) return null;

  return (
    <PageShell>
      <PageHeader
        icon={Map}
        title="Edit Kecamatan"
        description={`Edit data ${district.name}`}
        onBack={() => navigate(`/regions/districts/${id}`)}
      />
      <PageContent>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
          <div className="space-y-2">
            <Label>Provinsi</Label>
            <Input
              value={district.regency?.province?.name || '-'}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label>Kabupaten/Kota</Label>
            <Input
              value={district.regency?.name || '-'}
              disabled
              className="bg-muted"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="id">Kode Kecamatan</Label>
            <Input
              id="id"
              value={district.id}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">Kode tidak dapat diubah</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nama Kecamatan</Label>
            <Input
              id="name"
              placeholder="Nama Kecamatan"
              value={name}
              onChange={(e) => setName(e.target.value.toUpperCase())}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => navigate(`/regions/districts/${id}`)}>
              Batal
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </div>
        </form>
      </PageContent>
    </PageShell>
  );
}
