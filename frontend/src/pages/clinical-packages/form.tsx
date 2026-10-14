import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageShell, PageHeader, PageContent } from '@/components/layout/page-shell';
import { Combobox } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ClinicalPackage, ClinicalPackageInput } from '@/lib/api/clinical-packages';
import { medicinesApi, type Medicine } from '@/lib/api/medicines';
import { proceduresApi, type Procedure } from '@/lib/api/procedures';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, RefreshCw, Save, Trash2 } from 'lucide-react';

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
  signa: string;
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

const SIGNA_OPTIONS = [
  '3 x 1 Setelah Makan',
  '3 x 1 Sebelum Makan',
  '3 x 1 Bersama Makan',
  '2 x 1 Setelah Makan',
  '2 x 1 Sebelum Makan',
  '2 x 1 Pagi & Malam',
  '1 x 1 Pagi Hari Setelah Makan',
  '1 x 1 Malam Hari Setelah Makan',
  '1 x 1 Sebelum Tidur',
  '4 x 1 Setelah Makan',
  '1 x 1 Tablet Bila Perlu (PRN)',
  '3 x 1 Sendok Takar (5 ml)',
  '2 x 1 Sendok Takar (5 ml)',
  '1 x 1 Sendok Takar (5 ml)',
  '1 x 1 Tetes Pada Mata/Telinga',
  '2 x 1 Tetes Pada Mata/Telinga',
  '3 x 1 Tetes Pada Mata/Telinga',
  'Oleskan Tipis 2x Sehari (Topikal)',
  'Oleskan Tipis 3x Sehari (Topikal)',
  'Bila Perlu / Jika Demam (P.R.N)',
  'Bila Nyeri (P.R.N)',
  'Sebelum Makan',
  'Setelah Makan',
  '1x Sehari',
  '2x Sehari',
  '3x Sehari',
  'Habiskan',
].map((s) => ({ value: s, label: s }));

