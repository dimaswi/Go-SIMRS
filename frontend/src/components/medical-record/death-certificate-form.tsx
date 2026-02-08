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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  Skull,
  User,
  MapPin,
  Stethoscope,
  AlertTriangle
} from "lucide-react";
import { medicalRecordsApi, printApi } from "@/lib/api";
import { icd10Api, type ICD10 } from "@/lib/api/icd";
import type { DeathCertificate } from "@/lib/api/medical-records";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

export function DeathCertificateForm({ visitId, deathType, onSave, readOnly = false }: DeathCertificateFormProps) {
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
      setCertificates(response.data || []);
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
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Skull className="h-4 w-4" />
          Surat Kematian
        </CardTitle>
        <CardDescription>
          Buat dan kelola surat kematian pasien
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {/* Inline Tabs with Underline */}
        <div className="border-b">
          <div className="flex">
            <button
              onClick={() => setActiveTab("form")}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors relative",
                activeTab === "form"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                {editingId ? "Edit Surat" : "Buat Surat"}
              </span>
              {activeTab === "form" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
            <button
              onClick={() => setActiveTab("history")}
              className={cn(
                "px-4 py-2.5 text-sm font-medium transition-colors relative",
                activeTab === "history"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Riwayat Surat
                {certificates.length > 0 && (
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                    {certificates.length}
                  </Badge>
                )}
              </span>
              {activeTab === "history" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
              )}
            </button>
          </div>
        </div>

        <div className="p-4">
            {/* Form Tab */}
            {activeTab === "form" && (
              <div className="space-y-4">
                <fieldset disabled={readOnly}>
                  {/* Death Type Selection */}
                  <div className="space-y-1.5">
                    <Label>Jenis Kematian <span className="text-destructive">*</span></Label>
                    <div className="grid grid-cols-3 gap-2">
                      {deathTypeOptions.map((option) => (
                        <button
                          key={option.value}
                          type="button"
                          onClick={() => setFormData(prev => ({ ...prev, death_type: option.value }))}
                          disabled={readOnly}
                          className={cn(
                            "p-3 rounded-lg border-2 text-left transition-all",
                            formData.death_type === option.value
                              ? "border-primary bg-primary/10"
                              : "border-muted hover:border-primary/50"
                          )}
                        >
                          <div className="font-medium text-sm">{option.label}</div>
                          <div className="text-xs text-muted-foreground">{option.description}</div>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Death DateTime & Location */}
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="death_datetime">
                        <Calendar className="h-3.5 w-3.5 inline mr-1" />
                        Waktu Kematian <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="death_datetime"
                        type="datetime-local"
                        value={formData.death_datetime}
                        onChange={(e) => setFormData(prev => ({ ...prev, death_datetime: e.target.value }))}
                        disabled={readOnly}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="death_location">
                        <MapPin className="h-3.5 w-3.5 inline mr-1" />
                        Lokasi Kematian
                      </Label>
                      <Input
                        id="death_location"
                        placeholder="e.g., Ruang ICU, IGD, Ruang Rawat Inap"
                        value={formData.death_location}
                        onChange={(e) => setFormData(prev => ({ ...prev, death_location: e.target.value }))}
                        disabled={readOnly}
                      />
                    </div>
                  </div>

                  {/* Primary Cause of Death */}
                  <div className="space-y-1.5 mt-4">
                    <Label>
                      <AlertTriangle className="h-3.5 w-3.5 inline mr-1" />
                      Penyebab Kematian Utama (ICD-10)
                    </Label>
                    <Popover open={searchOpen && searchField === "primary"} onOpenChange={(open) => {
                      setSearchOpen(open);
                      if (open) setSearchField("primary");
                    }}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          {formData.primary_cause_code ? (
                            <span className="truncate">
                              <Badge variant="secondary" className="mr-2">{formData.primary_cause_code}</Badge>
                              {formData.primary_cause_name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Cari diagnosis ICD-10...</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[500px] p-0" align="start">
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
                                    className="cursor-pointer"
                                  >
                                    <Badge variant="outline" className="mr-2">{icd.code}</Badge>
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

                  {/* Secondary Cause */}
                  <div className="space-y-1.5 mt-4">
                    <Label>Penyebab Sekunder (ICD-10)</Label>
                    <Popover open={searchOpen && searchField === "secondary"} onOpenChange={(open) => {
                      setSearchOpen(open);
                      if (open) setSearchField("secondary");
                    }}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          {formData.secondary_cause_code ? (
                            <span className="truncate">
                              <Badge variant="secondary" className="mr-2">{formData.secondary_cause_code}</Badge>
                              {formData.secondary_cause_name}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Cari diagnosis ICD-10 (opsional)...</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[500px] p-0" align="start">
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
                                    className="cursor-pointer"
                                  >
                                    <Badge variant="outline" className="mr-2">{icd.code}</Badge>
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

                  {/* Manner of Death & Duration */}
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="space-y-1.5">
                      <Label>Cara Kematian</Label>
                      <Select
                        value={formData.manner_of_death}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, manner_of_death: value }))}
                        disabled={readOnly}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Pilih cara kematian" />
                        </SelectTrigger>
                        <SelectContent>
                          {mannerOfDeathOptions.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="duration_of_illness">Durasi Sakit</Label>
                      <Input
                        id="duration_of_illness"
                        placeholder="e.g., 3 hari, 2 minggu, 1 bulan"
                        value={formData.duration_of_illness}
                        onChange={(e) => setFormData(prev => ({ ...prev, duration_of_illness: e.target.value }))}
                        disabled={readOnly}
                      />
                    </div>
                  </div>

                  {/* Declaring Doctor */}
                  <div className="space-y-1.5 mt-4">
                    <Label htmlFor="declaring_doctor_name">
                      <Stethoscope className="h-3.5 w-3.5 inline mr-1" />
                      Dokter yang Menyatakan Kematian
                    </Label>
                    <Input
                      id="declaring_doctor_name"
                      placeholder="Nama dokter yang menyatakan kematian"
                      value={formData.declaring_doctor_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, declaring_doctor_name: e.target.value }))}
                      disabled={readOnly}
                    />
                  </div>

                  {/* Witness */}
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="witness_name">
                        <User className="h-3.5 w-3.5 inline mr-1" />
                        Nama Saksi
                      </Label>
                      <Input
                        id="witness_name"
                        placeholder="Nama saksi (keluarga/perawat)"
                        value={formData.witness_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, witness_name: e.target.value }))}
                        disabled={readOnly}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="witness_relation">Hubungan Saksi</Label>
                      <Input
                        id="witness_relation"
                        placeholder="e.g., Anak, Suami/Istri, Perawat"
                        value={formData.witness_relation}
                        onChange={(e) => setFormData(prev => ({ ...prev, witness_relation: e.target.value }))}
                        disabled={readOnly}
                      />
                    </div>
                  </div>

                  {/* Notes */}
                  <div className="space-y-1.5 mt-4">
                    <Label htmlFor="notes">Catatan Tambahan</Label>
                    <Textarea
                      id="notes"
                      placeholder="Catatan tambahan (opsional)"
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      disabled={readOnly}
                      rows={2}
                    />
                  </div>

                  {/* Actions */}
                  {!readOnly && (
                    <div className="flex gap-2 pt-4">
                      <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="gap-1.5"
                      >
                        {saving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        {editingId ? "Update Surat" : "Simpan Surat"}
                      </Button>
                      {editingId && (
                        <Button
                          variant="outline"
                          onClick={handleCancelEdit}
                          disabled={saving}
                        >
                          Batal Edit
                        </Button>
                      )}
                    </div>
                  )}
                </fieldset>
              </div>
            )}

            {/* History Tab */}
            {activeTab === "history" && (
              <div className="space-y-4">
                {certificates.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>No. Surat</TableHead>
                        <TableHead>Jenis</TableHead>
                        <TableHead>Waktu Kematian</TableHead>
                        <TableHead>Penyebab Utama</TableHead>
                        <TableHead className="text-right">Aksi</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {certificates.map((cert) => (
                        <TableRow key={cert.id}>
                          <TableCell className="font-medium">
                            {cert.certificate_number || "-"}
                          </TableCell>
                          <TableCell>
                            <Badge variant={
                              cert.death_type === "doa" ? "destructive" :
                              cert.death_type === "dod" ? "destructive" : "secondary"
                            }>
                              {getDeathTypeLabel(cert.death_type)}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {formatDateTime(cert.death_datetime)}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {cert.primary_cause_code && (
                              <Badge variant="outline" className="mr-1">{cert.primary_cause_code}</Badge>
                            )}
                            {cert.primary_cause_name || "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handlePrint(cert.id)}
                                disabled={printing}
                                title="Cetak"
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                              {!readOnly && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      handleEdit(cert);
                                      setActiveTab("form");
                                    }}
                                    title="Edit"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setDeletingId(cert.id);
                                      setDeleteDialogOpen(true);
                                    }}
                                    title="Hapus"
                                    className="text-destructive hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <Alert>
                    <FileText className="h-4 w-4" />
                    <AlertDescription>
                      Belum ada surat kematian untuk kunjungan ini. 
                      Silakan buat surat baru di tab "Buat Surat".
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}
        </div>
      </CardContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Surat Kematian?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus surat kematian ini? 
              Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
