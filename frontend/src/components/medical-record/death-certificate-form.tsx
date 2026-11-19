/**
 * Death Certificate Form Component
 * Form untuk membuat dan mencetak Surat Kematian
 * 
 * Death Types:
 * - DOA (Dead on Arrival): Pasien meninggal sebelum sampai di RS / saat tiba di IGD
 * - DOD (Death on Departure): Pasien meninggal di IGD
 * - Inpatient Death: Pasien meninggal saat rawat inap
 */

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Save,
  Loader2,
  FileText,
  Calendar,
  Printer,
  Trash2,
  Clock,
  Plus,
  Edit,
  User,
  MapPin,
  Stethoscope,
  AlertTriangle,
} from "lucide-react";
import { medicalRecordsApi, printApi } from "@/lib/api";
import { icd10Api, type ICD10 } from "@/lib/api/icd";
import type { DeathCertificate } from "@/lib/api/medical-records";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface DeathCertificateFormProps {
  visitId: number;
  deathType?: string; // doa, dod, meninggal (inpatient_death)
  onSave?: (data: DeathCertificate) => void;
  onCountChange?: (count: number) => void;
  readOnly?: boolean;
}

// Death type options
const deathTypeOptions = [
  { value: "doa", label: "DOA (Dead on Arrival)", description: "Meninggal sebelum/saat tiba di RS" },
  { value: "dod", label: "DOD (Death on Departure)", description: "Meninggal di IGD" },
  { value: "inpatient_death", label: "Meninggal saat Rawat Inap", description: "Meninggal selama perawatan" },
];

// Manner of death options
const mannerOfDeathOptions = [
  { value: "natural", label: "Alamiah" },
  { value: "accident", label: "Kecelakaan" },
  { value: "suicide", label: "Bunuh Diri" },
  { value: "homicide", label: "Pembunuhan" },
  { value: "undetermined", label: "Tidak Dapat Ditentukan" },
  { value: "pending", label: "Menunggu Investigasi" },
];

const defaultFormData = {
  death_type: "",
  death_datetime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  death_location: "",
  primary_cause_code: "",
  primary_cause_name: "",
  secondary_cause_code: "",
  secondary_cause_name: "",
  underlying_cause_code: "",
  underlying_cause_name: "",
  manner_of_death: "natural",
  duration_of_illness: "",
  autopsy_performed: false,
  autopsy_findings: "",
  declaring_doctor_id: undefined as number | undefined,
  declaring_doctor_name: "",
  witness_name: "",
  witness_relation: "",
  notes: "",
};