const generatePackageCode = () => `PKT${Date.now().toString().slice(-6)}`;

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

  const [code, setCode] = useState(() => (initialData?.code ? initialData.code : generatePackageCode()));
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [notes, setNotes] = useState('');

  const [procedureItems, setProcedureItems] = useState<ProcedureFormItem[]>([]);
  const [medicineItems, setMedicineItems] = useState<MedicineFormItem[]>([]);

  const [selectedProcedureId, setSelectedProcedureId] = useState('');
  const [selectedMedicineId, setSelectedMedicineId] = useState('');

  const [allProcedures, setAllProcedures] = useState<Procedure[]>([]);
  const [allMedicines, setAllMedicines] = useState<Medicine[]>([]);
  const [referenceLoading, setReferenceLoading] = useState(true);

  useEffect(() => {
    const loadReferences = async () => {
      try {
        const [proceduresRes, medicinesRes] = await Promise.all([
          proceduresApi.getAll({ is_active: true, limit: 1000 }),
          medicinesApi.getAll({ is_active: true, limit: 1000 }),
        ]);

        const procedures = proceduresRes.data.data || [];
        const medicines = medicinesRes.data.data || [];

        setAllProcedures(procedures);
        setAllMedicines(medicines);
      } catch (error) {
        console.error('Failed to load references:', error);
        toast({ variant: 'destructive', title: 'Error!', description: 'Gagal memuat master tindakan dan obat.' });
      } finally {
        setReferenceLoading(false);
      }
    };

    loadReferences();
  }, [toast]);

  useEffect(() => {
    if (initialData) {
      setCode(initialData.code || '');
      setName(initialData.name || '');
      setDescription(initialData.description || '');
      setIsActive(initialData.is_active ?? true);
      setNotes(initialData.notes || '');

      setProcedureItems(
        (initialData.procedure_items || []).map((item) => ({
          procedure_id: item.procedure_id,
          procedure: item.procedure,
          notes: item.notes || '',
        }))
      );

      setMedicineItems(
        (initialData.medicine_items || []).map((item) => {
          const signaValue =
            item.instructions ||
            item.dosage ||
            (item.frequency ? `${item.frequency} ${item.instructions || ''}`.trim() : '');

          return {
            medicine_id: item.medicine_id,
            medicine: item.medicine,
            quantity: item.quantity || 1,
            unit: item.unit || item.medicine?.unit || '',
            signa: signaValue || '',
            notes: item.notes || '',
          };
        })
      );
    } else {
      setCode(generatePackageCode());
    }
  }, [initialData]);

  const availableProcedures = useMemo(() => {
    const selectedIds = new Set(procedureItems.map((item) => item.procedure_id));
    return allProcedures.filter((item) => !selectedIds.has(item.id));
  }, [allProcedures, procedureItems]);

  const availableMedicines = useMemo(() => {
    const selectedIds = new Set(medicineItems.map((item) => item.medicine_id));
    return allMedicines.filter((item) => !selectedIds.has(item.id));
  }, [allMedicines, medicineItems]);

  const addProcedure = (procedureIdValue: string) => {
    const procedureId = Number(procedureIdValue);
    const procedure = allProcedures.find((item) => item.id === procedureId);
    if (!procedure) return;

    setProcedureItems((prev) => [
      ...prev,
      {
        procedure_id: procedure.id,
        procedure,
        notes: '',
      },
    ]);
    setSelectedProcedureId('');
  };

  const addMedicine = (medicineIdValue: string) => {
    const medicineId = Number(medicineIdValue);
    const medicine = allMedicines.find((item) => item.id === medicineId);
    if (!medicine) return;

    setMedicineItems((prev) => [
      ...prev,
      {
        medicine_id: medicine.id,
        medicine,
        quantity: 1,
        unit: medicine.unit || '',
        signa: '',
        notes: '',
      },
    ]);
    setSelectedMedicineId('');
  };

  const updateMedicineItem = (index: number, field: keyof MedicineFormItem, value: string | number) => {
    setMedicineItems((prev) =>
      prev.map((currentItem, currentIndex) =>
        currentIndex === index ? { ...currentItem, [field]: value } : currentItem
      )
    );
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!name.trim()) {
      toast({ variant: 'destructive', title: 'Error!', description: 'Nama paket tindakan wajib diisi.' });
      return;
    }

    if (procedureItems.length === 0 && medicineItems.length === 0) {
      toast({ variant: 'destructive', title: 'Error!', description: 'Tambahkan minimal satu tindakan atau obat dalam paket.' });
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
        dosage: item.signa,
        frequency: item.signa,
        instructions: item.signa,
        notes: item.notes,
        sort_order: index + 1,
      })),
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title={title}
        description="Susun paket tindakan medis dan obat standar yang siap ditugaskan ke ruangan"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" asChild className="h-9 w-9">
              <Link to="/clinical-packages">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <Button type="submit" form="package-form" disabled={saving} className="h-9">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              {submitLabel}
            </Button>
          </div>
        }
      />
      <PageContent>
        {/* Kontainer Utama Bersih (Single Border Layout Standar SIMRS) */}
        <div className="border border-border/70 bg-background">
          <div className="border-b border-border/70 bg-muted/30 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center justify-between">
            <span>DATA PAKET TINDAKAN</span>
            <div className="flex items-center gap-3">
              <span className="text-[10px] tracking-normal text-muted-foreground uppercase">Status:</span>
              <Badge variant={isActive ? 'default' : 'secondary'} className="text-[10px] h-5 px-2">
                {isActive ? 'Aktif' : 'Nonaktif'}
              </Badge>
              <Switch id="package_active" checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          <div className="p-4 sm:p-6">
            <form id="package-form" onSubmit={handleSubmit} className="space-y-6 [&_input]:h-9 [&_[role=combobox]]:h-9">
              {/* Bagian 1: Informasi Dasar */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Informasi Dasar</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="code">Kode Paket Tindakan *</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="code"
                        value={code}
                        onChange={(event) => setCode(event.target.value)}
                        placeholder="Contoh: PKT123456"
                        required
                        className="flex-1"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setCode(generatePackageCode())}
                        title="Generate Kode Otomatis"
                        className="shrink-0"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Nama Paket Tindakan *</Label>
                    <Input
                      id="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Contoh: Paket UGD Trauma Ringan"
                      required
                    />
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="description">Deskripsi</Label>
                    <Textarea
                      id="description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      rows={2}
                      placeholder="Jelaskan kondisi atau alur penggunaan paket tindakan ini..."
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Bagian 2: Daftar Tindakan */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-medium">Daftar Tindakan Medis ({procedureItems.length})</h3>
                    <p className="text-xs text-muted-foreground">Tindakan dari master yang otomatis ditambahkan ketika paket dipilih</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Pilih & Tambah Tindakan</Label>
                  <Combobox
                    options={availableProcedures.map((procedure) => ({
                      value: String(procedure.id),
                      label: procedure.name,
                    }))}
                    value={selectedProcedureId}
                    onValueChange={(value) => {
                      setSelectedProcedureId(value);
                      if (value) addProcedure(value);
                    }}
                    placeholder={referenceLoading ? 'Memuat master tindakan...' : 'Ketik atau pilih tindakan medis...'}
                    searchPlaceholder="Ketik nama tindakan..."
                    emptyText="Tidak ada tindakan tersedia"
                    loading={referenceLoading}
                  />
                </div>

                <div className="rounded-md border border-border/70 overflow-hidden">
                  <Table containerClassName="border-0 border-x-0 border-r-0 border-l-0 rounded-none">
                    <TableHeader className="bg-muted/30">
                      <TableRow className="hover:bg-muted/30 text-[11px] uppercase tracking-wider">
                        <TableHead className="w-12 text-center">No</TableHead>
                        <TableHead>Nama Tindakan</TableHead>
                        <TableHead className="w-32">Jenis</TableHead>
                        <TableHead className="min-w-[220px]">Catatan Tindakan</TableHead>
                        <TableHead className="w-14 text-center">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {procedureItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-6 text-sm text-muted-foreground">
                            Belum ada tindakan di paket ini. Pilih tindakan dari pencarian di atas.
                          </TableCell>
                        </TableRow>
                      ) : (
                        procedureItems.map((item, index) => (
                          <TableRow key={`${item.procedure_id}-${index}`}>
                            <TableCell className="text-center font-mono text-xs">{index + 1}</TableCell>
                            <TableCell>
                              <p className="font-medium text-sm">{item.procedure?.name || `Tindakan #${item.procedure_id}`}</p>
                              {item.procedure?.description && (
                                <p className="text-xs text-muted-foreground line-clamp-1">{item.procedure.description}</p>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[10px]">
                                {PROCEDURE_TYPE_LABELS[item.procedure?.procedure_type || ''] || 'Tindakan'}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Input
                                value={item.notes}
                                onChange={(event) =>
                                  setProcedureItems((prev) =>
                                    prev.map((currentItem, currentIndex) =>
                                      currentIndex === index ? { ...currentItem, notes: event.target.value } : currentItem
                                    )
                                  )
                                }
                                placeholder="Catatan/instruksi khusus tindakan..."
                                className="h-8 text-xs"
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setProcedureItems((prev) => prev.filter((_, currentIndex) => currentIndex !== index))}
                                title="Hapus tindakan"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <Separator />

              {/* Bagian 3: Daftar Obat & BHP */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-medium">Daftar Obat & BHP ({medicineItems.length})</h3>
                    <p className="text-xs text-muted-foreground">Obat standar yang otomatis dibuatkan order resep ke farmasi saat paket dipilih</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Pilih & Tambah Obat / BHP</Label>
                  <Combobox
                    options={availableMedicines.map((medicine) => ({
                      value: String(medicine.id),
                      label: medicine.name,
                    }))}
                    value={selectedMedicineId}
                    onValueChange={(value) => {
                      setSelectedMedicineId(value);
                      if (value) addMedicine(value);
                    }}
                    placeholder={referenceLoading ? 'Memuat master obat...' : 'Ketik atau pilih obat / BHP...'}
                    searchPlaceholder="Ketik nama obat..."
                    emptyText="Tidak ada obat tersedia"
                    loading={referenceLoading}
                  />
                </div>

                <div className="rounded-md border border-border/70 overflow-x-auto">
                  <Table containerClassName="border-0 border-x-0 border-r-0 border-l-0 rounded-none">
                    <TableHeader className="bg-muted/30">
                      <TableRow className="hover:bg-muted/30 text-[11px] uppercase tracking-wider">
                        <TableHead className="w-12 text-center">No</TableHead>
                        <TableHead className="min-w-[200px]">Nama Obat</TableHead>
                        <TableHead className="w-24">Jumlah</TableHead>
                        <TableHead className="w-28">Satuan</TableHead>
                        <TableHead className="min-w-[240px]">Signa (Aturan Pakai)</TableHead>
                        <TableHead className="min-w-[180px]">Catatan</TableHead>
                        <TableHead className="w-14 text-center">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {medicineItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-6 text-sm text-muted-foreground">
                            Belum ada obat di paket ini. (Opsional) Pilih obat dari pencarian di atas jika paket menyertakan resep/obat.
                          </TableCell>
                        </TableRow>
                      ) : (
                        medicineItems.map((item, index) => (
                          <TableRow key={`${item.medicine_id}-${index}`}>
                            <TableCell className="text-center font-mono text-xs">{index + 1}</TableCell>
                            <TableCell>
                              <p className="font-medium text-sm">{item.medicine?.name || `Obat #${item.medicine_id}`}</p>
                              {item.medicine?.dosage && (
                                <p className="text-xs text-muted-foreground">{item.medicine.dosage}</p>
                              )}
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(event) =>
                                  updateMedicineItem(index, 'quantity', Math.max(Number(event.target.value) || 1, 1))
                                }
                                className="h-8 text-xs w-20"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={item.unit}
                                onChange={(event) => updateMedicineItem(index, 'unit', event.target.value)}
                                placeholder="tablet/vial"
                                className="h-8 text-xs w-24"
                              />
                            </TableCell>
                            <TableCell className="min-w-[240px]">
                              <Combobox
                                allowCustomValue
                                options={SIGNA_OPTIONS}
                                value={item.signa}
                                onValueChange={(value) => updateMedicineItem(index, 'signa', value)}
                                placeholder="Pilih atau ketik signa"
                                searchPlaceholder="Cari atau ketik signa..."
                                emptyText="Tekan enter untuk menggunakan signa ini"
                                className="h-8 text-xs w-full"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                value={item.notes}
                                onChange={(event) => updateMedicineItem(index, 'notes', event.target.value)}
                                placeholder="Catatan tambahan..."
                                className="h-8 text-xs"
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => setMedicineItems((prev) => prev.filter((_, currentIndex) => currentIndex !== index))}
                                title="Hapus obat"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <Separator />

              {/* Bagian 4: Catatan Tambahan */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Catatan Tambahan</h3>
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={2}
                  placeholder="Catatan atau petunjuk operasional paket tindakan ini..."
                  className="text-sm"
                />
              </div>

              {/* Action Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border/70">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => navigate('/clinical-packages')}
                  className="h-9"
                >
                  Batal
                </Button>
                <Button type="submit" disabled={saving} className="h-9">
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  {submitLabel}
                </Button>
              </div>
            </form>
          </div>
        </div>
      </PageContent>
    </PageShell>
  );
}