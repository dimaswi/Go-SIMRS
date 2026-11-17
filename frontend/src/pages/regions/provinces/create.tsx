import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { regionsApi } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, MapPin } from 'lucide-react';
import { PageShell, PageHeader, PageContent } from '@/components/layout/page-shell';

export default function ProvinceCreatePage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    id: '',
    name: ''
  });

  useEffect(() => {
    setPageTitle('Tambah Provinsi');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.id || !formData.name) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Kode dan nama provinsi wajib diisi.",
      });
      return;
    }

    if (formData.id.length !== 2) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Kode provinsi harus 2 digit.",
      });
      return;
    }

    setLoading(true);
    try {
      const response = await regionsApi.createProvince(formData);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: response.data.message,
      });
      navigate('/regions');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal membuat provinsi.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        icon={MapPin}
        title="Tambah Provinsi"
        description="Tambah data provinsi baru secara manual"
        onBack={() => navigate('/regions')}
      />
      <PageContent>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
          <div className="space-y-2">
            <Label htmlFor="id">Kode Provinsi</Label>
            <Input
              id="id"
              placeholder="Contoh: 99"
              value={formData.id}
              onChange={(e) => setFormData({ ...formData, id: e.target.value })}
              maxLength={2}
            />
            <p className="text-xs text-muted-foreground">Kode 2 digit sesuai standar Kemendagri</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nama Provinsi</Label>
            <Input
              id="name"
              placeholder="Contoh: PROVINSI BARU"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => navigate('/regions')}>
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Simpan
            </Button>
          </div>
        </form>
      </PageContent>
    </PageShell>
  );
}
