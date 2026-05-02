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
import { Combobox } from '@/components/ui/combobox';
import { resolveBackendFileUrl } from '@/lib/api/client';

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
  body_marker_category: 'Kategori Marker Tubuh',
  body_marker_image: 'Gambar Marker Tubuh',
  o2_type: 'Jenis Oksigen',
};

export default function EditMasterDataPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [data, setData] = useState<MasterData | null>(null);
  const [markerCategories, setMarkerCategories] = useState<MasterData[]>([]);
  const [bodyMarkerImageUrl, setBodyMarkerImageUrl] = useState('');
  const [o2Price, setO2Price] = useState('');
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

  const isBodyMarkerImageCategory = data?.category === 'body_marker_image';
  const isO2TypeCategory = data?.category === 'o2_type';

  useEffect(() => {
    if (!isBodyMarkerImageCategory) {
      setMarkerCategories([]);
      return;
    }

    let active = true;
    const loadMarkerCategories = async () => {
      try {
        const response = await masterDataApi.getByCategory('body_marker_category', { include_inactive: true });
        if (!active) return;
        setMarkerCategories(response.data.data || []);
      } catch {
        if (!active) return;
        setMarkerCategories([]);
      }
    };

    loadMarkerCategories();

    return () => {
      active = false;
    };
  }, [isBodyMarkerImageCategory]);

  const parseImageUrlFromMetadata = (metadata?: string) => {
    const raw = (metadata || '').trim();
    if (!raw) return '';
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.image_url === 'string') return parsed.image_url;
      if (typeof parsed?.url === 'string') return parsed.url;
      return '';
    } catch {
      return raw;
    }
  };

  const parsePriceFromMetadata = (metadata?: string) => {
    const raw = (metadata || '').trim();
    if (!raw) return 0;
    try {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.price === 'number') return parsed.price;
      if (typeof parsed?.price === 'string') return parseInt(parsed.price) || 0;
      return 0;
    } catch {
      return 0;
    }
  };

  const handleUploadImage = async (file?: File) => {
    if (!file) return;

    setUploadingImage(true);
    try {
      const response = await masterDataApi.uploadImage(file);
      setBodyMarkerImageUrl(response.data.url);
      toast({
        variant: 'success',
        title: 'Berhasil!',
        description: 'Gambar marker berhasil diunggah.',
      });
    } catch {
      toast({
        variant: 'destructive',
        title: 'Error!',
        description: 'Gagal mengunggah gambar marker.',
      });
    } finally {
      setUploadingImage(false);
    }
  };

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
        parent_id: masterData.parent_id,
        metadata: masterData.metadata || '',
      });
      setBodyMarkerImageUrl(parseImageUrlFromMetadata(masterData.metadata));
      setO2Price(String(parsePriceFromMetadata(masterData.metadata)));
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

    if (isBodyMarkerImageCategory) {
      if (!formData.parent_id) {
        toast({
          variant: 'destructive',
          title: 'Error!',
          description: 'Kategori gambar marker wajib dipilih.',
        });
        return;
      }

      if (!bodyMarkerImageUrl) {
        toast({
          variant: 'destructive',
          title: 'Error!',
          description: 'Gambar marker wajib diunggah.',
        });
        return;
      }
    }

    setSaving(true);
    try {
      const payload: Partial<MasterDataRequest> = {
        ...formData,
        metadata: isBodyMarkerImageCategory
          ? JSON.stringify({ image_url: bodyMarkerImageUrl })
          : isO2TypeCategory
          ? JSON.stringify({ price: parseInt(o2Price) || 0 })
          : formData.metadata,
      };

      await masterDataApi.update(parseInt(id!), payload);
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
    <div className="flex flex-1 flex-col px-4">
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

              {isBodyMarkerImageCategory && (
                <>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Kategori Gambar Marker <span className="text-destructive">*</span></Label>
                      <Combobox
                        options={markerCategories.map((item) => ({
                          value: String(item.id),
                          label: item.name,
                        }))}
                        value={formData.parent_id ? String(formData.parent_id) : ''}
                        onValueChange={(value) => handleChange('parent_id', value ? Number(value) : undefined)}
                        placeholder="Pilih kategori gambar"
                        searchPlaceholder="Cari kategori..."
                        emptyText="Kategori marker belum tersedia"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="marker-image-upload">Upload Gambar Marker</Label>
                      <Input
                        id="marker-image-upload"
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                        onChange={(e) => handleUploadImage(e.target.files?.[0])}
                        disabled={uploadingImage}
                      />
                      {uploadingImage && (
                        <p className="text-xs text-muted-foreground">Mengunggah gambar...</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="marker-image-url">URL Gambar</Label>
                    <Input
                      id="marker-image-url"
                      value={bodyMarkerImageUrl}
                      onChange={(e) => setBodyMarkerImageUrl(e.target.value)}
                      placeholder="/uploads/master-data/your-image.png"
                    />
                    {bodyMarkerImageUrl && (
                      <div className="rounded-md border bg-muted/20 p-3">
                        <img
                          src={resolveBackendFileUrl(bodyMarkerImageUrl)}
                          alt="Preview marker"
                          className="max-h-48 w-auto rounded border bg-white"
                        />
                      </div>
                    )}
                  </div>
                </>
              )}

              {isO2TypeCategory && (
                <div className="space-y-2">
                  <Label htmlFor="o2-price">Harga per Liter (Rp) <span className="text-destructive">*</span></Label>
                  <Input
                    id="o2-price"
                    type="number"
                    min="0"
                    value={o2Price}
                    onChange={(e) => setO2Price(e.target.value)}
                    placeholder="Contoh: 120000"
                  />
                </div>
              )}

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
