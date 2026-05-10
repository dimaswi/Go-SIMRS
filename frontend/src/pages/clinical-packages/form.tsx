import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageShell, PageHeader, PageContent } from '@/components/layout/page-shell';
import { Combobox } from '@/components/ui/combobox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { ClinicalPackage, ClinicalPackageInput } from '@/lib/api/clinical-packages';
import { medicinesApi, type Medicine } from '@/lib/api/medicines';
import { proceduresApi, type Procedure } from '@/lib/api/procedures';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, Package, Pill, Plus, ScanSearch, Stethoscope, Trash2 } from 'lucide-react';

interface ProcedureFormItem {
  procedure_id: number;
  procedure?: Procedure;
  notes: string;
}

interface MedicineFormItem {
  medicine_id: number;
  medicine?: Medicine;
  quantity: number;
  unit: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  instructions: string;
  notes: string;
}

interface ClinicalPackageFormProps {
  title: string;
  submitLabel: string;
  initialData?: ClinicalPackage | null;
  loading?: boolean;
  saving?: boolean;
  onSubmit: (data: ClinicalPackageInput) => Promise<void>;
}

const PROCEDURE_TYPE_LABELS: Record<string, string> = {
  consultation: 'Konsultasi',
  radiology: 'Radiologi',
  laboratory: 'Laboratorium',
  medical: 'Medis',
};

const DOSAGE_OPTIONS = [
  '1/2 tablet',
  '1 tablet',
  '2 tablet',
  '1 kapsul',
  '2 kapsul',
  '5 ml',
  '10 ml',
  '15 ml',
  '1 sendok takar',
  '2 sendok takar',
  '1 ampul',
  '1 vial',
  '1 tetes',
  '2 tetes',
  '3 tetes',
  '1 puff',
  '2 puff',
];

const FREQUENCY_OPTIONS = [
  '1x1',
  '2x1',
  '3x1',
  '4x1',
  '1x sehari',
  '2x sehari',
  '3x sehari',
  '4x sehari',
  'setiap 4 jam',
  'setiap 6 jam',
  'setiap 8 jam',
  'setiap 12 jam',
  'bila perlu',
];

const ROUTE_OPTIONS = [
  { value: 'oral', label: 'Oral' },
  { value: 'sublingual', label: 'Sublingual' },
  { value: 'topikal', label: 'Topikal' },
  { value: 'intramuskular', label: 'Intramuskular (IM)' },
  { value: 'intravena', label: 'Intravena (IV)' },
  { value: 'subkutan', label: 'Subkutan (SC)' },
  { value: 'rektal', label: 'Rektal' },
  { value: 'inhalasi', label: 'Inhalasi' },
  { value: 'nasal', label: 'Nasal' },
  { value: 'otic', label: 'Otic (Telinga)' },
  { value: 'ophthalmic', label: 'Ophthalmic (Mata)' },
];

const INSTRUCTION_OPTIONS = [
  'Sebelum makan',
  'Sesudah makan',
  'Bersama makan',
  'Pagi hari',
  'Malam hari',
  'Pagi dan malam',
  'Saat perut kosong',
  'Sebelum tidur',
  'Bila perlu',
  'Bila demam',
  'Bila nyeri',
  'Bila mual',
  'Dikunyah',
  'Diteteskan',
  'Dioleskan',
  'Dikocok dulu',
  'Dilarutkan dulu',
];

function formatMedicineMeta(medicine?: Medicine) {
  return [medicine?.form, medicine?.strength, medicine?.unit].filter(Boolean).join(' • ');
}

function buildDosageOptions(item: MedicineFormItem) {
  const options = new Set(DOSAGE_OPTIONS);
  if (item.dosage?.trim()) {
    options.add(item.dosage.trim());
  }
  if (item.medicine?.dosage?.trim()) {
    options.add(item.medicine.dosage.trim());
  }
  if (item.medicine?.strength?.trim()) {
    options.add(item.medicine.strength.trim());
  }
  return Array.from(options);
}

