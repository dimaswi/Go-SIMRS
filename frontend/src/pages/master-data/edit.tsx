import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { masterDataApi, type MasterData, type MasterDataRequest } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, ArrowLeft, Save } from 'lucide-react';

// Category name mapping
const CATEGORY_NAMES: Record<string, string> = {
  gender: 'Jenis Kelamin',
  religion: 'Agama',
  marital_status: 'Status Perkawinan',
  education_level: 'Pendidikan Terakhir',
  employee_type: 'Tipe Karyawan',
  employment_status: 'Status Kepegawaian',
  blood_type: 'Golongan Darah',
  relationship: 'Hubungan Keluarga',
  bank: 'Bank',
  department: 'Departemen',
  position: 'Jabatan',
  specialization: 'Spesialisasi',
};

export default function EditMasterDataPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<MasterData | null>(null);
  const [formData, setFormData] = useState<Partial<MasterDataRequest>>({
    code: '',
    name: '',
    description: '',
    sort_order: 0,
    is_active: true,
    is_default: false,
  });

  useEffect(() => {
    setPageTitle('Edit Master Data');
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    try {
      const response = await masterDataApi.getById(parseInt(id));
      const masterData = response.data.data;
      setData(masterData);
      setFormData({
        code: masterData.code,
        name: masterData.name,
        description: masterData.description || '',
        sort_order: masterData.sort_order,
        is_active: masterData.is_active,
        is_default: masterData.is_default,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error instanceof Error ? error.message : "Gagal memuat data.",
      });
      navigate('/master-data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.code || !formData.name) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Kode dan nama wajib diisi.",
      });
      return;
    }

    setSaving(true);
    try {
      await masterDataApi.update(parseInt(id!), formData);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Data berhasil diperbarui.",
      });
      
      // Navigate back to category list
      if (data?.category) {
        navigate(`/master-data/category/${data.category}`);
      } else {
        navigate('/master-data');
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal memperbarui data.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: keyof MasterDataRequest, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const categoryName = data?.category ? CATEGORY_NAMES[data.category] || data.category : '';

  return (
    <div className="flex flex-1 flex-col p-4">
      <div className="grid gap-4">
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => navigate(-1)}
            className="h-9 w-9"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="space-y-1">
            <h1 className="text-lg font-semibold">Edit {categoryName}</h1>
            <p className="text-sm text-muted-foreground">Perbarui data {categoryName.toLowerCase()}</p>
          </div>
        </div>
        <div className="rounded-lg border p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="category">Kategori</Label>
                  <Input
                    id="category"
                    value={categoryName}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="code">Kode <span className="text-destructive">*</span></Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => handleChange('code', e.target.value.toUpperCase())}
                    placeholder="Contoh: L, P, ISLAM, S1"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nama <span className="text-destructive">*</span></Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    placeholder="Nama data"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sort_order">Urutan</Label>
                  <Input
                    id="sort_order"
                    type="number"
                    value={formData.sort_order}
                    onChange={(e) => handleChange('sort_order', parseInt(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Deskripsi</Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => handleChange('description', e.target.value)}
                  placeholder="Deskripsi data (opsional)"
                  rows={3}
                />
              </div>

              <div className="flex items-center gap-8">
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => handleChange('is_active', checked)}
                  />
                  <Label htmlFor="is_active" className="cursor-pointer">Aktif</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_default"
                    checked={formData.is_default}
                    onCheckedChange={(checked) => handleChange('is_default', checked)}
                  />
                  <Label htmlFor="is_default" className="cursor-pointer">Jadikan default</Label>
                </div>
              </div>

              <div className="flex justify-end gap-4">
                <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                  Batal
                </Button>
                <Button type="submit" disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" />
                  Simpan
                </Button>
              </div>
            </form>
        </div>
      </div>
    </div>
  );
}
