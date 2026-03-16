import { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { setPageTitle } from "@/lib/page-title";
import { proceduresApi, TARIFF_COMPONENTS, tariffsToRequest, PROCEDURE_TYPES, normalizeProcedureType } from "@/lib/api/procedures";
import { masterDataApi, type MasterData } from "@/lib/api/master-data";
import type { CreateProcedureRequest, Procedure, PatientClass, TariffRequest, ProcedureType } from "@/lib/api/procedures";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Loader2 } from "lucide-react";

interface MasterDataState {
  procedure_service_type: MasterData[];
  procedure_group: MasterData[];
  procedure_specialty: MasterData[];
  patient_class: MasterData[];
  anesthesia_type: MasterData[];
}

export default function ProcedureEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [masterDataLoading, setMasterDataLoading] = useState(true);
  const [masterData, setMasterData] = useState<MasterDataState>({
    procedure_service_type: [],
    procedure_group: [],
    procedure_specialty: [],
    patient_class: [],
    anesthesia_type: [],
  });
  const [procedure, setProcedure] = useState<Procedure | null>(null);
  const [formData, setFormData] = useState<CreateProcedureRequest>({
    code: "",
    name: "",
    description: "",
    procedure_type: "medical",
    inacbg_code: "",
    inacbg_name: "",
    procedure_group: "",
    specialty: "",
    body_system: "",
    icd9cm_code: "",
    icd10pcs_code: "",
    duration: 0,
    requires_anesthesia: false,
    anesthesia_type: "",
    is_emergency: false,
    is_surgical: false,
    service_type: "all",
    is_active: true,
    tariffs: [],
  });

  useEffect(() => {
    setPageTitle(procedure ? `Edit ${procedure.name}` : "Edit Tindakan");
  }, [procedure]);

  useEffect(() => {
    fetchMasterData();
    loadProcedure();
  }, [id]);

  const fetchMasterData = async () => {
    try {
      setMasterDataLoading(true);
      const response = await masterDataApi.getMultiple([
        'procedure_service_type',
        'procedure_group',
        'procedure_specialty',
        'patient_class',
        'anesthesia_type',
      ]);
      setMasterData(response.data.data as unknown as MasterDataState);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data master.",
      });
    } finally {
      setMasterDataLoading(false);
    }
  };

  // Convert master data to combobox options
  const serviceTypeOptions: ComboboxOption[] = (masterData.procedure_service_type || []).map(item => ({
    value: item.code,
    label: item.name,
  }));

  const procedureGroupOptions: ComboboxOption[] = (masterData.procedure_group || []).map(item => ({
    value: item.code,
    label: item.name,
  }));

  const specialtyOptions: ComboboxOption[] = (masterData.procedure_specialty || []).map(item => ({
    value: item.code,
    label: item.name,
  }));

  const anesthesiaTypeOptions: ComboboxOption[] = (masterData.anesthesia_type || []).map(item => ({
    value: item.code,
    label: item.name,
  }));

  // Procedure type options (static)
  const procedureTypeOptions: ComboboxOption[] = PROCEDURE_TYPES.map(item => ({
    value: item.code,
    label: item.label,
  }));

  const loadProcedure = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      const res = await proceduresApi.getById(Number(id));
      const data = res.data.data;
      setProcedure(data);

      // Convert existing tariffs
      const existingTariffs = data.tariffs ? tariffsToRequest(data.tariffs) : [];

      setFormData({
        code: data.code,
        name: data.name,
        description: data.description || "",
        procedure_type: normalizeProcedureType(data.procedure_type) || "medical",
        inacbg_code: data.inacbg_code || "",
        inacbg_name: data.inacbg_name || "",
        procedure_group: data.procedure_group || "",
        specialty: data.specialty || "",
        body_system: data.body_system || "",
        icd9cm_code: data.icd9cm_code || "",
        icd10pcs_code: data.icd10pcs_code || "",
        duration: data.duration || 0,
        requires_anesthesia: data.requires_anesthesia || false,
        anesthesia_type: data.anesthesia_type || "",
        is_emergency: data.is_emergency || false,
        is_surgical: data.is_surgical || false,
        service_type: data.service_type || "all",
        is_active: data.is_active ?? true,
        tariffs: existingTariffs,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal memuat data tindakan.",
      });
      navigate("/procedures");
    } finally {
      setLoading(false);
    }
  };

  // Merge tariffs with master data patient classes when master data is loaded
  useEffect(() => {
    if (masterData.patient_class.length > 0 && formData.tariffs) {
      const mergedTariffs: TariffRequest[] = masterData.patient_class.map((pc) => {
        const existing = formData.tariffs?.find((t) => t.patient_class === pc.code);
        if (existing) return existing;
        return {
          patient_class: pc.code as PatientClass,
          administrasi: 0,
          sarana: 0,
          bhp: 0,
          dokter_operator: 0,
          dokter_anastesi: 0,
          dokter_lainnya: 0,
          penata_anastesi: 0,
          paramedis: 0,
          non_medis: 0,
        };
      });
      
      // Only update if tariffs are different (to avoid infinite loop)
      if (JSON.stringify(mergedTariffs) !== JSON.stringify(formData.tariffs)) {
        setFormData(prev => ({ ...prev, tariffs: mergedTariffs }));
      }
    }
  }, [masterData.patient_class, procedure]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    setSaving(true);
    try {
      await proceduresApi.update(Number(id), formData);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Tindakan berhasil diperbarui.",
      });
      navigate("/procedures");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal memperbarui tindakan.",
      });
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof CreateProcedureRequest, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const updateTariff = (patientClass: PatientClass, component: string, value: number) => {
    setFormData((prev) => ({
      ...prev,
      tariffs: prev.tariffs?.map((t) =>
        t.patient_class === patientClass
          ? { ...t, [component]: value }
          : t
      ),
    }));
  };

  const getTariffValue = (patientClass: PatientClass, component: string): number => {
    const tariff = formData.tariffs?.find((t) => t.patient_class === patientClass);
    return tariff ? (tariff as any)[component] || 0 : 0;
  };

  const calculateRowTotal = (patientClass: PatientClass): number => {
    const tariff = formData.tariffs?.find((t) => t.patient_class === patientClass);
    if (!tariff) return 0;
    return TARIFF_COMPONENTS.reduce((sum, comp) => sum + ((tariff as any)[comp.key] || 0), 0);
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('id-ID').format(value);
  };

  if (loading) {
    return (
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-48" />
          </div>
        </div>
        <div className="rounded-lg border p-6 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col p-4">
      <div className="flex items-center gap-4">
        <Button variant="outline" size="icon" asChild className="h-9 w-9">
          <Link to="/procedures">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-lg font-semibold">Edit Tindakan</h1>
          <p className="text-sm text-muted-foreground">Edit data tindakan {procedure?.name}</p>
        </div>
      </div>
      <div className="rounded-lg border p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Informasi Dasar</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="code">Kode Tindakan *</Label>
                  <Input
                    id="code"
                    value={formData.code}
                    onChange={(e) => updateField("code", e.target.value)}
                    placeholder="Contoh: TDK001"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nama Tindakan *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="Contoh: Konsultasi Dokter Umum"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Deskripsi</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="Deskripsi tindakan..."
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="procedure_type">Jenis Tindakan *</Label>
                  <Combobox
                    options={procedureTypeOptions}
                    value={formData.procedure_type}
                    onValueChange={(v) => updateField("procedure_type", v as ProcedureType)}
                    placeholder="Pilih jenis tindakan"
                    searchPlaceholder="Cari jenis tindakan..."
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="service_type">Jenis Layanan</Label>
                  <Combobox
                    options={serviceTypeOptions}
                    value={formData.service_type}
                    onValueChange={(v) => updateField("service_type", v)}
                    placeholder="Pilih jenis layanan"
                    searchPlaceholder="Cari jenis layanan..."
                    loading={masterDataLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="procedure_group">Kelompok Tindakan</Label>
                  <Combobox
                    options={procedureGroupOptions}
                    value={formData.procedure_group}
                    onValueChange={(v) => updateField("procedure_group", v)}
                    placeholder="Pilih kelompok"
                    searchPlaceholder="Cari kelompok tindakan..."
                    loading={masterDataLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specialty">Spesialisasi</Label>
                  <Combobox
                    options={specialtyOptions}
                    value={formData.specialty}
                    onValueChange={(v) => updateField("specialty", v)}
                    placeholder="Pilih spesialisasi"
                    searchPlaceholder="Cari spesialisasi..."
                    loading={masterDataLoading}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Classification INA-CBG */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Klasifikasi INA-CBG</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="inacbg_code">Kode INA-CBG</Label>
                  <Input
                    id="inacbg_code"
                    value={formData.inacbg_code}
                    onChange={(e) => updateField("inacbg_code", e.target.value)}
                    placeholder="Contoh: I-1-10-I"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inacbg_name">Nama INA-CBG</Label>
                  <Input
                    id="inacbg_name"
                    value={formData.inacbg_name}
                    onChange={(e) => updateField("inacbg_name", e.target.value)}
                    placeholder="Nama grup INA-CBG"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="icd9cm_code">Kode ICD-9-CM</Label>
                  <Input
                    id="icd9cm_code"
                    value={formData.icd9cm_code}
                    onChange={(e) => updateField("icd9cm_code", e.target.value)}
                    placeholder="Contoh: 89.03"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="icd10pcs_code">Kode ICD-10-PCS</Label>
                  <Input
                    id="icd10pcs_code"
                    value={formData.icd10pcs_code}
                    onChange={(e) => updateField("icd10pcs_code", e.target.value)}
                    placeholder="Kode ICD-10-PCS"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Tarif Per Kelas Pasien */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Tarif Per Kelas Pasien</h3>
              {masterDataLoading ? (
                <div className="text-center py-4 text-muted-foreground">Memuat data kelas pasien...</div>
              ) : masterData.patient_class.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">Tidak ada data kelas pasien</div>
              ) : (
                <div className="border rounded-lg overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-semibold min-w-[120px] sticky left-0 bg-muted/50">Kelas Pasien</TableHead>
                        {TARIFF_COMPONENTS.map((comp) => (
                          <TableHead key={comp.key} className="text-center min-w-[120px]">
                            {comp.label}
                          </TableHead>
                        ))}
                        <TableHead className="text-center min-w-[130px] font-semibold bg-muted/50">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {masterData.patient_class.map((pc) => (
                        <TableRow key={pc.code}>
                          <TableCell className="font-medium sticky left-0 bg-background">
                            {pc.name}
                          </TableCell>
                          {TARIFF_COMPONENTS.map((comp) => (
                            <TableCell key={comp.key} className="p-1">
                              <Input
                                type="number"
                                className="h-8 text-right text-sm"
                                value={getTariffValue(pc.code as PatientClass, comp.key) || ""}
                                onChange={(e) =>
                                  updateTariff(pc.code as PatientClass, comp.key, Number(e.target.value) || 0)
                                }
                                placeholder="0"
                              />
                            </TableCell>
                          ))}
                          <TableCell className="text-right font-semibold bg-muted/30">
                            {formatCurrency(calculateRowTotal(pc.code as PatientClass))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <Separator />

            {/* Detail Tindakan */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium">Detail Tindakan</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="duration">Durasi (menit)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={formData.duration}
                    onChange={(e) => updateField("duration", Number(e.target.value))}
                    placeholder="0"
                  />
                </div>
                <div className="flex items-center space-x-2 pt-8">
                  <Switch
                    id="is_surgical"
                    checked={formData.is_surgical}
                    onCheckedChange={(v) => updateField("is_surgical", v)}
                  />
                  <Label htmlFor="is_surgical">Tindakan Bedah</Label>
                </div>
                <div className="flex items-center space-x-2 pt-8">
                  <Switch
                    id="is_emergency"
                    checked={formData.is_emergency}
                    onCheckedChange={(v) => updateField("is_emergency", v)}
                  />
                  <Label htmlFor="is_emergency">Tindakan Darurat</Label>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="requires_anesthesia"
                    checked={formData.requires_anesthesia}
                    onCheckedChange={(v) => updateField("requires_anesthesia", v)}
                  />
                  <Label htmlFor="requires_anesthesia">Perlu Anestesi</Label>
                </div>
                {formData.requires_anesthesia && (
                  <div className="space-y-2">
                    <Label htmlFor="anesthesia_type">Jenis Anestesi</Label>
                    <Combobox
                      options={anesthesiaTypeOptions}
                      value={formData.anesthesia_type}
                      onValueChange={(v) => updateField("anesthesia_type", v)}
                      placeholder="Pilih jenis anestesi"
                      searchPlaceholder="Cari jenis anestesi..."
                      loading={masterDataLoading}
                    />
                  </div>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(v) => updateField("is_active", v)}
                />
                <Label htmlFor="is_active">Aktif</Label>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end gap-4 pt-4">
              <Button variant="outline" type="button" asChild>
                <Link to="/procedures">Batal</Link>
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Menyimpan...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Simpan
                  </>
                )}
              </Button>
            </div>
          </form>
      </div>
    </div>
  );
}