export function ClinicalPackageForm({
  title,
  submitLabel,
  initialData,
  loading = false,
  saving = false,
  onSubmit,
}: ClinicalPackageFormProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [referenceLoading, setReferenceLoading] = useState(true);
  const [allProcedures, setAllProcedures] = useState<Procedure[]>([]);
  const [allMedicines, setAllMedicines] = useState<Medicine[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState('');
  const [procedureItems, setProcedureItems] = useState<ProcedureFormItem[]>([]);
  const [medicineItems, setMedicineItems] = useState<MedicineFormItem[]>([]);
  const [selectedProcedureId, setSelectedProcedureId] = useState('');
  const [selectedMedicineId, setSelectedMedicineId] = useState('');

  useEffect(() => {
    const loadReferenceData = async () => {
      try {
        const [proceduresRes, medicinesRes] = await Promise.all([
          proceduresApi.getAll({ is_active: true }),
          medicinesApi.getAll({ limit: 1000, is_active: true }),
        ]);

        setAllProcedures(proceduresRes.data.data || []);
        setAllMedicines(medicinesRes.data.data || []);
      } catch {
        toast({ variant: 'destructive', title: 'Error!', description: 'Gagal memuat referensi tindakan dan obat.' });
      } finally {
        setReferenceLoading(false);
      }
    };

    loadReferenceData();
  }, [toast]);

  useEffect(() => {
    setCode(initialData?.code || '');
    setName(initialData?.name || '');
    setDescription(initialData?.description || '');
    setIsActive(initialData?.is_active ?? true);
    setNotes(initialData?.notes || '');
    setProcedureItems(
      (initialData?.procedure_items || []).map((item) => ({
        procedure_id: item.procedure_id,
        procedure: item.procedure,
        notes: item.notes || '',
      }))
    );
    setMedicineItems(
      (initialData?.medicine_items || []).map((item) => ({
        medicine_id: item.medicine_id,
        medicine: item.medicine,
        quantity: item.quantity || 1,
        unit: item.unit || item.medicine?.unit || '',
        dosage: item.dosage || item.medicine?.dosage || '',
        frequency: item.frequency || '',
        route: item.route || '',
        duration: item.duration || '',
        instructions: item.instructions || '',
        notes: item.notes || '',
      }))
    );
  }, [initialData]);

  const availableProcedures = useMemo(
    () => allProcedures.filter((procedure) => !procedureItems.some((item) => item.procedure_id === procedure.id)),
    [allProcedures, procedureItems]
  );

  const availableMedicines = useMemo(
    () => allMedicines.filter((medicine) => !medicineItems.some((item) => item.medicine_id === medicine.id)),
    [allMedicines, medicineItems]
  );

  const totalMedicineQuantity = useMemo(
    () => medicineItems.reduce((total, item) => total + Math.max(item.quantity || 0, 0), 0),
    [medicineItems]
  );

  const addProcedure = (procedureIdValue: string) => {
    const procedureId = Number(procedureIdValue);
    const procedure = allProcedures.find((item) => item.id === procedureId);
    if (!procedure) {
      return;
    }

    setProcedureItems((prev) => [...prev, { procedure_id: procedure.id, procedure, notes: '' }]);
    setSelectedProcedureId('');
  };

  const addMedicine = (medicineIdValue: string) => {
    const medicineId = Number(medicineIdValue);
    const medicine = allMedicines.find((item) => item.id === medicineId);
    if (!medicine) {
      return;
    }

    setMedicineItems((prev) => [
      ...prev,
      {
        medicine_id: medicine.id,
        medicine,
        quantity: 1,
        unit: medicine.unit || '',
        dosage: medicine.dosage || '',
        frequency: '',
        route: '',
        duration: '',
        instructions: '',
        notes: '',
      },
    ]);
    setSelectedMedicineId('');
  };

  const updateMedicineItem = (index: number, field: keyof MedicineFormItem, value: string | number) => {
    setMedicineItems((prev) => prev.map((currentItem, currentIndex) => currentIndex === index ? { ...currentItem, [field]: value } : currentItem));
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!name.trim()) {
      toast({ variant: 'destructive', title: 'Error!', description: 'Nama paket wajib diisi.' });
      return;
    }

    if (procedureItems.length === 0 && medicineItems.length === 0) {
      toast({ variant: 'destructive', title: 'Error!', description: 'Tambahkan minimal satu tindakan atau obat.' });
      return;
    }

    await onSubmit({
      code: code.trim() || undefined,
      name: name.trim(),
      description: description.trim(),
      is_active: isActive,
      notes: notes.trim(),
      procedure_items: procedureItems.map((item, index) => ({
        procedure_id: item.procedure_id,
        notes: item.notes,
        sort_order: index + 1,
      })),
      medicine_items: medicineItems.map((item, index) => ({
        medicine_id: item.medicine_id,
        quantity: Math.max(item.quantity || 1, 1),
        unit: item.unit,
        dosage: item.dosage,
        frequency: item.frequency,
        route: item.route,
        duration: item.duration,
        instructions: item.instructions,
        notes: item.notes,
        sort_order: index + 1,
      })),
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title={title}
        description="Susun paket tindakan dan obat dalam satu layar."
        actions={
          <Button variant="ghost" size="icon" onClick={() => window.history.back()} className="h-9 w-9">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        }
      />
      <PageContent>
      <form onSubmit={handleSubmit} className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_360px]">
        <div className="space-y-4">
          <Card className="overflow-hidden border-slate-200/80">
            <CardHeader className="bg-gradient-to-r from-slate-50 to-emerald-50/70">
              <CardTitle className="flex items-center gap-2 text-base">
                <Package className="h-4 w-4" />
                Informasi Paket
              </CardTitle>
              <CardDescription>
                Nama dan identitas paket. Jika kode paket dikosongkan, sistem akan membuatkannya otomatis saat simpan.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Kode Paket</Label>
                  <Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Contoh: PK-UGD-001 atau kosongkan" />
                </div>
                <div className="rounded-lg border bg-muted/30 px-4 py-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium">Status Paket</p>
                    <p className="text-xs text-muted-foreground">Atur apakah paket ini siap dipakai di ruangan.</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={isActive ? 'default' : 'secondary'}>{isActive ? 'Aktif' : 'Nonaktif'}</Badge>
                    <Switch id="package_active" checked={isActive} onCheckedChange={setIsActive} />
                  </div>
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Nama Paket *</Label>
                  <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Contoh: Paket UGD Trauma Ringan" required />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label>Deskripsi</Label>
                  <Textarea value={description} onChange={(event) => setDescription(event.target.value)} rows={3} placeholder="Jelaskan kondisi atau alur penggunaan paket ini." />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-sky-200/70">
            <CardHeader className="bg-sky-50/70">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Stethoscope className="h-4 w-4" />
                    Tindakan Paket
                  </CardTitle>
                  <CardDescription>
                    Pilih tindakan dari master. Kode tindakan langsung tampil otomatis setelah dipilih.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="bg-white">{procedureItems.length} tindakan</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Tambah Tindakan</Label>
                <Combobox
                  options={availableProcedures.map((procedure) => ({
                    value: String(procedure.id),
                    label: `${procedure.code || '-'} - ${procedure.name}`,
                  }))}
                  value={selectedProcedureId}
                  onValueChange={(value) => {
                    setSelectedProcedureId(value);
                    if (value) {
                      addProcedure(value);
                    }
                  }}
                  placeholder={referenceLoading ? 'Memuat tindakan...' : 'Cari dan pilih tindakan...'}
                  searchPlaceholder="Ketik kode atau nama tindakan..."
                  emptyText="Tidak ada tindakan"
                  loading={referenceLoading}
                />
              </div>

              {procedureItems.length === 0 ? (
                <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground space-y-2">
                  <ScanSearch className="mx-auto h-8 w-8 opacity-50" />
                  <p>Belum ada tindakan di paket ini.</p>
                  <p className="text-xs">Gunakan pencarian di atas untuk menambahkan tindakan yang sesuai.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {procedureItems.map((item, index) => (
                    <div key={`${item.procedure_id}-${index}`} className="rounded-xl border bg-background p-4 space-y-3 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">#{index + 1}</Badge>
                            <Badge variant="outline" className="font-mono">{item.procedure?.code || '-'}</Badge>
                            <Badge variant="outline">{PROCEDURE_TYPE_LABELS[item.procedure?.procedure_type || ''] || 'Tindakan'}</Badge>
                          </div>
                          <div>
                            <p className="font-medium text-sm">{item.procedure?.name || `Tindakan #${item.procedure_id}`}</p>
                            {item.procedure?.description ? (
                              <p className="text-xs text-muted-foreground line-clamp-2">{item.procedure.description}</p>
                            ) : null}
                          </div>
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setProcedureItems((prev) => prev.filter((_, currentIndex) => currentIndex !== index))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <Label>Catatan Tindakan</Label>
                        <Input
                          value={item.notes}
                          onChange={(event) => setProcedureItems((prev) => prev.map((currentItem, currentIndex) => currentIndex === index ? { ...currentItem, notes: event.target.value } : currentItem))}
                          placeholder="Contoh: prioritas utama, lakukan sebelum observasi"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-emerald-200/70">
            <CardHeader className="bg-emerald-50/70">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Pill className="h-4 w-4" />
                    Obat Paket
                  </CardTitle>
                  <CardDescription>
                    Pilih obat dari master, lalu sesuaikan jumlah dan instruksinya seperlunya.
                  </CardDescription>
                </div>
                <Badge variant="outline" className="bg-white">{medicineItems.length} obat</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Tambah Obat</Label>
                <Combobox
                  options={availableMedicines.map((medicine) => ({
                    value: String(medicine.id),
                    label: `${medicine.code || '-'} - ${medicine.name}`,
                  }))}
                  value={selectedMedicineId}
                  onValueChange={(value) => {
                    setSelectedMedicineId(value);
                    if (value) {
                      addMedicine(value);
                    }
                  }}
                  placeholder={referenceLoading ? 'Memuat obat...' : 'Cari dan pilih obat...'}
                  searchPlaceholder="Ketik kode atau nama obat..."
                  emptyText="Tidak ada obat"
                  loading={referenceLoading}
                />
              </div>

              {medicineItems.length === 0 ? (
                <div className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground space-y-2">
                  <ScanSearch className="mx-auto h-8 w-8 opacity-50" />
                  <p>Belum ada obat di paket ini.</p>
                  <p className="text-xs">Tambahkan obat untuk melengkapi paket klinis sesuai kebutuhan ruangan.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {medicineItems.map((item, index) => (
                    <div key={`${item.medicine_id}-${index}`} className="rounded-xl border bg-background p-4 space-y-4 shadow-sm">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="secondary">#{index + 1}</Badge>
                            <Badge variant="outline" className="font-mono">{item.medicine?.code || '-'}</Badge>
                            {formatMedicineMeta(item.medicine) ? <Badge variant="outline">{formatMedicineMeta(item.medicine)}</Badge> : null}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{item.medicine?.name || `Obat #${item.medicine_id}`}</p>
                            {item.medicine?.generic_name ? (
                              <p className="text-xs text-muted-foreground">{item.medicine.generic_name}</p>
                            ) : null}
                          </div>
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => setMedicineItems((prev) => prev.filter((_, currentIndex) => currentIndex !== index))}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label>Qty</Label>
                          <Input type="number" min="1" value={item.quantity} onChange={(event) => updateMedicineItem(index, 'quantity', Math.max(Number(event.target.value) || 1, 1))} />
                        </div>
                        <div className="space-y-2">
                          <Label>Satuan</Label>
                          <Input value={item.unit} onChange={(event) => updateMedicineItem(index, 'unit', event.target.value)} placeholder="tablet, vial, botol" />
                        </div>
                        <div className="space-y-2">
                          <Label>Dosis</Label>
                          <Select value={item.dosage} onValueChange={(value) => updateMedicineItem(index, 'dosage', value)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih dosis" />
                            </SelectTrigger>
                            <SelectContent>
                              {buildDosageOptions(item).map((option) => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Frekuensi</Label>
                          <Select value={item.frequency} onValueChange={(value) => updateMedicineItem(index, 'frequency', value)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih frekuensi" />
                            </SelectTrigger>
                            <SelectContent>
                              {FREQUENCY_OPTIONS.map((option) => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Rute</Label>
                          <Select value={item.route} onValueChange={(value) => updateMedicineItem(index, 'route', value)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih rute" />
                            </SelectTrigger>
                            <SelectContent>
                              {ROUTE_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Durasi</Label>
                          <Input value={item.duration} onChange={(event) => updateMedicineItem(index, 'duration', event.target.value)} placeholder="3 hari" />
                        </div>
                        <div className="space-y-2 md:col-span-3">
                          <Label>Instruksi</Label>
                          <Select value={item.instructions} onValueChange={(value) => updateMedicineItem(index, 'instructions', value)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Pilih instruksi" />
                            </SelectTrigger>
                            <SelectContent>
                              {INSTRUCTION_OPTIONS.map((option) => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2 md:col-span-3">
                          <Label>Catatan Obat</Label>
                          <Input value={item.notes} onChange={(event) => updateMedicineItem(index, 'notes', event.target.value)} placeholder="Catatan tambahan untuk obat ini" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Catatan Paket</CardTitle>
              <CardDescription>
                Informasi umum yang akan membantu petugas memahami konteks penggunaan paket.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} placeholder="Contoh: digunakan untuk pasien observasi singkat tanpa rawat inap" />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 xl:sticky xl:top-4 self-start">
          <Card className="overflow-hidden">
            <CardHeader className="bg-gradient-to-br from-emerald-50 via-white to-sky-50">
              <CardTitle className="text-base">Ringkasan Paket</CardTitle>
              <CardDescription>
                Pantau isi paket saat Anda menyusun tindakan dan obat.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Identitas</p>
                <p className="font-medium">{name || 'Nama paket belum diisi'}</p>
                <p className="text-xs text-muted-foreground font-mono">{code || 'Kode akan dibuat otomatis bila dikosongkan'}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Tindakan</p>
                  <p className="text-2xl font-semibold">{procedureItems.length}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Obat</p>
                  <p className="text-2xl font-semibold">{medicineItems.length}</p>
                </div>
                <div className="rounded-lg border p-3 col-span-2">
                  <p className="text-xs text-muted-foreground">Total Qty Obat</p>
                  <p className="text-2xl font-semibold">{totalMedicineQuantity}</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant={isActive ? 'default' : 'secondary'}>{isActive ? 'Paket aktif' : 'Paket nonaktif'}</Badge>
                {procedureItems.length === 0 && medicineItems.length === 0 ? <Badge variant="outline">Belum lengkap</Badge> : null}
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Daftar Tindakan</p>
                  <Badge variant="outline">{procedureItems.length}</Badge>
                </div>
                <ScrollArea className="h-40 rounded-lg border">
                  <div className="p-3 space-y-2">
                    {procedureItems.length > 0 ? procedureItems.map((item, index) => (
                      <div key={`summary-procedure-${item.procedure_id}-${index}`} className="rounded-md border bg-muted/20 px-3 py-2">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary">#{index + 1}</Badge>
                          <Badge variant="outline" className="font-mono">{item.procedure?.code || '-'}</Badge>
                        </div>
                        <p className="text-sm font-medium leading-tight">{item.procedure?.name || `Tindakan #${item.procedure_id}`}</p>
                      </div>
                    )) : <p className="text-sm text-muted-foreground">Belum ada tindakan.</p>}
                  </div>
                </ScrollArea>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Daftar Obat</p>
                  <Badge variant="outline">{medicineItems.length}</Badge>
                </div>
                <ScrollArea className="h-52 rounded-lg border">
                  <div className="p-3 space-y-2">
                    {medicineItems.length > 0 ? medicineItems.map((item, index) => (
                      <div key={`summary-medicine-${item.medicine_id}-${index}`} className="rounded-md border bg-muted/20 px-3 py-2">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="secondary">#{index + 1}</Badge>
                          <Badge variant="outline" className="font-mono">{item.medicine?.code || '-'}</Badge>
                        </div>
                        <p className="text-sm font-medium leading-tight">{item.medicine?.name || `Obat #${item.medicine_id}`}</p>
                        <p className="text-xs text-muted-foreground">Qty {item.quantity} {item.unit || item.medicine?.unit || ''}</p>
                      </div>
                    )) : <p className="text-sm text-muted-foreground">Belum ada obat.</p>}
                  </div>
                </ScrollArea>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4 flex flex-col gap-3">
              <Button type="submit" disabled={saving} className="w-full">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                {submitLabel}
              </Button>
              <Button type="button" variant="outline" onClick={() => navigate('/clinical-packages')} className="w-full">
                Batal
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
      </PageContent>
    </PageShell>
  );
}