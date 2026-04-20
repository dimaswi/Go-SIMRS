import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { clinicalPackagesApi, type ClinicalPackage } from '@/lib/api/clinical-packages';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { ArrowLeft, Loader2, Pencil, Pill, Stethoscope } from 'lucide-react';

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
    setPageTitle('Detail Paket Klinis');
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

  if (loading || !pkg) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const totalMedicineQuantity = (pkg.medicine_items || []).reduce((total, item) => total + (item.quantity || 0), 0);

  return (
    <div className="flex flex-1 flex-col px-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">{pkg.name}</h1>
            <p className="text-sm text-muted-foreground font-mono">{pkg.code}</p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={() => navigate(`/clinical-packages/${id}/edit`)}>
          <Pencil className="mr-2 h-4 w-4" /> Edit
        </Button>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-slate-50 via-white to-emerald-50/70">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={pkg.is_active ? 'default' : 'secondary'}>{pkg.is_active ? 'Aktif' : 'Nonaktif'}</Badge>
                <Badge variant="outline">{pkg.procedure_items?.length || 0} tindakan</Badge>
                <Badge variant="outline">{pkg.medicine_items?.length || 0} obat</Badge>
                <Badge variant="outline">Qty obat {totalMedicineQuantity}</Badge>
              </div>
              <CardTitle className="text-xl">{pkg.name}</CardTitle>
              <CardDescription className="font-mono">{pkg.code}</CardDescription>
            </div>
            <div className="grid grid-cols-2 gap-3 min-w-[260px]">
              <div className="rounded-lg border bg-background px-4 py-3">
                <p className="text-xs text-muted-foreground">Tindakan</p>
                <p className="text-2xl font-semibold">{pkg.procedure_items?.length || 0}</p>
              </div>
              <div className="rounded-lg border bg-background px-4 py-3">
                <p className="text-xs text-muted-foreground">Obat</p>
                <p className="text-2xl font-semibold">{pkg.medicine_items?.length || 0}</p>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {pkg.description ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Deskripsi</p>
              <p className="text-sm text-muted-foreground">{pkg.description}</p>
            </div>
          ) : null}
          {pkg.notes ? (
            <>
              <Separator />
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-1">Catatan Paket</p>
                <p className="text-sm text-muted-foreground">{pkg.notes}</p>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card className="overflow-hidden border-sky-200/70">
          <CardHeader className="bg-sky-50/70">
            <CardTitle className="flex items-center gap-2 text-base">
              <Stethoscope className="h-4 w-4" />
              Tindakan Paket
            </CardTitle>
            <CardDescription>{pkg.procedure_items?.length || 0} tindakan terkonfigurasi dalam paket ini.</CardDescription>
          </CardHeader>
          <CardContent>
            {pkg.procedure_items && pkg.procedure_items.length > 0 ? (
              <div className="space-y-3">
                {pkg.procedure_items.map((item, index) => (
                  <div key={item.id} className="rounded-xl border bg-background p-4 space-y-2">
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
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-emerald-200/70">
          <CardHeader className="bg-emerald-50/70">
            <CardTitle className="flex items-center gap-2 text-base">
              <Pill className="h-4 w-4" />
              Obat Paket
            </CardTitle>
            <CardDescription>{pkg.medicine_items?.length || 0} obat terkonfigurasi dalam paket ini.</CardDescription>
          </CardHeader>
          <CardContent>
            {pkg.medicine_items && pkg.medicine_items.length > 0 ? (
              <div className="space-y-3">
                {pkg.medicine_items.map((item, index) => (
                  <div key={item.id} className="rounded-xl border bg-background p-4 space-y-2">
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
          </CardContent>
        </Card>
      </div>
    </div>
  );
}