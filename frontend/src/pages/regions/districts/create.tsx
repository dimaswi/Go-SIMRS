import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { regionsApi, type Province, type Regency } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, ArrowLeft, Map } from 'lucide-react';

export default function DistrictCreatePage() {
  const { regencyId } = useParams<{ regencyId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [regencies, setRegencies] = useState<Regency[]>([]);
  const [selectedProvinceId, setSelectedProvinceId] = useState('');
  const [formData, setFormData] = useState({
    id: '',
    regency_id: regencyId || '',
    name: ''
  });

  useEffect(() => {
    setPageTitle('Tambah Kecamatan');
    const loadProvinces = async () => {
      try {
        const response = await regionsApi.getProvinces();
        setProvinces(response.data.data);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error!",
          description: "Gagal memuat data provinsi.",
        });
      } finally {
        setLoading(false);
      }
    };
    loadProvinces();
  }, [toast]);

  useEffect(() => {
    const loadRegencies = async () => {
      if (!selectedProvinceId) {
        setRegencies([]);
        return;
      }
      try {
        const response = await regionsApi.getRegencies(selectedProvinceId);
        setRegencies(response.data.data);
      } catch (error) {
        toast({
          variant: "destructive",
          title: "Error!",
          description: "Gagal memuat data kabupaten/kota.",
        });
      }
    };
    loadRegencies();
  }, [selectedProvinceId, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.id || !formData.name || !formData.regency_id) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Semua field wajib diisi.",
      });
      return;
    }

    if (formData.id.length !== 7) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Kode kecamatan harus 7 digit.",
      });
      return;
    }

    setSaving(true);
    try {
      const response = await regionsApi.createDistrict(formData);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: response.data.message,
      });
      navigate(`/regions/regencies/${formData.regency_id}`);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal membuat kecamatan.",
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

  return (
    <div className="flex flex-1 flex-col px-4">
      <Card className="max-w-2xl">
        <CardHeader className="border-b bg-muted/50">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div className="space-y-1">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Map className="h-5 w-5" />
                Tambah Kecamatan
              </CardTitle>
              <CardDescription>
                Tambah data kecamatan baru secara manual
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Provinsi</Label>
              <Select 
                value={selectedProvinceId} 
                onValueChange={(value) => {
                  setSelectedProvinceId(value);
                  setFormData({ ...formData, regency_id: '' });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Provinsi" />
                </SelectTrigger>
                <SelectContent>
                  {provinces.map((province) => (
                    <SelectItem key={province.id} value={province.id}>
                      {province.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Kabupaten/Kota</Label>
              <Select 
                value={formData.regency_id} 
                onValueChange={(value) => setFormData({ ...formData, regency_id: value })}
                disabled={!selectedProvinceId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pilih Kabupaten/Kota" />
                </SelectTrigger>
                <SelectContent>
                  {regencies.map((regency) => (
                    <SelectItem key={regency.id} value={regency.id}>
                      {regency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="id">Kode Kecamatan</Label>
              <Input
                id="id"
                placeholder="Contoh: 9999999"
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                maxLength={7}
              />
              <p className="text-xs text-muted-foreground">Kode 7 digit sesuai standar Kemendagri</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Nama Kecamatan</Label>
              <Input
                id="name"
                placeholder="Contoh: KECAMATAN BARU"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => navigate(-1)}>
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
