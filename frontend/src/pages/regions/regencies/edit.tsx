import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { regionsApi, type Regency } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, ArrowLeft, Building2 } from 'lucide-react';

export default function RegencyEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regency, setRegency] = useState<Regency | null>(null);
  const [name, setName] = useState('');

  useEffect(() => {
    const loadData = async () => {
      if (!id) return;
      try {
        const response = await regionsApi.getRegency(id);
        setRegency(response.data.data);
        setName(response.data.data.name);
        setPageTitle(`Edit ${response.data.data.name}`);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !id) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Nama kabupaten/kota wajib diisi.",
      });
      return;
    }

    setSaving(true);
    try {
      const response = await regionsApi.updateRegency(id, { name });
      toast({
        variant: "success",
        title: "Berhasil!",
        description: response.data.message,
      });
      navigate(`/regions/regencies/${id}`);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal mengupdate kabupaten/kota.",
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

  if (!regency) return null;

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <Card className="shadow-md max-w-2xl">
        <CardHeader className="border-b bg-muted/50">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/regions/regencies/${id}`)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Edit Kabupaten/Kota
              </CardTitle>
              <CardDescription>
                Edit data {regency.name}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Provinsi</Label>
              <Input
                value={regency.province?.name || '-'}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="id">Kode Kabupaten/Kota</Label>
              <Input
                id="id"
                value={regency.id}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">Kode tidak dapat diubah</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nama Kabupaten/Kota</Label>
              <Input
                id="name"
                placeholder="Nama Kabupaten/Kota"
                value={name}
                onChange={(e) => setName(e.target.value.toUpperCase())}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => navigate(`/regions/regencies/${id}`)}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Simpan
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
