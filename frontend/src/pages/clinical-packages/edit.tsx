import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ClinicalPackageForm } from './form';
import { clinicalPackagesApi, type ClinicalPackage, type ClinicalPackageInput } from '@/lib/api/clinical-packages';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';

export default function ClinicalPackagesEdit() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const [pkg, setPkg] = useState<ClinicalPackage | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPageTitle('Edit Paket Klinis');
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await clinicalPackagesApi.getById(Number(id));
        setPkg(response.data.data);
      } catch {
        toast({ variant: 'destructive', title: 'Error!', description: 'Gagal memuat data paket klinis.' });
        navigate('/clinical-packages');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, navigate, toast]);

  const handleSubmit = async (data: ClinicalPackageInput) => {
    setSaving(true);
    try {
      await clinicalPackagesApi.update(Number(id), data);
      toast({ title: 'Berhasil!', description: 'Paket klinis berhasil diupdate.' });
      navigate('/clinical-packages');
    } catch (error: any) {
      toast({ variant: 'destructive', title: 'Error!', description: error?.response?.data?.error || 'Gagal mengupdate paket klinis.' });
    } finally {
      setSaving(false);
    }
  };

  return <ClinicalPackageForm title="Edit Paket Klinis" submitLabel="Update" initialData={pkg} loading={loading} saving={saving} onSubmit={handleSubmit} />;
}