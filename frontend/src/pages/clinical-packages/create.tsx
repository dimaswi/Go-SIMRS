import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClinicalPackageForm } from './form';
import { clinicalPackagesApi, type ClinicalPackageInput } from '@/lib/api/clinical-packages';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';

export default function ClinicalPackagesCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPageTitle('Tambah Paket Tindakan');
  }, []);

  const handleSubmit = async (data: ClinicalPackageInput) => {
    setSaving(true);
    try {
      await clinicalPackagesApi.create(data);
      toast({ title: 'Berhasil!', description: 'Paket tindakan berhasil ditambahkan.' });
      navigate('/clinical-packages');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error!', description: error?.response?.data?.error || 'Gagal menyimpan paket tindakan.' });
    } finally {
      setSaving(false);
    }
  };

  return <ClinicalPackageForm title="Tambah Paket Tindakan" submitLabel="Simpan Paket" saving={saving} onSubmit={handleSubmit} />;
}