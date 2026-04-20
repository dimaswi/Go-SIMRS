import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { masterDataApi, type MasterDataRequest } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, ArrowLeft, Save } from 'lucide-react';
import { Combobox } from '@/components/ui/combobox';

// Category options
const CATEGORY_OPTIONS = [
  { value: 'gender', label: 'Jenis Kelamin' },
  { value: 'religion', label: 'Agama' },
  { value: 'marital_status', label: 'Status Perkawinan' },
  { value: 'education_level', label: 'Pendidikan Terakhir' },
  { value: 'employee_type', label: 'Tipe Karyawan' },
  { value: 'employment_status', label: 'Status Kepegawaian' },
  { value: 'blood_type', label: 'Golongan Darah' },
  { value: 'relationship', label: 'Hubungan Keluarga' },
  { value: 'bank', label: 'Bank' },
  { value: 'department', label: 'Departemen' },
  { value: 'position', label: 'Jabatan' },
  { value: 'specialization', label: 'Spesialisasi' },
];

export default function CreateMasterDataPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const categoryFromUrl = searchParams.get('category');
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<MasterDataRequest>({
    category: categoryFromUrl || '',
    code: '',
    name: '',
    description: '',
    sort_order: 0,
    is_active: true,
    is_default: false,
  });

  useEffect(() => {
    setPageTitle('Tambah Master Data');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.category || !formData.code || !formData.name) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Kategori, kode, dan nama wajib diisi.",
      });
      return;
    }

    setLoading(true);
    try {
      await masterDataApi.create(formData);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Data berhasil ditambahkan.",
      });
      
      // Navigate back to category list or master data index
      if (formData.category) {
        navigate(`/master-data/category/${formData.category}`);
      } else {
        navigate('/master-data');
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menambahkan data.",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof MasterDataRequest, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="flex flex-1 flex-col px-4">
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
        <div>
          <h1 className="text-lg font-semibold">Tambah Referensi Data</h1>
          <p className="text-sm text-muted-foreground">Tambahkan data referensi baru</p>
        </div>
      </div>
      <div className="rounded-lg border p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="category">Kategori <span className="text-destructive">*</span></Label>
                  <Combobox
                    options={CATEGORY_OPTIONS}
                    value={formData.category}
                    onValueChange={(value) => handleChange('category', value)}
                    placeholder="Pilih kategori"
                    searchPlaceholder="Cari kategori..."
                    emptyText="Kategori tidak ditemukan"
                    disabled={!!categoryFromUrl}
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
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Save className="mr-2 h-4 w-4" />
                  Simpan
                </Button>
              </div>
            </form>
      </div>
    </div>
  );
}