export function DeathCertificateForm({ visitId, deathType, onSave, onCountChange, readOnly = false }: DeathCertificateFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  
  // Form state for new/edit
  const [formData, setFormData] = useState({
    ...defaultFormData,
    death_type: deathType === "meninggal" ? "inpatient_death" : (deathType || ""),
  });
  const [editingId, setEditingId] = useState<number | null>(null);
  
  // List of saved death certificates
  const [certificates, setCertificates] = useState<DeathCertificate[]>([]);
  
  // Delete confirmation
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // Active tab
  const [activeTab, setActiveTab] = useState<"form" | "history">("form");

  // ICD-10 search for causes
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchField, setSearchField] = useState<"primary" | "secondary" | "underlying">("primary");
  const [searchValue, setSearchValue] = useState("");
  const debouncedSearch = useDebounce(searchValue, 300);
  const [icdResults, setIcdResults] = useState<ICD10[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  // Load existing certificates on mount
  useEffect(() => {
    loadCertificates();
  }, [visitId]);

  // Search ICD-10
  useEffect(() => {
    if (debouncedSearch.length >= 2) {
      searchICD10(debouncedSearch);
    } else {
      setIcdResults([]);
    }
  }, [debouncedSearch]);

  const loadCertificates = async () => {
    try {
      setLoading(true);
      const response = await medicalRecordsApi.getDeathCertificates(visitId);
      const data = response.data || [];
      setCertificates(data);
      onCountChange?.(data.length);
    } catch (error) {
      console.error("Error loading death certificates:", error);
      setCertificates([]);
    } finally {
      setLoading(false);
    }
  };

  const searchICD10 = async (query: string) => {
    setSearchLoading(true);
    try {
      const results = await icd10Api.search({ search: query, limit: 10 });
      setIcdResults(results || []);
    } catch (error) {
      console.error("Error searching ICD-10:", error);
      setIcdResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectICD = (icd: ICD10) => {
    if (searchField === "primary") {
      setFormData(prev => ({
        ...prev,
        primary_cause_code: icd.code,
        primary_cause_name: icd.display || "",
      }));
    } else if (searchField === "secondary") {
      setFormData(prev => ({
        ...prev,
        secondary_cause_code: icd.code,
        secondary_cause_name: icd.display || "",
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        underlying_cause_code: icd.code,
        underlying_cause_name: icd.display || "",
      }));
    }
    setSearchOpen(false);
    setSearchValue("");
    setIcdResults([]);
  };

  // Save certificate
  const handleSave = async () => {
    // Validation
    if (!formData.death_type) {
      toast({
        variant: "destructive",
        title: "Data tidak lengkap",
        description: "Jenis kematian wajib dipilih",
      });
      return;
    }
    if (!formData.death_datetime) {
      toast({
        variant: "destructive",
        title: "Data tidak lengkap",
        description: "Waktu kematian wajib diisi",
      });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        id: editingId || undefined,
        visit_id: visitId,
        death_type: formData.death_type,
        death_datetime: new Date(formData.death_datetime).toISOString(),
        death_location: formData.death_location,
        primary_cause_code: formData.primary_cause_code,
        primary_cause_name: formData.primary_cause_name,
        secondary_cause_code: formData.secondary_cause_code,
        secondary_cause_name: formData.secondary_cause_name,
        underlying_cause_code: formData.underlying_cause_code,
        underlying_cause_name: formData.underlying_cause_name,
        manner_of_death: formData.manner_of_death,
        duration_of_illness: formData.duration_of_illness,
        autopsy_performed: formData.autopsy_performed,
        autopsy_findings: formData.autopsy_findings,
        declaring_doctor_id: formData.declaring_doctor_id,
        declaring_doctor_name: formData.declaring_doctor_name,
        witness_name: formData.witness_name,
        witness_relation: formData.witness_relation,
        notes: formData.notes,
      };

      const response = await medicalRecordsApi.saveDeathCertificate(visitId, payload);
      
      toast({
        title: "Berhasil",
        description: editingId ? "Surat kematian berhasil diperbarui" : "Surat kematian berhasil disimpan",
      });

      // Reload list
      await loadCertificates();
      
      // Reset form
      setFormData({
        ...defaultFormData,
        death_type: deathType === "meninggal" ? "inpatient_death" : (deathType || ""),
      });
      setEditingId(null);
      
      // Switch to history tab
      setActiveTab("history");
      
      // Trigger print refresh
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
      
      if (onSave) {
        onSave(response.data);
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal menyimpan",
        description: error.response?.data?.error || "Terjadi kesalahan saat menyimpan surat kematian",
      });
    } finally {
      setSaving(false);
    }
  };

  // Edit certificate
  const handleEdit = (cert: DeathCertificate) => {
    setFormData({
      death_type: cert.death_type || "",
      death_datetime: cert.death_datetime ? format(new Date(cert.death_datetime), "yyyy-MM-dd'T'HH:mm") : "",
      death_location: cert.death_location || "",
      primary_cause_code: cert.primary_cause_code || "",
      primary_cause_name: cert.primary_cause_name || "",
      secondary_cause_code: cert.secondary_cause_code || "",
      secondary_cause_name: cert.secondary_cause_name || "",
      underlying_cause_code: cert.underlying_cause_code || "",
      underlying_cause_name: cert.underlying_cause_name || "",
      manner_of_death: cert.manner_of_death || "natural",
      duration_of_illness: cert.duration_of_illness || "",
      autopsy_performed: cert.autopsy_performed || false,
      autopsy_findings: cert.autopsy_findings || "",
      declaring_doctor_id: cert.declaring_doctor_id,
      declaring_doctor_name: cert.declaring_doctor_name || "",
      witness_name: cert.witness_name || "",
      witness_relation: cert.witness_relation || "",
      notes: cert.notes || "",
    });
    setEditingId(cert.id);
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setFormData({
      ...defaultFormData,
      death_type: deathType === "meninggal" ? "inpatient_death" : (deathType || ""),
    });
    setEditingId(null);
  };

  // Delete certificate
  const handleDelete = async () => {
    if (!deletingId) return;
    
    try {
      await medicalRecordsApi.deleteDeathCertificate(visitId, deletingId);
      
      toast({
        title: "Berhasil",
        description: "Surat kematian berhasil dihapus",
      });

      await loadCertificates();
      
      if (editingId === deletingId) {
        setFormData({
          ...defaultFormData,
          death_type: deathType === "meninggal" ? "inpatient_death" : (deathType || ""),
        });
        setEditingId(null);
      }
      
      window.dispatchEvent(new CustomEvent("refresh-print-options"));
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal menghapus",
        description: error.response?.data?.error || "Terjadi kesalahan saat menghapus surat kematian",
      });
    } finally {
      setDeleteDialogOpen(false);
      setDeletingId(null);
    }
  };

  // Print certificate
  const handlePrint = async (certId: number) => {
    setPrinting(true);
    try {
      await printApi.deathCertificate(visitId, certId);
      toast({
        title: "Berhasil",
        description: "Surat kematian berhasil dicetak",
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal mencetak",
        description: error.response?.data?.error || "Terjadi kesalahan saat mencetak surat kematian",
      });
    } finally {
      setPrinting(false);
    }
  };

  // Format date for display
  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return "-";
    try {
      return format(new Date(dateStr), "dd MMMM yyyy, HH:mm", { locale: localeId });
    } catch {
      return dateStr;
    }
  };

  // Get death type label
  const getDeathTypeLabel = (type: string) => {
    const option = deathTypeOptions.find(o => o.value === type);
    return option?.label || type;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 min-h-[220px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      {/* Inline Sub-Tabs */}
      <div className="border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/30 px-4 sm:px-5">
        <div className="flex gap-6">
          <button
            type="button"
            onClick={() => setActiveTab("form")}
            className={cn(
              "py-2.5 text-xs font-bold uppercase tracking-wider transition-colors relative flex items-center gap-2",
              activeTab === "form"
                ? "text-neutral-900 dark:text-neutral-100"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Plus className="h-3.5 w-3.5" />
            {editingId ? "Edit Surat" : "Buat Surat"}
            {activeTab === "form" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900 dark:bg-white" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={cn(
              "py-2.5 text-xs font-bold uppercase tracking-wider transition-colors relative flex items-center gap-2",
              activeTab === "history"
                ? "text-neutral-900 dark:text-neutral-100"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Clock className="h-3.5 w-3.5" />
            Riwayat Surat
            {certificates.length > 0 && (
              <Badge variant="secondary" className="rounded-none text-[10px] h-4 px-1.5 font-mono">
                {certificates.length}
              </Badge>
            )}
            {activeTab === "history" && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neutral-900 dark:bg-white" />
            )}
          </button>
        </div>
      </div>

      {/* Form Tab */}
      {activeTab === "form" && (
        <fieldset
          disabled={readOnly}
          className="divide-y divide-neutral-200 dark:divide-neutral-800 border-b border-neutral-200 dark:border-neutral-800"
        >
          {/* Klasifikasi & Waktu */}
          <div className="p-4 sm:p-5 space-y-4">
            <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
              Klasifikasi & Waktu Kematian
            </div>

            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground">
                Jenis Kematian <span className="text-destructive">*</span>
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {deathTypeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, death_type: option.value }))}
                    disabled={readOnly}
                    className={cn(
                      "p-3 rounded-none border text-left transition-all",
                      formData.death_type === option.value
                        ? "border-neutral-900 dark:border-neutral-100 bg-neutral-900/[0.04] dark:bg-white/[0.06] ring-1 ring-neutral-900 dark:ring-neutral-100"
                        : "border-neutral-200 dark:border-neutral-800 hover:border-neutral-400 dark:hover:border-neutral-600 hover:bg-neutral-50 dark:hover:bg-neutral-900/40"
                    )}
                  >
                    <div className="font-semibold text-xs text-foreground">{option.label}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">{option.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="death_datetime" className="text-[11px] font-medium text-muted-foreground">
                  <Calendar className="h-3 w-3 inline mr-1" />
                  Waktu Kematian <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="death_datetime"
                  type="datetime-local"
                  value={formData.death_datetime}
                  onChange={(e) => setFormData((prev) => ({ ...prev, death_datetime: e.target.value }))}
                  disabled={readOnly}
                  className="h-9 rounded-none text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="death_location" className="text-[11px] font-medium text-muted-foreground">
                  <MapPin className="h-3 w-3 inline mr-1" />
                  Lokasi Kematian
                </Label>
                <Input
                  id="death_location"
                  placeholder="cth: Ruang ICU, IGD, Ruang Rawat Inap"
                  value={formData.death_location}
                  onChange={(e) => setFormData((prev) => ({ ...prev, death_location: e.target.value }))}
                  disabled={readOnly}
                  className="h-9 rounded-none text-xs"
                />
              </div>
            </div>
          </div>

          {/* Penyebab Kematian */}
          <div className="p-4 sm:p-5 space-y-4">
            <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
              Penyebab Kematian (ICD-10)
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  <AlertTriangle className="h-3 w-3 inline mr-1" />
                  Penyebab Kematian Utama (ICD-10)
                </Label>
                <Popover
                  open={searchOpen && searchField === "primary"}
                  onOpenChange={(open) => {
                    setSearchOpen(open);
                    if (open) setSearchField("primary");
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-9 rounded-none text-xs justify-start text-left font-normal"
                    >
                      {formData.primary_cause_code ? (
                        <span className="truncate flex items-center gap-2">
                          <Badge variant="secondary" className="rounded-none font-mono text-[10px] h-4 px-1.5">
                            {formData.primary_cause_code}
                          </Badge>
                          <span className="truncate">{formData.primary_cause_name}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Cari diagnosis ICD-10...</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[460px] max-w-[90vw] p-0 rounded-none" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Ketik nama penyakit atau kode ICD-10..."
                        value={searchValue}
                        onValueChange={setSearchValue}
                      />
                      <CommandList>
                        {searchLoading ? (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        ) : icdResults.length === 0 ? (
                          <CommandEmpty>
                            {searchValue.length < 2 ? "Ketik minimal 2 karakter..." : "Tidak ada hasil"}
                          </CommandEmpty>
                        ) : (
                          <CommandGroup>
                            {icdResults.map((icd) => (
                              <CommandItem
                                key={icd.code}
                                value={icd.code}
                                onSelect={() => handleSelectICD(icd)}
                                className="cursor-pointer rounded-none text-xs"
                              >
                                <Badge variant="outline" className="mr-2 rounded-none font-mono text-[10px]">
                                  {icd.code}
                                </Badge>
                                <span className="truncate">{icd.display}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-muted-foreground">
                  Penyebab Sekunder (ICD-10)
                </Label>
                <Popover
                  open={searchOpen && searchField === "secondary"}
                  onOpenChange={(open) => {
                    setSearchOpen(open);
                    if (open) setSearchField("secondary");
                  }}
                >
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-9 rounded-none text-xs justify-start text-left font-normal"
                    >
                      {formData.secondary_cause_code ? (
                        <span className="truncate flex items-center gap-2">
                          <Badge variant="secondary" className="rounded-none font-mono text-[10px] h-4 px-1.5">
                            {formData.secondary_cause_code}
                          </Badge>
                          <span className="truncate">{formData.secondary_cause_name}</span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Cari diagnosis ICD-10 (opsional)...</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[460px] max-w-[90vw] p-0 rounded-none" align="start">
                    <Command>
                      <CommandInput
                        placeholder="Ketik nama penyakit atau kode ICD-10..."
                        value={searchValue}
                        onValueChange={setSearchValue}
                      />
                      <CommandList>
                        {searchLoading ? (
                          <div className="flex items-center justify-center py-6">
                            <Loader2 className="h-4 w-4 animate-spin" />
                          </div>
                        ) : icdResults.length === 0 ? (
                          <CommandEmpty>
                            {searchValue.length < 2 ? "Ketik minimal 2 karakter..." : "Tidak ada hasil"}
                          </CommandEmpty>
                        ) : (
                          <CommandGroup>
                            {icdResults.map((icd) => (
                              <CommandItem
                                key={icd.code}
                                value={icd.code}
                                onSelect={() => handleSelectICD(icd)}
                                className="cursor-pointer rounded-none text-xs"
                              >
                                <Badge variant="outline" className="mr-2 rounded-none font-mono text-[10px]">
                                  {icd.code}
                                </Badge>
                                <span className="truncate">{icd.display}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        )}
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[11px] font-medium text-muted-foreground">Cara Kematian</Label>
                <Select
                  value={formData.manner_of_death}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, manner_of_death: value }))}
                  disabled={readOnly}
                >
                  <SelectTrigger className="h-9 rounded-none text-xs">
                    <SelectValue placeholder="Pilih cara kematian" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    {mannerOfDeathOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value} className="text-xs">
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="duration_of_illness" className="text-[11px] font-medium text-muted-foreground">
                  Durasi Sakit
                </Label>
                <Input
                  id="duration_of_illness"
                  placeholder="cth: 3 hari, 2 minggu, 1 bulan"
                  value={formData.duration_of_illness}
                  onChange={(e) => setFormData((prev) => ({ ...prev, duration_of_illness: e.target.value }))}
                  disabled={readOnly}
                  className="h-9 rounded-none text-xs"
                />
              </div>
            </div>
          </div>

          {/* Dokter, Saksi & Catatan */}
          <div className="p-4 sm:p-5 space-y-4">
            <div className="border-l-2 border-neutral-900 dark:border-neutral-100 pl-2.5 text-xs font-bold uppercase tracking-wider text-neutral-900 dark:text-neutral-100">
              Dokter, Saksi & Catatan
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="declaring_doctor_name" className="text-[11px] font-medium text-muted-foreground">
                  <Stethoscope className="h-3 w-3 inline mr-1" />
                  Dokter yang Menyatakan
                </Label>
                <Input
                  id="declaring_doctor_name"
                  placeholder="Nama dokter"
                  value={formData.declaring_doctor_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, declaring_doctor_name: e.target.value }))}
                  disabled={readOnly}
                  className="h-9 rounded-none text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="witness_name" className="text-[11px] font-medium text-muted-foreground">
                  <User className="h-3 w-3 inline mr-1" />
                  Nama Saksi
                </Label>
                <Input
                  id="witness_name"
                  placeholder="Nama saksi (keluarga/perawat)"
                  value={formData.witness_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, witness_name: e.target.value }))}
                  disabled={readOnly}
                  className="h-9 rounded-none text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="witness_relation" className="text-[11px] font-medium text-muted-foreground">
                  Hubungan Saksi
                </Label>
                <Input
                  id="witness_relation"
                  placeholder="cth: Anak, Suami/Istri, Perawat"
                  value={formData.witness_relation}
                  onChange={(e) => setFormData((prev) => ({ ...prev, witness_relation: e.target.value }))}
                  disabled={readOnly}
                  className="h-9 rounded-none text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="notes" className="text-[11px] font-medium text-muted-foreground">
                Catatan Tambahan
              </Label>
              <Textarea
                id="notes"
                placeholder="Catatan tambahan (opsional)"
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                disabled={readOnly}
                rows={2}
                className="rounded-none text-xs"
              />
            </div>
          </div>

          {/* Actions Footer */}
          {!readOnly && (
            <div className="px-4 sm:px-5 py-3 flex items-center justify-end gap-2 bg-neutral-50/40 dark:bg-neutral-900/20">
              {editingId && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancelEdit}
                  disabled={saving}
                  className="h-8 rounded-none text-xs"
                >
                  Batal Edit
                </Button>
              )}
              <Button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="h-8 rounded-none text-xs gap-1.5 bg-neutral-900 hover:bg-neutral-800 text-white dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                {editingId ? "Update Surat" : "Simpan Surat"}
              </Button>
            </div>
          )}
        </fieldset>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div className="p-4 sm:p-5">
          {certificates.length > 0 ? (
            <div className="border border-neutral-200 dark:border-neutral-800 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-neutral-50 dark:bg-neutral-900 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground border-b border-neutral-200 dark:border-neutral-800">
                    <th className="px-3 py-2 text-left">No. Surat</th>
                    <th className="px-3 py-2 text-left">Jenis</th>
                    <th className="px-3 py-2 text-left">Waktu Kematian</th>
                    <th className="px-3 py-2 text-left">Penyebab Utama</th>
                    <th className="w-28 px-3 py-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {certificates.map((cert) => (
                    <tr
                      key={cert.id}
                      className="border-b border-neutral-200 dark:border-neutral-800 last:border-b-0 hover:bg-neutral-50/50 dark:hover:bg-neutral-900/30 transition-colors"
                    >
                      <td className="px-3 py-2.5 font-mono font-medium text-foreground">
                        {cert.certificate_number || "-"}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <Badge
                          variant={
                            cert.death_type === "doa" || cert.death_type === "dod"
                              ? "destructive"
                              : "secondary"
                          }
                          className="rounded-none text-[10px] h-5 px-1.5"
                        >
                          {getDeathTypeLabel(cert.death_type)}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {formatDateTime(cert.death_datetime)}
                      </td>
                      <td className="px-3 py-2.5 max-w-[240px] truncate text-foreground">
                        {cert.primary_cause_code && (
                          <Badge variant="outline" className="mr-1.5 rounded-none font-mono text-[10px] h-5 px-1.5">
                            {cert.primary_cause_code}
                          </Badge>
                        )}
                        {cert.primary_cause_name || "-"}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 rounded-none"
                            onClick={() => handlePrint(cert.id)}
                            disabled={printing}
                            title="Cetak"
                          >
                            <Printer className="h-3.5 w-3.5" />
                          </Button>
                          {!readOnly && (
                            <>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 rounded-none"
                                onClick={() => {
                                  handleEdit(cert);
                                  setActiveTab("form");
                                }}
                                title="Edit"
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  setDeletingId(cert.id);
                                  setDeleteDialogOpen(true);
                                }}
                                title="Hapus"
                                className="h-7 w-7 rounded-none text-destructive hover:text-destructive hover:bg-destructive/10"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="border border-dashed border-neutral-300 dark:border-neutral-700 py-10 px-4 text-center">
              <FileText className="h-7 w-7 text-muted-foreground mx-auto mb-2 opacity-60" />
              <p className="text-xs text-muted-foreground">
                Belum ada surat kematian untuk kunjungan ini. Silakan buat surat baru di tab &quot;Buat Surat&quot;.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="rounded-none">
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Surat Kematian?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus surat kematian ini? Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-none bg-destructive text-destructive-foreground">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
