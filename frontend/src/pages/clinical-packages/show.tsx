import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageShell, PageHeader, PageContent } from '@/components/layout/page-shell';
import { Separator } from '@/components/ui/separator';
import { clinicalPackagesApi, type ClinicalPackage } from '@/lib/api/clinical-packages';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, Pencil, Pill, Stethoscope } from 'lucide-react';

const PROCEDURE_TYPE_LABELS: Record<string, string> = {
  consultation: 'Konsultasi',
  radiology: 'Radiologi',
  laboratory: 'Laboratorium',
  medical: 'Medis',
};

export default function ClinicalPackagesShow() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const [pkg, setPkg] = useState<ClinicalPackage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPageTitle('Detail Paket Tindakan');
  }, []);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await clinicalPackagesApi.getById(Number(id));
        setPkg(response.data.data);
      } catch {
        toast({ variant: 'destructive', title: 'Error!', description: 'Gagal memuat data paket tindakan.' });
        navigate('/clinical-packages');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [id, navigate, toast]);

  if (loading || !pkg) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalMedicineQuantity = (pkg.medicine_items || []).reduce((total, item) => total + (item.quantity || 0), 0);

  return (
    <PageShell>
      <PageHeader
        title={pkg.name}
        description={pkg.code}
        onBack={() => navigate('/clinical-packages')}
        badges={
          <Badge variant={pkg.is_active ? 'default' : 'secondary'}>{pkg.is_active ? 'Aktif' : 'Nonaktif'}</Badge>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => navigate(`/clinical-packages/${id}/edit`)}
              className="bg-neutral-900 text-white dark:bg-white dark:text-neutral-900 hover:bg-neutral-800 rounded-none h-8 px-3 text-xs font-semibold gap-1.5 shadow-none"
            >
              <Pencil className="size-3.5" /> Edit
            </Button>
          </div>
        }
      />

      <PageContent className="space-y-8">
      <section className="space-y-4">
        <div className="border-b border-neutral-200 dark:border-neutral-800 pb-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={pkg.is_active ? 'default' : 'secondary'}>{pkg.is_active ? 'Aktif' : 'Nonaktif'}</Badge>
                <Badge variant="outline">{pkg.procedure_items?.length || 0} tindakan</Badge>
                <Badge variant="outline">{pkg.medicine_items?.length || 0} obat</Badge>
                <Badge variant="outline">Qty obat {totalMedicineQuantity}</Badge>
              </div>
              <h2 className="text-xl font-bold">{pkg.name}</h2>
              <p className="text-xs font-mono text-muted-foreground">{pkg.code}</p>
            </div>
            <div className="grid grid-cols-2 divide-x divide-neutral-200 dark:divide-neutral-800 border border-neutral-200 dark:border-neutral-800 min-w-[260px] bg-neutral-50/40 dark:bg-neutral-900/30">
              <div className="px-4 py-2.5">
                <p className="text-xs text-muted-foreground">Tindakan</p>
                <p className="text-xl font-semibold">{pkg.procedure_items?.length || 0}</p>
              </div>
              <div className="px-4 py-2.5">
                <p className="text-xs text-muted-foreground">Obat</p>
                <p className="text-xl font-semibold">{pkg.medicine_items?.length || 0}</p>
              </div>
            </div>
          </div>
        </div>
        {(pkg.description || pkg.notes) && (
          <div className="space-y-4">
            {pkg.description ? (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Deskripsi</p>
                <p className="text-sm text-muted-foreground">{pkg.description}</p>
              </div>
            ) : null}
            {pkg.notes ? (
              <>
                {pkg.description && <Separator />}
                <div>
                  <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Catatan Paket</p>
                  <p className="text-sm text-muted-foreground">{pkg.notes}</p>
                </div>
              </>
            ) : null}
          </div>
        )}
      </section>

      <div className="grid gap-8 xl:grid-cols-2">
        <section className="space-y-4">
          <div className="border-b border-neutral-200 dark:border-neutral-800 pb-2.5">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
              <Stethoscope className="h-4 w-4 text-neutral-500" />
              Tindakan Paket
            </h3>
            <p className="mt-0.5 text-[11px] font-mono text-neutral-500">{pkg.procedure_items?.length || 0} tindakan terkonfigurasi dalam paket ini.</p>
          </div>
          <div>
            {pkg.procedure_items && pkg.procedure_items.length > 0 ? (
              <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border-y border-neutral-200 dark:border-neutral-800">
                {pkg.procedure_items.map((item, index) => (
                  <div key={item.id} className="py-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">#{index + 1}</Badge>
                      <Badge variant="outline" className="font-mono">{item.procedure?.code || '-'}</Badge>
                      <Badge variant="outline">{PROCEDURE_TYPE_LABELS[item.procedure?.procedure_type || ''] || 'Tindakan'}</Badge>
                    </div>
                    <div>
                      <p className="font-medium text-sm">{item.procedure?.name || `Tindakan #${item.procedure_id}`}</p>
                      {item.procedure?.description ? <p className="text-xs text-muted-foreground mt-1">{item.procedure.description}</p> : null}
                    </div>
                    {item.notes ? <p className="text-xs text-muted-foreground">Catatan: {item.notes}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Tidak ada tindakan.</p>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className="border-b border-neutral-200 dark:border-neutral-800 pb-2.5">
            <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">
              <Pill className="h-4 w-4 text-neutral-500" />
              Obat Paket
            </h3>
            <p className="mt-0.5 text-[11px] font-mono text-neutral-500">{pkg.medicine_items?.length || 0} obat terkonfigurasi dalam paket ini.</p>
          </div>
          <div>
            {pkg.medicine_items && pkg.medicine_items.length > 0 ? (
              <div className="divide-y divide-neutral-200 dark:divide-neutral-800 border-y border-neutral-200 dark:border-neutral-800">
                {pkg.medicine_items.map((item, index) => (
                  <div key={item.id} className="py-3 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="secondary">#{index + 1}</Badge>
                      <Badge variant="outline" className="font-mono">{item.medicine?.code || '-'}</Badge>
                      <Badge variant="outline">Qty {item.quantity} {item.unit || item.medicine?.unit || ''}</Badge>
                    </div>
                    <div>
                      <p className="font-medium text-sm">{item.medicine?.name || `Obat #${item.medicine_id}`}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {[item.dosage, item.frequency, item.route, item.duration].filter(Boolean).join(' • ') || 'Tanpa instruksi tambahan'}
                      </p>
                    </div>
                    {item.instructions ? <p className="text-xs text-muted-foreground">Instruksi: {item.instructions}</p> : null}
                    {item.notes ? <p className="text-xs text-muted-foreground">Catatan: {item.notes}</p> : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Tidak ada obat.</p>
            )}
          </div>
        </section>
      </div>
      </PageContent>
    </PageShell>
  );
}