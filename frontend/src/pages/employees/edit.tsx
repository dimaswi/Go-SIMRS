import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { employeesApi, regionsApi, masterDataApi, type MasterData } from "@/lib/api";
import type { Province, Regency, District, Village } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { 
  ArrowLeft, 
  Loader2, 
  User, 
  CreditCard, 
  MapPin, 
  Phone, 
  Briefcase,
  GraduationCap,
  Heart,
  Building2,
  Stethoscope
} from "lucide-react";
import { setPageTitle } from "@/lib/page-title";

// Medical staff types for showing STR/SIP fields
const MEDICAL_STAFF_CODES = ["dokter", "perawat", "bidan", "apoteker", "asisten_apoteker", "radiografer", "analis_kesehatan"];

function formatDateForInput(dateString?: string) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toISOString().split('T')[0];
}

export default function EmployeeEdit() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  
  // Master data states
  const [masterData, setMasterData] = useState<Record<string, MasterData[]>>({});
  const [loadingMasterData, setLoadingMasterData] = useState(true);
  
  // Region states
  const [allRegencies, setAllRegencies] = useState<(Regency & { province?: Province })[]>([]);
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [regencies, setRegencies] = useState<Regency[]>([]);
  const [districts, setDistricts] = useState<District[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [loadingRegions, setLoadingRegions] = useState({
    allRegencies: false,
    provinces: false,
    regencies: false,
    districts: false,
    villages: false,
  });
  
  // Selected region IDs for cascading
  const [selectedProvinceId, setSelectedProvinceId] = useState("");
  const [selectedRegencyId, setSelectedRegencyId] = useState("");
  const [selectedDistrictId, setSelectedDistrictId] = useState("");
  const [selectedVillageId, setSelectedVillageId] = useState("");
  const [regionInitialized, setRegionInitialized] = useState(false);
  
  const [formData, setFormData] = useState({
    // Personal Information
    nik: "",
    nip: "",
    nama_lengkap: "",
    tempat_lahir: "",
    tanggal_lahir: "",
    jenis_kelamin: "",
    agama: "",
    status_perkawinan: "",
    alamat: "",
    kota: "",
    provinsi: "",
    kode_pos: "",
    no_telepon: "",
    no_hp: "",
    email: "",
    
    // Employment Information
    tipe_karyawan: "",
    status_kepegawaian: "",
    tanggal_masuk: "",
    tanggal_keluar: "",
    departemen: "",
    jabatan: "",
    
    // Medical Staff Information
    no_str: "",
    tanggal_str: "",
    masa_berlaku_str: "",
    no_sip: "",
    tanggal_sip: "",
    masa_berlaku_sip: "",
    spesialisasi: "",
    
    // Education
    pendidikan_terakhir: "",
    nama_institusi: "",
    tahun_lulus: "",
    
    // Bank Information
    nama_bank: "",
    no_rekening: "",
    atas_nama_rekening: "",
    
    // Emergency Contact
    nama_kontak_darurat: "",
    hubungan_kontak_darurat: "",
    telepon_kontak_darurat: "",
    
    // Status
    is_active: true,
  });

  useEffect(() => {
    setPageTitle("Edit Pegawai");
    loadInitialData();
    loadMasterData();
  }, [id]);

  const loadMasterData = async () => {
    try {
      const response = await masterDataApi.getMultiple([
        'gender',
        'religion',
        'marital_status',
        'education_level',
        'employee_type',
        'employment_status',
        'blood_type',
        'relationship',
        'bank',
        'department',
        'position',
        'specialization',
      ]);
      setMasterData(response.data.data || {});
    } catch (error) {
      console.error("Failed to load master data:", error);
    } finally {
      setLoadingMasterData(false);
    }
  };

  const loadInitialData = async () => {
    // Load all regencies for birthplace and provinces first
    setLoadingRegions(prev => ({ ...prev, allRegencies: true, provinces: true }));
    try {
      const [regenciesRes, provincesRes] = await Promise.all([
        regionsApi.getAllRegencies(),
        regionsApi.getProvinces(),
      ]);
      setAllRegencies(regenciesRes.data.data || []);
      setProvinces(provincesRes.data.data || []);
    } catch (error) {
      console.error("Failed to load regions:", error);
    } finally {
      setLoadingRegions(prev => ({ ...prev, allRegencies: false, provinces: false }));
    }
    
    // Load employee
    loadEmployee();
  };

  const loadEmployee = async () => {
    try {
      const response = await employeesApi.getById(Number(id));
      const emp = response.data.data;
      setFormData({
        nik: emp.nik || "",
        nip: emp.nip || "",
        nama_lengkap: emp.nama_lengkap || "",
        tempat_lahir: emp.tempat_lahir || "",
        tanggal_lahir: formatDateForInput(emp.tanggal_lahir),
        jenis_kelamin: emp.jenis_kelamin || "",
        agama: emp.agama || "",
        status_perkawinan: emp.status_perkawinan || "",
        alamat: emp.alamat || "",
        kota: emp.kota || "",
        provinsi: emp.provinsi || "",
        kode_pos: emp.kode_pos || "",
        no_telepon: emp.no_telepon || "",
        no_hp: emp.no_hp || "",
        email: emp.email || "",
        tipe_karyawan: emp.tipe_karyawan || "",
        status_kepegawaian: emp.status_kepegawaian || "",
        tanggal_masuk: formatDateForInput(emp.tanggal_masuk),
        tanggal_keluar: formatDateForInput(emp.tanggal_keluar),
        departemen: emp.departemen || "",
        jabatan: emp.jabatan || "",
        no_str: emp.no_str || "",
        tanggal_str: formatDateForInput(emp.tanggal_str),
        masa_berlaku_str: formatDateForInput(emp.masa_berlaku_str),
        no_sip: emp.no_sip || "",
        tanggal_sip: formatDateForInput(emp.tanggal_sip),
        masa_berlaku_sip: formatDateForInput(emp.masa_berlaku_sip),
        spesialisasi: emp.spesialisasi || "",
        pendidikan_terakhir: emp.pendidikan_terakhir || "",
        nama_institusi: emp.nama_institusi || "",
        tahun_lulus: emp.tahun_lulus ? String(emp.tahun_lulus) : "",
        nama_bank: emp.nama_bank || "",
        no_rekening: emp.no_rekening || "",
        atas_nama_rekening: emp.atas_nama_rekening || "",
        nama_kontak_darurat: emp.nama_kontak_darurat || "",
        hubungan_kontak_darurat: emp.hubungan_kontak_darurat || "",
        telepon_kontak_darurat: emp.telepon_kontak_darurat || "",
        is_active: emp.is_active,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data pegawai.",
      });
    } finally {
      setFetching(false);
    }
  };

  // Load regencies when province changes (but not on initial load)
  useEffect(() => {
    if (regionInitialized && selectedProvinceId) {
      setLoadingRegions(prev => ({ ...prev, regencies: true }));
      regionsApi.getRegencies(selectedProvinceId)
        .then(res => {
          setRegencies(res.data.data || []);
          setDistricts([]);
          setVillages([]);
          setSelectedRegencyId("");
          setSelectedDistrictId("");
          setSelectedVillageId("");
        })
        .finally(() => setLoadingRegions(prev => ({ ...prev, regencies: false })));
    } else if (!selectedProvinceId) {
      setRegencies([]);
      setDistricts([]);
      setVillages([]);
    }
  }, [selectedProvinceId, regionInitialized]);

  // Load districts when regency changes
  useEffect(() => {
    if (regionInitialized && selectedRegencyId) {
      setLoadingRegions(prev => ({ ...prev, districts: true }));
      regionsApi.getDistricts(selectedRegencyId)
        .then(res => {
          setDistricts(res.data.data || []);
          setVillages([]);
          setSelectedDistrictId("");
          setSelectedVillageId("");
        })
        .finally(() => setLoadingRegions(prev => ({ ...prev, districts: false })));
    } else if (!selectedRegencyId) {
      setDistricts([]);
      setVillages([]);
    }
  }, [selectedRegencyId, regionInitialized]);

  // Load villages when district changes
  useEffect(() => {
    if (regionInitialized && selectedDistrictId) {
      setLoadingRegions(prev => ({ ...prev, villages: true }));
      regionsApi.getVillages(selectedDistrictId)
        .then(res => {
          setVillages(res.data.data || []);
          setSelectedVillageId("");
        })
        .finally(() => setLoadingRegions(prev => ({ ...prev, villages: false })));
    } else if (!selectedDistrictId) {
      setVillages([]);
    }
  }, [selectedDistrictId, regionInitialized]);

  // Update form data when region selection changes
  useEffect(() => {
    if (regionInitialized) {
      const province = provinces.find(p => p.id === selectedProvinceId);
      const regency = regencies.find(r => r.id === selectedRegencyId);
      setFormData(prev => ({
        ...prev,
        provinsi: province?.name || "",
        kota: regency?.name || "",
      }));
    }
  }, [selectedProvinceId, selectedRegencyId, provinces, regencies, regionInitialized]);

  // Mark region as initialized after first load
  useEffect(() => {
    if (!fetching && provinces.length > 0) {
      setRegionInitialized(true);
    }
  }, [fetching, provinces]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await employeesApi.update(Number(id), {
        ...formData,
        tahun_lulus: formData.tahun_lulus ? parseInt(formData.tahun_lulus) : undefined,
      } as any);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Data pegawai berhasil diperbarui.",
      });
      setTimeout(() => navigate("/employees"), 500);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal memperbarui data pegawai.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Check if selected employee type is medical staff
  const isMedicalStaff = (() => {
    const selectedType = masterData.employee_type?.find(t => t.code === formData.tipe_karyawan);
    return selectedType ? MEDICAL_STAFF_CODES.includes(selectedType.code) : false;
  })();

  // Convert master data to ComboboxOption format
  const toComboboxOptions = (items: MasterData[] | undefined): ComboboxOption[] => {
    if (!items) return [];
    return items.map(item => ({ value: item.code, label: item.name }));
  };

  const genderOptions = toComboboxOptions(masterData.gender);
  const employeeTypeOptions = toComboboxOptions(masterData.employee_type);
  const employmentStatusOptions = toComboboxOptions(masterData.employment_status);
  const religionOptions = toComboboxOptions(masterData.religion);
  const maritalStatusOptions = toComboboxOptions(masterData.marital_status);
  const educationLevelOptions = toComboboxOptions(masterData.education_level);
  const relationshipOptions = toComboboxOptions(masterData.relationship);
  const bankOptions = toComboboxOptions(masterData.bank);
  const specializationOptions = toComboboxOptions(masterData.specialization);
  
  const birthplaceOptions: ComboboxOption[] = allRegencies.map(r => ({
    value: r.name,
    label: r.province ? `${r.name}, ${r.province.name}` : r.name,
  }));
  
  const provinceOptions: ComboboxOption[] = provinces.map(p => ({ value: p.id, label: p.name }));
  const regencyOptions: ComboboxOption[] = regencies.map(r => ({ value: r.id, label: r.name }));
  const districtOptions: ComboboxOption[] = districts.map(d => ({ value: d.id, label: d.name }));
  const villageOptions: ComboboxOption[] = villages.map(v => ({ value: v.id, label: v.name }));

  if (fetching) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col p-4">
      <form onSubmit={handleSubmit} className="grid gap-4">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => window.history.back()}
            className="h-9 w-9"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold">
              Edit Pegawai
            </h1>
            <p className="text-sm text-muted-foreground">
              Perbarui data pegawai rumah sakit
            </p>
          </div>
        </div>

        {/* Status Card */}
        <div className="rounded-lg border">
          <div className="p-6">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label htmlFor="is_active" className="text-sm font-medium cursor-pointer">
                  Status Pegawai
                </Label>
                <p className="text-xs text-muted-foreground">
                  {formData.is_active ? 'Pegawai aktif' : 'Pegawai tidak aktif'}
                </p>
              </div>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>
        </div>

        {/* Personal Information */}
        <div className="rounded-lg border">
          <div className="flex items-center gap-2 px-6 py-4">
            <User className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Data Pribadi</h3>
          </div>
          <div className="px-6 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-2">
                <Label htmlFor="nik" className="text-xs font-medium flex items-center gap-2">
                  <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                  NIK <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="nik"
                  required
                  maxLength={16}
                  placeholder="16 digit NIK"
                  value={formData.nik}
                  onChange={(e) => setFormData({ ...formData, nik: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nip" className="text-xs font-medium">
                  NIP
                </Label>
                <Input
                  id="nip"
                  maxLength={18}
                  placeholder="NIP (jika ada)"
                  value={formData.nip}
                  onChange={(e) => setFormData({ ...formData, nip: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nama_lengkap" className="text-xs font-medium">
                  Nama Lengkap <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="nama_lengkap"
                  required
                  placeholder="Nama lengkap sesuai KTP"
                  value={formData.nama_lengkap}
                  onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mt-5">
              <div className="space-y-2">
                <Label className="text-xs font-medium">
                  Tempat Lahir
                </Label>
                <Combobox
                  options={birthplaceOptions}
                  value={formData.tempat_lahir}
                  onValueChange={(value) => setFormData({ ...formData, tempat_lahir: value })}
                  placeholder="Pilih kota"
                  searchPlaceholder="Cari kota..."
                  emptyText="Kota tidak ditemukan."
                  loading={loadingRegions.allRegencies}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tanggal_lahir" className="text-xs font-medium">
                  Tanggal Lahir
                </Label>
                <Input
                  id="tanggal_lahir"
                  type="date"
                  value={formData.tanggal_lahir}
                  onChange={(e) => setFormData({ ...formData, tanggal_lahir: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">
                  Jenis Kelamin <span className="text-destructive">*</span>
                </Label>
                <Combobox
                  options={genderOptions}
                  value={formData.jenis_kelamin}
                  onValueChange={(value) => setFormData({ ...formData, jenis_kelamin: value })}
                  placeholder="Pilih"
                  searchPlaceholder="Cari..."
                  loading={loadingMasterData}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">
                  Agama
                </Label>
                <Combobox
                  options={religionOptions}
                  value={formData.agama}
                  onValueChange={(value) => setFormData({ ...formData, agama: value })}
                  placeholder="Pilih"
                  searchPlaceholder="Cari agama..."
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mt-5">
              <div className="space-y-2">
                <Label className="text-xs font-medium">
                  Status Perkawinan
                </Label>
                <Combobox
                  options={maritalStatusOptions}
                  value={formData.status_perkawinan}
                  onValueChange={(value) => setFormData({ ...formData, status_perkawinan: value })}
                  placeholder="Pilih"
                  searchPlaceholder="Cari..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="no_telepon" className="text-xs font-medium flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                  No. Telepon
                </Label>
                <Input
                  id="no_telepon"
                  placeholder="No. telepon rumah"
                  value={formData.no_telepon}
                  onChange={(e) => setFormData({ ...formData, no_telepon: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="no_hp" className="text-xs font-medium">
                  No. HP
                </Label>
                <Input
                  id="no_hp"
                  placeholder="No. HP aktif"
                  value={formData.no_hp}
                  onChange={(e) => setFormData({ ...formData, no_hp: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="email@example.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Address Information */}
        <div className="rounded-lg border">
          <div className="flex items-center gap-2 px-6 py-4">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Alamat</h3>
          </div>
          <div className="px-6 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <Label className="text-xs font-medium">
                  Provinsi
                </Label>
                <Combobox
                  options={provinceOptions}
                  value={selectedProvinceId}
                  onValueChange={(value) => setSelectedProvinceId(value)}
                  placeholder="Pilih provinsi"
                  searchPlaceholder="Cari provinsi..."
                  emptyText="Provinsi tidak ditemukan."
                  loading={loadingRegions.provinces}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">
                  Kota/Kabupaten
                </Label>
                <Combobox
                  options={regencyOptions}
                  value={selectedRegencyId}
                  onValueChange={(value) => setSelectedRegencyId(value)}
                  placeholder="Pilih kota/kabupaten"
                  searchPlaceholder="Cari kota/kabupaten..."
                  emptyText="Kota/kabupaten tidak ditemukan."
                  loading={loadingRegions.regencies}
                  disabled={!selectedProvinceId}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5">
              <div className="space-y-2">
                <Label className="text-xs font-medium">
                  Kecamatan
                </Label>
                <Combobox
                  options={districtOptions}
                  value={selectedDistrictId}
                  onValueChange={(value) => setSelectedDistrictId(value)}
                  placeholder="Pilih kecamatan"
                  searchPlaceholder="Cari kecamatan..."
                  emptyText="Kecamatan tidak ditemukan."
                  loading={loadingRegions.districts}
                  disabled={!selectedRegencyId}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">
                  Kelurahan/Desa
                </Label>
                <Combobox
                  options={villageOptions}
                  value={selectedVillageId}
                  onValueChange={(value) => setSelectedVillageId(value)}
                  placeholder="Pilih kelurahan/desa"
                  searchPlaceholder="Cari kelurahan/desa..."
                  emptyText="Kelurahan/desa tidak ditemukan."
                  loading={loadingRegions.villages}
                  disabled={!selectedDistrictId}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mt-5">
              <div className="md:col-span-3 space-y-2">
                <Label htmlFor="alamat" className="text-xs font-medium">
                  Alamat Lengkap (Jalan, RT/RW, No.)
                </Label>
                <Textarea
                  id="alamat"
                  placeholder="Alamat lengkap sesuai KTP"
                  value={formData.alamat}
                  onChange={(e) => setFormData({ ...formData, alamat: e.target.value })}
                  className="text-sm min-h-[80px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kode_pos" className="text-xs font-medium">
                  Kode Pos
                </Label>
                <Input
                  id="kode_pos"
                  placeholder="Kode pos"
                  value={formData.kode_pos}
                  onChange={(e) => setFormData({ ...formData, kode_pos: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Employment Information */}
        <div className="rounded-lg border">
          <div className="flex items-center gap-2 px-6 py-4">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Data Kepegawaian</h3>
          </div>
          <div className="px-6 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div className="space-y-2">
                <Label className="text-xs font-medium">
                  Tipe Karyawan <span className="text-destructive">*</span>
                </Label>
                <Combobox
                  options={employeeTypeOptions}
                  value={formData.tipe_karyawan}
                  onValueChange={(value) => setFormData({ ...formData, tipe_karyawan: value })}
                  placeholder="Pilih tipe"
                  searchPlaceholder="Cari tipe..."
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-medium">
                  Status Kepegawaian <span className="text-destructive">*</span>
                </Label>
                <Combobox
                  options={employmentStatusOptions}
                  value={formData.status_kepegawaian}
                  onValueChange={(value) => setFormData({ ...formData, status_kepegawaian: value })}
                  placeholder="Pilih status"
                  searchPlaceholder="Cari status..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tanggal_masuk" className="text-xs font-medium">
                  Tanggal Masuk
                </Label>
                <Input
                  id="tanggal_masuk"
                  type="date"
                  value={formData.tanggal_masuk}
                  onChange={(e) => setFormData({ ...formData, tanggal_masuk: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tanggal_keluar" className="text-xs font-medium">
                  Tanggal Keluar
                </Label>
                <Input
                  id="tanggal_keluar"
                  type="date"
                  value={formData.tanggal_keluar}
                  onChange={(e) => setFormData({ ...formData, tanggal_keluar: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
              <div className="space-y-2">
                <Label htmlFor="departemen" className="text-xs font-medium">
                  Departemen
                </Label>
                <Input
                  id="departemen"
                  placeholder="Departemen/Unit"
                  value={formData.departemen}
                  onChange={(e) => setFormData({ ...formData, departemen: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="jabatan" className="text-xs font-medium">
                  Jabatan
                </Label>
                <Input
                  id="jabatan"
                  placeholder="Jabatan"
                  value={formData.jabatan}
                  onChange={(e) => setFormData({ ...formData, jabatan: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              {isMedicalStaff && (
                <div className="space-y-2">
                  <Label className="text-xs font-medium">
                    Spesialisasi
                  </Label>
                  <Combobox
                    options={specializationOptions}
                    value={formData.spesialisasi}
                    onValueChange={(value) => setFormData({ ...formData, spesialisasi: value })}
                    placeholder="Pilih spesialisasi"
                    searchPlaceholder="Cari spesialisasi..."
                    emptyText="Spesialisasi tidak ditemukan."
                    loading={loadingMasterData}
                  />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Medical Staff License Information */}
        {isMedicalStaff && (
          <div className="rounded-lg border">
            <div className="flex items-center gap-2 px-6 py-4">
              <Stethoscope className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium">Surat Izin Praktik</h3>
            </div>
            <div className="px-6 pb-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="no_str" className="text-xs font-medium">
                    No. STR
                  </Label>
                  <Input
                    id="no_str"
                    placeholder="Nomor STR"
                    value={formData.no_str}
                    onChange={(e) => setFormData({ ...formData, no_str: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tanggal_str" className="text-xs font-medium">
                    Tanggal STR
                  </Label>
                  <Input
                    id="tanggal_str"
                    type="date"
                    value={formData.tanggal_str}
                    onChange={(e) => setFormData({ ...formData, tanggal_str: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="masa_berlaku_str" className="text-xs font-medium">
                    Masa Berlaku STR
                  </Label>
                  <Input
                    id="masa_berlaku_str"
                    type="date"
                    value={formData.masa_berlaku_str}
                    onChange={(e) => setFormData({ ...formData, masa_berlaku_str: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-5">
                <div className="space-y-2">
                  <Label htmlFor="no_sip" className="text-xs font-medium">
                    No. SIP
                  </Label>
                  <Input
                    id="no_sip"
                    placeholder="Nomor SIP"
                    value={formData.no_sip}
                    onChange={(e) => setFormData({ ...formData, no_sip: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tanggal_sip" className="text-xs font-medium">
                    Tanggal SIP
                  </Label>
                  <Input
                    id="tanggal_sip"
                    type="date"
                    value={formData.tanggal_sip}
                    onChange={(e) => setFormData({ ...formData, tanggal_sip: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="masa_berlaku_sip" className="text-xs font-medium">
                    Masa Berlaku SIP
                  </Label>
                  <Input
                    id="masa_berlaku_sip"
                    type="date"
                    value={formData.masa_berlaku_sip}
                    onChange={(e) => setFormData({ ...formData, masa_berlaku_sip: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Education */}
        <div className="rounded-lg border">
          <div className="flex items-center gap-2 px-6 py-4">
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Pendidikan</h3>
          </div>
          <div className="px-6 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-2">
                <Label className="text-xs font-medium">
                  Pendidikan Terakhir
                </Label>
                <Combobox
                  options={educationLevelOptions}
                  value={formData.pendidikan_terakhir}
                  onValueChange={(value) => setFormData({ ...formData, pendidikan_terakhir: value })}
                  placeholder="Pilih"
                  searchPlaceholder="Cari..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nama_institusi" className="text-xs font-medium">
                  Nama Institusi
                </Label>
                <Input
                  id="nama_institusi"
                  placeholder="Nama sekolah/universitas"
                  value={formData.nama_institusi}
                  onChange={(e) => setFormData({ ...formData, nama_institusi: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tahun_lulus" className="text-xs font-medium">
                  Tahun Lulus
                </Label>
                <Input
                  id="tahun_lulus"
                  type="number"
                  min="1950"
                  max={new Date().getFullYear()}
                  placeholder="Tahun lulus"
                  value={formData.tahun_lulus}
                  onChange={(e) => setFormData({ ...formData, tahun_lulus: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Bank Information */}
        <div className="rounded-lg border">
          <div className="flex items-center gap-2 px-6 py-4">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Informasi Bank</h3>
          </div>
          <div className="px-6 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-2">
                <Label htmlFor="nama_bank" className="text-xs font-medium">
                  Nama Bank
                </Label>
                <Combobox
                  options={bankOptions}
                  value={formData.nama_bank}
                  onValueChange={(value) => setFormData({ ...formData, nama_bank: value })}
                  placeholder="Pilih bank"
                  searchPlaceholder="Cari bank..."
                  loading={loadingMasterData}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="no_rekening" className="text-xs font-medium">
                  No. Rekening
                </Label>
                <Input
                  id="no_rekening"
                  placeholder="Nomor rekening"
                  value={formData.no_rekening}
                  onChange={(e) => setFormData({ ...formData, no_rekening: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="atas_nama_rekening" className="text-xs font-medium">
                  Atas Nama
                </Label>
                <Input
                  id="atas_nama_rekening"
                  placeholder="Nama pemilik rekening"
                  value={formData.atas_nama_rekening}
                  onChange={(e) => setFormData({ ...formData, atas_nama_rekening: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Emergency Contact */}
        <div className="rounded-lg border">
          <div className="flex items-center gap-2 px-6 py-4">
            <Heart className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium">Kontak Darurat</h3>
          </div>
          <div className="px-6 pb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className="space-y-2">
                <Label htmlFor="nama_kontak_darurat" className="text-xs font-medium">
                  Nama Kontak
                </Label>
                <Input
                  id="nama_kontak_darurat"
                  placeholder="Nama kontak darurat"
                  value={formData.nama_kontak_darurat}
                  onChange={(e) => setFormData({ ...formData, nama_kontak_darurat: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hubungan_kontak_darurat" className="text-xs font-medium">
                  Hubungan
                </Label>
                <Combobox
                  options={relationshipOptions}
                  value={formData.hubungan_kontak_darurat}
                  onValueChange={(value) => setFormData({ ...formData, hubungan_kontak_darurat: value })}
                  placeholder="Pilih hubungan"
                  searchPlaceholder="Cari..."
                  loading={loadingMasterData}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telepon_kontak_darurat" className="text-xs font-medium">
                  No. Telepon
                </Label>
                <Input
                  id="telepon_kontak_darurat"
                  placeholder="No. telepon kontak"
                  value={formData.telepon_kontak_darurat}
                  onChange={(e) => setFormData({ ...formData, telepon_kontak_darurat: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/employees")}
            className="h-9 text-sm"
          >
            Batal
          </Button>
          <Button type="submit" disabled={loading} className="h-9 text-sm min-w-24">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Update
          </Button>
        </div>
      </form>
    </div>
  );
}
