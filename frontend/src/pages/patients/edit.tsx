import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { DatePickerDropdown } from "@/components/ui/date-picker-dropdown";
import { Checkbox } from "@/components/ui/checkbox";
import { masterDataApi, regionsApi, patientsApi } from "@/lib/api";
import type { PatientRequest, MasterData, Province, Regency, District, Village } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  Loader2,
  Save,
  User,
  MapPin,
  Phone,
  Users,
  Shield,
  Heart,
  ChevronLeft,
  ChevronRight,
  Check,
} from "lucide-react";

// Step definitions
const steps = [
  { id: "identitas", label: "Identitas", icon: User },
  { id: "alamat", label: "Alamat", icon: MapPin },
  { id: "kontak", label: "Kontak", icon: Phone },
  { id: "keluarga", label: "Keluarga", icon: Users },
  { id: "jaminan", label: "Jaminan", icon: Shield },
  { id: "medis", label: "Medis", icon: Heart },
];

// Initial form data
const initialFormData: PatientRequest = {
  nama_lengkap: "",
  jenis_kelamin: "L",
  jenis_jaminan: "Umum",
  kewarganegaraan: "WNI",
};

export default function PatientEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();

  const [formData, setFormData] = useState<PatientRequest>(initialFormData);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingMaster, setLoadingMaster] = useState(true);
  const [currentStep, setCurrentStep] = useState(0);
  const [sameAddress, setSameAddress] = useState(false);

  // Master data state
  const [masterData, setMasterData] = useState<Record<string, MasterData[]>>({});
  
  // Region data state
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [regencies, setRegencies] = useState<Regency[]>([]);
  const [regenciesKTP, setRegenciesKTP] = useState<Regency[]>([]);
  const [districtsKTP, setDistrictsKTP] = useState<District[]>([]);
  const [villagesKTP, setVillagesKTP] = useState<Village[]>([]);
  const [regenciesDomisili, setRegenciesDomisili] = useState<Regency[]>([]);
  const [districtsDomisili, setDistrictsDomisili] = useState<District[]>([]);
  const [villagesDomisili, setVillagesDomisili] = useState<Village[]>([]);

  useEffect(() => {
    setPageTitle("Edit Data Pasien");
    loadReferenceData();
  }, []);

  useEffect(() => {
    if (id && !loadingMaster && provinces.length > 0) {
      loadPatientData(provinces);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, loadingMaster, provinces.length]);

  const loadPatientData = async (provincesData: typeof provinces) => {
    if (!id) return;
    setLoadingData(true);
    try {
      const response = await patientsApi.getById(parseInt(id));
      const patient = response.data;
      if (patient) {
        // Set form data
        setFormData({
          nik: patient.nik || "",
          nama_lengkap: patient.nama_lengkap || "",
          nama_panggilan: patient.nama_panggilan || "",
          jenis_kelamin: patient.jenis_kelamin || "L",
          tempat_lahir: patient.tempat_lahir || "",
          tanggal_lahir: patient.tanggal_lahir || undefined,
          golongan_darah: patient.golongan_darah || undefined,
          rhesus: patient.rhesus || undefined,
          agama: patient.agama || "",
          status_perkawinan: patient.status_perkawinan || "",
          pendidikan_terakhir: patient.pendidikan_terakhir || "",
          pekerjaan: patient.pekerjaan || "",
          kewarganegaraan: patient.kewarganegaraan || "WNI",
          suku: patient.suku || "",
          bahasa: patient.bahasa || "",
          alamat_ktp: patient.alamat_ktp || "",
          rt_ktp: patient.rt_ktp || "",
          rw_ktp: patient.rw_ktp || "",
          kelurahan_ktp: patient.kelurahan_ktp || "",
          kecamatan_ktp: patient.kecamatan_ktp || "",
          kota_ktp: patient.kota_ktp || "",
          provinsi_ktp: patient.provinsi_ktp || "",
          kode_pos_ktp: patient.kode_pos_ktp || "",
          alamat_domisili: patient.alamat_domisili || "",
          rt_domisili: patient.rt_domisili || "",
          rw_domisili: patient.rw_domisili || "",
          kelurahan_domisili: patient.kelurahan_domisili || "",
          kecamatan_domisili: patient.kecamatan_domisili || "",
          kota_domisili: patient.kota_domisili || "",
          provinsi_domisili: patient.provinsi_domisili || "",
          kode_pos_domisili: patient.kode_pos_domisili || "",
          no_telepon: patient.no_telepon || "",
          no_hp: patient.no_hp || "",
          no_hp_alternatif: patient.no_hp_alternatif || "",
          email: patient.email || "",
          nama_penanggung_jawab: patient.nama_penanggung_jawab || "",
          hubungan_penanggung_jawab: patient.hubungan_penanggung_jawab || "",
          nik_penanggung_jawab: patient.nik_penanggung_jawab || "",
          telepon_penanggung_jawab: patient.telepon_penanggung_jawab || "",
          alamat_penanggung_jawab: patient.alamat_penanggung_jawab || "",
          nama_ayah: patient.nama_ayah || "",
          nik_ayah: patient.nik_ayah || "",
          pekerjaan_ayah: patient.pekerjaan_ayah || "",
          nama_ibu: patient.nama_ibu || "",
          nik_ibu: patient.nik_ibu || "",
          pekerjaan_ibu: patient.pekerjaan_ibu || "",
          jenis_jaminan: patient.jenis_jaminan || "Umum",
          no_bpjs: patient.no_bpjs || "",
          kelas_bpjs: patient.kelas_bpjs || "",
          faskes_tingkat_1: patient.faskes_tingkat_1 || "",
          nama_asuransi: patient.nama_asuransi || "",
          no_polis_asuransi: patient.no_polis_asuransi || "",
          masa_berlaku_asuransi: patient.masa_berlaku_asuransi || undefined,
          alergi_obat: patient.alergi_obat || "",
          alergi_makanan: patient.alergi_makanan || "",
          alergi_lainnya: patient.alergi_lainnya || "",
          penyakit_kronis: patient.penyakit_kronis || "",
          riwayat_operasi: patient.riwayat_operasi || "",
          obat_rutin: patient.obat_rutin || "",
          disabilitas: patient.disabilitas || "",
          catatan_khusus: patient.catatan_khusus || "",
        });

        // Load region data for KTP address if patient has address data
        if (patient.provinsi_ktp) {
          try {
            const provinceKTP = provincesData.find(p => p.name === patient.provinsi_ktp);
            if (provinceKTP) {
              const regenciesRes = await regionsApi.getRegencies(provinceKTP.id);
              setRegenciesKTP(regenciesRes.data.data || []);
              
              if (patient.kota_ktp) {
                const regencyKTP = (regenciesRes.data.data || []).find((r: Regency) => r.name === patient.kota_ktp);
                if (regencyKTP) {
                  const districtsRes = await regionsApi.getDistricts(regencyKTP.id);
                  setDistrictsKTP(districtsRes.data.data || []);
                  
                  if (patient.kecamatan_ktp) {
                    const districtKTP = (districtsRes.data.data || []).find((d: District) => d.name === patient.kecamatan_ktp);
                    if (districtKTP) {
                      const villagesRes = await regionsApi.getVillages(districtKTP.id);
                      setVillagesKTP(villagesRes.data.data || []);
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.error("Failed to load KTP regions:", error);
          }
        }

        // Load region data for Domisili address if patient has address data
        if (patient.provinsi_domisili) {
          try {
            const provinceDomisili = provincesData.find(p => p.name === patient.provinsi_domisili);
            if (provinceDomisili) {
              const regenciesRes = await regionsApi.getRegencies(provinceDomisili.id);
              setRegenciesDomisili(regenciesRes.data.data || []);
              
              if (patient.kota_domisili) {
                const regencyDomisili = (regenciesRes.data.data || []).find((r: Regency) => r.name === patient.kota_domisili);
                if (regencyDomisili) {
                  const districtsRes = await regionsApi.getDistricts(regencyDomisili.id);
                  setDistrictsDomisili(districtsRes.data.data || []);
                  
                  if (patient.kecamatan_domisili) {
                    const districtDomisili = (districtsRes.data.data || []).find((d: District) => d.name === patient.kecamatan_domisili);
                    if (districtDomisili) {
                      const villagesRes = await regionsApi.getVillages(districtDomisili.id);
                      setVillagesDomisili(villagesRes.data.data || []);
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.error("Failed to load Domisili regions:", error);
          }
        }
      }
    } catch (error) {
      console.error("Failed to load patient data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data pasien",
      });
      navigate("/patients");
    } finally {
      setLoadingData(false);
    }
  };

  const loadReferenceData = async () => {
    setLoadingMaster(true);
    try {
      const [masterDataRes, provincesRes, allRegenciesRes] = await Promise.all([
        masterDataApi.getMultiple([
          "gender",
          "religion",
          "marital_status",
          "education_level",
          "occupation",
          "relationship",
          "blood_type",
          "rhesus_type",
          "insurance_type",
          "bpjs_class",
        ]),
        regionsApi.getProvinces(),
        regionsApi.getAllRegencies(),
      ]);

      setMasterData(masterDataRes.data.data || {});
      setProvinces(provincesRes.data.data || []);
      setRegencies(allRegenciesRes.data.data || []);
    } catch (error) {
      console.error("Failed to load reference data:", error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data referensi",
      });
    } finally {
      setLoadingMaster(false);
    }
  };

  // Convert master data to combobox options
  const toOptions = (data: MasterData[] | undefined) => {
    if (!data) return [];
    return data.map((item) => ({
      value: item.name,
      label: item.name,
    }));
  };

  // Convert regions to combobox options
  const toRegionOptions = (data: { id: string; name: string }[] | undefined) => {
    if (!data) return [];
    return data.map((item) => ({
      value: item.name,
      label: item.name,
    }));
  };

  // Handle province change for KTP
  const handleProvinceKTPChange = async (value: string) => {
    setFormData({ ...formData, provinsi_ktp: value, kota_ktp: "", kecamatan_ktp: "", kelurahan_ktp: "" });
    setDistrictsKTP([]);
    setVillagesKTP([]);
    const province = provinces.find((p) => p.name === value);
    if (province) {
      try {
        const res = await regionsApi.getRegencies(province.id);
        setRegenciesKTP(res.data.data || []);
      } catch (error) {
        console.error("Failed to load regencies:", error);
      }
    }
  };

  // Handle regency change for KTP
  const handleRegencyKTPChange = async (value: string) => {
    setFormData({ ...formData, kota_ktp: value, kecamatan_ktp: "", kelurahan_ktp: "" });
    setVillagesKTP([]);
    const regency = regenciesKTP.find((r) => r.name === value);
    if (regency) {
      try {
        const res = await regionsApi.getDistricts(regency.id);
        setDistrictsKTP(res.data.data || []);
      } catch (error) {
        console.error("Failed to load districts:", error);
      }
    }
  };

  // Handle district change for KTP
  const handleDistrictKTPChange = async (value: string) => {
    setFormData({ ...formData, kecamatan_ktp: value, kelurahan_ktp: "" });
    const district = districtsKTP.find((d) => d.name === value);
    if (district) {
      try {
        const res = await regionsApi.getVillages(district.id);
        setVillagesKTP(res.data.data || []);
      } catch (error) {
        console.error("Failed to load villages:", error);
      }
    }
  };

  // Handle province change for Domisili
  const handleProvinceDomisiliChange = async (value: string) => {
    setFormData({ ...formData, provinsi_domisili: value, kota_domisili: "", kecamatan_domisili: "", kelurahan_domisili: "" });
    setDistrictsDomisili([]);
    setVillagesDomisili([]);
    const province = provinces.find((p) => p.name === value);
    if (province) {
      try {
        const res = await regionsApi.getRegencies(province.id);
        setRegenciesDomisili(res.data.data || []);
      } catch (error) {
        console.error("Failed to load regencies:", error);
      }
    }
  };

  // Handle regency change for Domisili
  const handleRegencyDomisiliChange = async (value: string) => {
    setFormData({ ...formData, kota_domisili: value, kecamatan_domisili: "", kelurahan_domisili: "" });
    setVillagesDomisili([]);
    const regency = regenciesDomisili.find((r) => r.name === value);
    if (regency) {
      try {
        const res = await regionsApi.getDistricts(regency.id);
        setDistrictsDomisili(res.data.data || []);
      } catch (error) {
        console.error("Failed to load districts:", error);
      }
    }
  };

  // Handle district change for Domisili
  const handleDistrictDomisiliChange = async (value: string) => {
    setFormData({ ...formData, kecamatan_domisili: value, kelurahan_domisili: "" });
    const district = districtsDomisili.find((d) => d.name === value);
    if (district) {
      try {
        const res = await regionsApi.getVillages(district.id);
        setVillagesDomisili(res.data.data || []);
      } catch (error) {
        console.error("Failed to load villages:", error);
      }
    }
  };

  // Copy KTP address to Domisili
  useEffect(() => {
    if (sameAddress) {
      setFormData((prev) => ({
        ...prev,
        alamat_domisili: prev.alamat_ktp,
        rt_domisili: prev.rt_ktp,
        rw_domisili: prev.rw_ktp,
        kelurahan_domisili: prev.kelurahan_ktp,
        kecamatan_domisili: prev.kecamatan_ktp,
        kota_domisili: prev.kota_ktp,
        provinsi_domisili: prev.provinsi_ktp,
        kode_pos_domisili: prev.kode_pos_ktp,
      }));
      setRegenciesDomisili(regenciesKTP);
      setDistrictsDomisili(districtsKTP);
      setVillagesDomisili(villagesKTP);
    }
  }, [sameAddress]);

  const validateStep = (step: number): boolean => {
    switch (step) {
      case 0: // Identitas
        if (!formData.nama_lengkap) {
          toast({ variant: "destructive", title: "Validasi", description: "Nama lengkap wajib diisi" });
          return false;
        }
        return true;
      default:
        return true;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
    }
  };

  const handlePrev = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;
    if (!id) return;

    setLoading(true);
    try {
      await patientsApi.update(parseInt(id), formData);
      toast({
        variant: "success",
        title: "Berhasil",
        description: "Data pasien berhasil diperbarui",
      });
      navigate(`/patients/${id}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Gagal memperbarui data pasien",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Options from master data
  const genderOptions = toOptions(masterData.gender);
  const bloodTypeOptions = toOptions(masterData.blood_type);
  const rhesusOptions = toOptions(masterData.rhesus_type);
  const religionOptions = toOptions(masterData.religion);
  const maritalOptions = toOptions(masterData.marital_status);
  const educationOptions = toOptions(masterData.education_level);
  const occupationOptions = toOptions(masterData.occupation);
  const relationshipOptions = toOptions(masterData.relationship);
  const insuranceOptions = toOptions(masterData.insurance_type);
  const bpjsClassOptions = toOptions(masterData.bpjs_class);

  // Region options
  const provinceOptions = toRegionOptions(provinces);
  const regenciesOptions = toRegionOptions(regencies);
  const regencyKTPOptions = toRegionOptions(regenciesKTP);
  const districtKTPOptions = toRegionOptions(districtsKTP);
  const villageKTPOptions = toRegionOptions(villagesKTP);
  const regencyDomisiliOptions = toRegionOptions(regenciesDomisili);
  const districtDomisiliOptions = toRegionOptions(districtsDomisili);
  const villageDomisiliOptions = toRegionOptions(villagesDomisili);

  if (loadingMaster || loadingData) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // Identitas
        return (
          <div className="space-y-6">
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="nik" className="text-xs font-medium">NIK</Label>
                  <Input
                    id="nik"
                    placeholder="16 digit NIK"
                    maxLength={16}
                    value={formData.nik || ""}
                    onChange={(e) => setFormData({ ...formData, nik: e.target.value.replace(/\D/g, "") })}
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nama_lengkap" className="text-xs font-medium">Nama Lengkap *</Label>
                  <Input
                    id="nama_lengkap"
                    placeholder="Nama sesuai KTP/Akta"
                    value={formData.nama_lengkap}
                    onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })}
                    required
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nama_panggilan" className="text-xs font-medium">Nama Panggilan</Label>
                  <Input
                    id="nama_panggilan"
                    placeholder="Nama panggilan"
                    value={formData.nama_panggilan || ""}
                    onChange={(e) => setFormData({ ...formData, nama_panggilan: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Jenis Kelamin *</Label>
                  <Combobox
                    options={genderOptions}
                    value={formData.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan"}
                    onValueChange={(value) => setFormData({ ...formData, jenis_kelamin: value === "Laki-laki" ? "L" : "P" })}
                    placeholder="Pilih jenis kelamin"
                    className="h-9"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Tempat Lahir</Label>
                  <Combobox
                    options={regenciesOptions}
                    value={formData.tempat_lahir || ""}
                    onValueChange={(value) => setFormData({ ...formData, tempat_lahir: value })}
                    placeholder="Pilih kabupaten/kota"
                    searchPlaceholder="Cari kabupaten/kota..."
                    className="h-9"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Tanggal Lahir</Label>
                  <DatePickerDropdown
                    value={formData.tanggal_lahir}
                    onChange={(v) => setFormData({ ...formData, tanggal_lahir: v })}
                    disableFuture
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Golongan Darah</Label>
                  <Combobox
                    options={bloodTypeOptions}
                    value={formData.golongan_darah || ""}
                    onValueChange={(value) => setFormData({ ...formData, golongan_darah: value as any })}
                    placeholder="Pilih golongan darah"
                    className="h-9"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Rhesus</Label>
                  <Combobox
                    options={rhesusOptions}
                    value={formData.rhesus || ""}
                    onValueChange={(value) => setFormData({ ...formData, rhesus: value as any })}
                    placeholder="Pilih rhesus"
                    className="h-9"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Agama</Label>
                  <Combobox
                    options={religionOptions}
                    value={formData.agama || ""}
                    onValueChange={(value) => setFormData({ ...formData, agama: value })}
                    placeholder="Pilih agama"
                    className="h-9"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Status Perkawinan</Label>
                  <Combobox
                    options={maritalOptions}
                    value={formData.status_perkawinan || ""}
                    onValueChange={(value) => setFormData({ ...formData, status_perkawinan: value })}
                    placeholder="Pilih status"
                    className="h-9"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Pendidikan Terakhir</Label>
                  <Combobox
                    options={educationOptions}
                    value={formData.pendidikan_terakhir || ""}
                    onValueChange={(value) => setFormData({ ...formData, pendidikan_terakhir: value })}
                    placeholder="Pilih pendidikan"
                    className="h-9"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Pekerjaan</Label>
                  <Combobox
                    options={occupationOptions}
                    value={formData.pekerjaan || ""}
                    onValueChange={(value) => setFormData({ ...formData, pekerjaan: value })}
                    placeholder="Pilih pekerjaan"
                    className="h-9"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="kewarganegaraan" className="text-xs font-medium">Kewarganegaraan</Label>
                  <Input
                    id="kewarganegaraan"
                    placeholder="WNI / WNA"
                    value={formData.kewarganegaraan || "WNI"}
                    onChange={(e) => setFormData({ ...formData, kewarganegaraan: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="suku" className="text-xs font-medium">Suku / Etnis</Label>
                  <Input
                    id="suku"
                    placeholder="Suku / Etnis"
                    value={formData.suku || ""}
                    onChange={(e) => setFormData({ ...formData, suku: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bahasa" className="text-xs font-medium">Bahasa yang Dikuasai</Label>
                  <Input
                    id="bahasa"
                    placeholder="Indonesia, Jawa, dll"
                    value={formData.bahasa || ""}
                    onChange={(e) => setFormData({ ...formData, bahasa: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 1: // Alamat
        return (
          <div className="space-y-6">
            <div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="alamat_ktp" className="text-xs font-medium">Alamat Lengkap</Label>
                  <Textarea
                    id="alamat_ktp"
                    placeholder="Jalan, Nomor Rumah, Gang, dll"
                    value={formData.alamat_ktp || ""}
                    onChange={(e) => setFormData({ ...formData, alamat_ktp: e.target.value })}
                    className="text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rt_ktp" className="text-xs font-medium">RT</Label>
                    <Input
                      id="rt_ktp"
                      placeholder="001"
                      maxLength={5}
                      value={formData.rt_ktp || ""}
                      onChange={(e) => setFormData({ ...formData, rt_ktp: e.target.value })}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rw_ktp" className="text-xs font-medium">RW</Label>
                    <Input
                      id="rw_ktp"
                      placeholder="001"
                      maxLength={5}
                      value={formData.rw_ktp || ""}
                      onChange={(e) => setFormData({ ...formData, rw_ktp: e.target.value })}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Provinsi</Label>
                    <Combobox
                      options={provinceOptions}
                      value={formData.provinsi_ktp || ""}
                      onValueChange={handleProvinceKTPChange}
                      placeholder="Pilih provinsi"
                      searchPlaceholder="Cari provinsi..."
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Kota/Kabupaten</Label>
                    <Combobox
                      options={regencyKTPOptions}
                      value={formData.kota_ktp || ""}
                      onValueChange={handleRegencyKTPChange}
                      placeholder="Pilih kota/kabupaten"
                      searchPlaceholder="Cari kota..."
                      disabled={!formData.provinsi_ktp}
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Kecamatan</Label>
                    <Combobox
                      options={districtKTPOptions}
                      value={formData.kecamatan_ktp || ""}
                      onValueChange={handleDistrictKTPChange}
                      placeholder="Pilih kecamatan"
                      searchPlaceholder="Cari kecamatan..."
                      disabled={!formData.kota_ktp}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Kelurahan/Desa</Label>
                    <Combobox
                      options={villageKTPOptions}
                      value={formData.kelurahan_ktp || ""}
                      onValueChange={(value) => setFormData({ ...formData, kelurahan_ktp: value })}
                      placeholder="Pilih kelurahan"
                      searchPlaceholder="Cari kelurahan..."
                      disabled={!formData.kecamatan_ktp}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="kode_pos_ktp" className="text-xs font-medium">Kode Pos</Label>
                    <Input
                      id="kode_pos_ktp"
                      placeholder="12345"
                      maxLength={10}
                      value={formData.kode_pos_ktp || ""}
                      onChange={(e) => setFormData({ ...formData, kode_pos_ktp: e.target.value })}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            <hr className="border-border/50" />

            <div>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-muted-foreground">ALAMAT DOMISILI</h3>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="same_address"
                    checked={sameAddress}
                    onCheckedChange={(checked) => setSameAddress(checked === true)}
                  />
                  <Label htmlFor="same_address" className="text-xs cursor-pointer">
                    Sama dengan alamat KTP
                  </Label>
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="alamat_domisili" className="text-xs font-medium">Alamat Lengkap</Label>
                  <Textarea
                    id="alamat_domisili"
                    placeholder="Jalan, Nomor Rumah, Gang, dll"
                    value={formData.alamat_domisili || ""}
                    onChange={(e) => setFormData({ ...formData, alamat_domisili: e.target.value })}
                    disabled={sameAddress}
                    className="text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rt_domisili" className="text-xs font-medium">RT</Label>
                    <Input
                      id="rt_domisili"
                      placeholder="001"
                      maxLength={5}
                      value={formData.rt_domisili || ""}
                      onChange={(e) => setFormData({ ...formData, rt_domisili: e.target.value })}
                      disabled={sameAddress}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rw_domisili" className="text-xs font-medium">RW</Label>
                    <Input
                      id="rw_domisili"
                      placeholder="001"
                      maxLength={5}
                      value={formData.rw_domisili || ""}
                      onChange={(e) => setFormData({ ...formData, rw_domisili: e.target.value })}
                      disabled={sameAddress}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Provinsi</Label>
                    <Combobox
                      options={provinceOptions}
                      value={formData.provinsi_domisili || ""}
                      onValueChange={handleProvinceDomisiliChange}
                      placeholder="Pilih provinsi"
                      searchPlaceholder="Cari provinsi..."
                      disabled={sameAddress}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Kota/Kabupaten</Label>
                    <Combobox
                      options={regencyDomisiliOptions}
                      value={formData.kota_domisili || ""}
                      onValueChange={handleRegencyDomisiliChange}
                      placeholder="Pilih kota/kabupaten"
                      searchPlaceholder="Cari kota..."
                      disabled={sameAddress || !formData.provinsi_domisili}
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Kecamatan</Label>
                    <Combobox
                      options={districtDomisiliOptions}
                      value={formData.kecamatan_domisili || ""}
                      onValueChange={handleDistrictDomisiliChange}
                      placeholder="Pilih kecamatan"
                      searchPlaceholder="Cari kecamatan..."
                      disabled={sameAddress || !formData.kota_domisili}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Kelurahan/Desa</Label>
                    <Combobox
                      options={villageDomisiliOptions}
                      value={formData.kelurahan_domisili || ""}
                      onValueChange={(value) => setFormData({ ...formData, kelurahan_domisili: value })}
                      placeholder="Pilih kelurahan"
                      searchPlaceholder="Cari kelurahan..."
                      disabled={sameAddress || !formData.kecamatan_domisili}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="kode_pos_domisili" className="text-xs font-medium">Kode Pos</Label>
                    <Input
                      id="kode_pos_domisili"
                      placeholder="12345"
                      maxLength={10}
                      value={formData.kode_pos_domisili || ""}
                      onChange={(e) => setFormData({ ...formData, kode_pos_domisili: e.target.value })}
                      disabled={sameAddress}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 2: // Kontak
        return (
          <div className="space-y-6">
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="no_telepon" className="text-xs font-medium">Nomor Telepon Rumah</Label>
                  <Input
                    id="no_telepon"
                    placeholder="021-xxxxxxx"
                    value={formData.no_telepon || ""}
                    onChange={(e) => setFormData({ ...formData, no_telepon: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="no_hp" className="text-xs font-medium">Nomor HP</Label>
                  <Input
                    id="no_hp"
                    placeholder="08xxxxxxxxxx"
                    value={formData.no_hp || ""}
                    onChange={(e) => setFormData({ ...formData, no_hp: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="no_hp_alternatif" className="text-xs font-medium">Nomor HP Alternatif</Label>
                  <Input
                    id="no_hp_alternatif"
                    placeholder="08xxxxxxxxxx"
                    value={formData.no_hp_alternatif || ""}
                    onChange={(e) => setFormData({ ...formData, no_hp_alternatif: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-xs font-medium">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@example.com"
                    value={formData.email || ""}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      case 3: // Keluarga
        return (
          <div className="space-y-6">
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="nama_penanggung_jawab" className="text-xs font-medium">Nama Penanggung Jawab</Label>
                  <Input
                    id="nama_penanggung_jawab"
                    placeholder="Nama lengkap"
                    value={formData.nama_penanggung_jawab || ""}
                    onChange={(e) => setFormData({ ...formData, nama_penanggung_jawab: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Hubungan dengan Pasien</Label>
                  <Combobox
                    options={relationshipOptions}
                    value={formData.hubungan_penanggung_jawab || ""}
                    onValueChange={(value) => setFormData({ ...formData, hubungan_penanggung_jawab: value })}
                    placeholder="Pilih hubungan"
                    className="h-9"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nik_penanggung_jawab" className="text-xs font-medium">NIK Penanggung Jawab</Label>
                  <Input
                    id="nik_penanggung_jawab"
                    placeholder="16 digit NIK"
                    maxLength={16}
                    value={formData.nik_penanggung_jawab || ""}
                    onChange={(e) => setFormData({ ...formData, nik_penanggung_jawab: e.target.value.replace(/\D/g, "") })}
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="telepon_penanggung_jawab" className="text-xs font-medium">Telepon Penanggung Jawab</Label>
                  <Input
                    id="telepon_penanggung_jawab"
                    placeholder="08xxxxxxxxxx"
                    value={formData.telepon_penanggung_jawab || ""}
                    onChange={(e) => setFormData({ ...formData, telepon_penanggung_jawab: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>

                <div className="md:col-span-2 space-y-2">
                  <Label htmlFor="alamat_penanggung_jawab" className="text-xs font-medium">Alamat Penanggung Jawab</Label>
                  <Textarea
                    id="alamat_penanggung_jawab"
                    placeholder="Alamat lengkap"
                    value={formData.alamat_penanggung_jawab || ""}
                    onChange={(e) => setFormData({ ...formData, alamat_penanggung_jawab: e.target.value })}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>

            <hr className="border-border/50" />

            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-4">DATA ORANG TUA (UNTUK PASIEN ANAK)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="text-xs font-semibold">Data Ayah</h4>
                  <div className="space-y-2">
                    <Label htmlFor="nama_ayah" className="text-xs font-medium">Nama Ayah</Label>
                    <Input
                      id="nama_ayah"
                      placeholder="Nama lengkap ayah"
                      value={formData.nama_ayah || ""}
                      onChange={(e) => setFormData({ ...formData, nama_ayah: e.target.value })}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nik_ayah" className="text-xs font-medium">NIK Ayah</Label>
                    <Input
                      id="nik_ayah"
                      placeholder="16 digit NIK"
                      maxLength={16}
                      value={formData.nik_ayah || ""}
                      onChange={(e) => setFormData({ ...formData, nik_ayah: e.target.value.replace(/\D/g, "") })}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Pekerjaan Ayah</Label>
                    <Combobox
                      options={occupationOptions}
                      value={formData.pekerjaan_ayah || ""}
                      onValueChange={(value) => setFormData({ ...formData, pekerjaan_ayah: value })}
                      placeholder="Pilih pekerjaan"
                      className="h-9"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-xs font-semibold">Data Ibu</h4>
                  <div className="space-y-2">
                    <Label htmlFor="nama_ibu" className="text-xs font-medium">Nama Ibu</Label>
                    <Input
                      id="nama_ibu"
                      placeholder="Nama lengkap ibu"
                      value={formData.nama_ibu || ""}
                      onChange={(e) => setFormData({ ...formData, nama_ibu: e.target.value })}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nik_ibu" className="text-xs font-medium">NIK Ibu</Label>
                    <Input
                      id="nik_ibu"
                      placeholder="16 digit NIK"
                      maxLength={16}
                      value={formData.nik_ibu || ""}
                      onChange={(e) => setFormData({ ...formData, nik_ibu: e.target.value.replace(/\D/g, "") })}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">Pekerjaan Ibu</Label>
                    <Combobox
                      options={occupationOptions}
                      value={formData.pekerjaan_ibu || ""}
                      onValueChange={(value) => setFormData({ ...formData, pekerjaan_ibu: value })}
                      placeholder="Pilih pekerjaan"
                      className="h-9"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case 4: // Jaminan
        return (
          <div className="space-y-6">
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Jenis Jaminan/Pembayaran</Label>
                  <Combobox
                    options={insuranceOptions}
                    value={formData.jenis_jaminan || "Umum"}
                    onValueChange={(value) => setFormData({ ...formData, jenis_jaminan: value as any })}
                    placeholder="Pilih jenis jaminan"
                    className="h-9"
                  />
                </div>

                {(formData.jenis_jaminan === "BPJS" || formData.jenis_jaminan === "JKN") && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="no_bpjs" className="text-xs font-medium">Nomor BPJS</Label>
                      <Input
                        id="no_bpjs"
                        placeholder="13 digit nomor BPJS"
                        maxLength={20}
                        value={formData.no_bpjs || ""}
                        onChange={(e) => setFormData({ ...formData, no_bpjs: e.target.value })}
                        className="h-9 text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Kelas BPJS</Label>
                      <Combobox
                        options={bpjsClassOptions}
                        value={formData.kelas_bpjs || ""}
                        onValueChange={(value) => setFormData({ ...formData, kelas_bpjs: value })}
                        placeholder="Pilih kelas"
                        className="h-9"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="faskes_tingkat_1" className="text-xs font-medium">Faskes Tingkat 1</Label>
                      <Input
                        id="faskes_tingkat_1"
                        placeholder="Nama Puskesmas/Klinik"
                        value={formData.faskes_tingkat_1 || ""}
                        onChange={(e) => setFormData({ ...formData, faskes_tingkat_1: e.target.value })}
                        className="h-9 text-sm"
                      />
                    </div>
                  </>
                )}

                {formData.jenis_jaminan === "Asuransi Swasta" && (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="nama_asuransi" className="text-xs font-medium">Nama Asuransi</Label>
                      <Input
                        id="nama_asuransi"
                        placeholder="Nama perusahaan asuransi"
                        value={formData.nama_asuransi || ""}
                        onChange={(e) => setFormData({ ...formData, nama_asuransi: e.target.value })}
                        className="h-9 text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="no_polis_asuransi" className="text-xs font-medium">Nomor Polis</Label>
                      <Input
                        id="no_polis_asuransi"
                        placeholder="Nomor polis asuransi"
                        value={formData.no_polis_asuransi || ""}
                        onChange={(e) => setFormData({ ...formData, no_polis_asuransi: e.target.value })}
                        className="h-9 text-sm"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Masa Berlaku</Label>
                      <DatePickerDropdown
                        value={formData.masa_berlaku_asuransi}
                        onChange={(v) => setFormData({ ...formData, masa_berlaku_asuransi: v })}
                        minYear={new Date().getFullYear()}
                        maxYear={new Date().getFullYear() + 20}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        );

      case 5: // Medis
        return (
          <div className="space-y-6">
            <div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="alergi_obat" className="text-xs font-medium">Alergi Obat</Label>
                  <Textarea
                    id="alergi_obat"
                    placeholder="Daftar obat yang menyebabkan alergi"
                    value={formData.alergi_obat || ""}
                    onChange={(e) => setFormData({ ...formData, alergi_obat: e.target.value })}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="alergi_makanan" className="text-xs font-medium">Alergi Makanan</Label>
                  <Textarea
                    id="alergi_makanan"
                    placeholder="Daftar makanan yang menyebabkan alergi"
                    value={formData.alergi_makanan || ""}
                    onChange={(e) => setFormData({ ...formData, alergi_makanan: e.target.value })}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="alergi_lainnya" className="text-xs font-medium">Alergi Lainnya</Label>
                  <Textarea
                    id="alergi_lainnya"
                    placeholder="Alergi lainnya (debu, serbuk sari, dll)"
                    value={formData.alergi_lainnya || ""}
                    onChange={(e) => setFormData({ ...formData, alergi_lainnya: e.target.value })}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="penyakit_kronis" className="text-xs font-medium">Penyakit Kronis</Label>
                  <Textarea
                    id="penyakit_kronis"
                    placeholder="Diabetes, Hipertensi, Asma, dll"
                    value={formData.penyakit_kronis || ""}
                    onChange={(e) => setFormData({ ...formData, penyakit_kronis: e.target.value })}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="riwayat_operasi" className="text-xs font-medium">Riwayat Operasi</Label>
                  <Textarea
                    id="riwayat_operasi"
                    placeholder="Operasi yang pernah dilakukan"
                    value={formData.riwayat_operasi || ""}
                    onChange={(e) => setFormData({ ...formData, riwayat_operasi: e.target.value })}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="obat_rutin" className="text-xs font-medium">Obat yang Sedang Dikonsumsi</Label>
                  <Textarea
                    id="obat_rutin"
                    placeholder="Obat-obatan yang rutin dikonsumsi"
                    value={formData.obat_rutin || ""}
                    onChange={(e) => setFormData({ ...formData, obat_rutin: e.target.value })}
                    className="text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="disabilitas" className="text-xs font-medium">Disabilitas</Label>
                  <Input
                    id="disabilitas"
                    placeholder="Jenis disabilitas (jika ada)"
                    value={formData.disabilitas || ""}
                    onChange={(e) => setFormData({ ...formData, disabilitas: e.target.value })}
                    className="h-9 text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="catatan_khusus" className="text-xs font-medium">Catatan Khusus</Label>
                  <Textarea
                    id="catatan_khusus"
                    placeholder="Catatan khusus lainnya"
                    value={formData.catatan_khusus || ""}
                    onChange={(e) => setFormData({ ...formData, catatan_khusus: e.target.value })}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="grid gap-4">
        <Card className="shadow-md">
          <CardHeader className="border-b bg-muted/50">
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => navigate(`/patients/${id}`)}
                className="h-9 w-9"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <CardTitle className="text-base font-semibold">
                  Edit Data Pasien
                </CardTitle>
                <CardDescription>
                  Perbarui data pasien sesuai dengan standar Kemenkes RI
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {/* Wizard Steps - Underline Style */}
            <div className="mb-8">
              <div className="flex items-center justify-between">
                {steps.map((step, index) => {
                  const StepIcon = step.icon;
                  const isActive = index === currentStep;
                  const isCompleted = index < currentStep;
                  
                  return (
                    <div key={step.id} className="flex flex-col items-center flex-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (index < currentStep || validateStep(currentStep)) {
                            setCurrentStep(index);
                          }
                        }}
                        className={cn(
                          "flex flex-col items-center gap-2 pb-3 border-b-2 w-full transition-colors",
                          isActive && "border-primary text-primary",
                          isCompleted && "border-green-500 text-green-600",
                          !isActive && !isCompleted && "border-transparent text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <div className={cn(
                          "flex items-center justify-center w-10 h-10 rounded-full transition-colors",
                          isActive && "bg-primary text-primary-foreground",
                          isCompleted && "bg-green-500 text-white",
                          !isActive && !isCompleted && "bg-muted"
                        )}>
                          {isCompleted ? (
                            <Check className="h-5 w-5" />
                          ) : (
                            <StepIcon className="h-5 w-5" />
                          )}
                        </div>
                        <span className={cn(
                          "text-xs font-medium hidden md:block",
                          isActive && "text-primary",
                          isCompleted && "text-green-600"
                        )}>
                          {step.label}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Step Content */}
            <div className="min-h-[400px]">
              {renderStepContent()}
            </div>

            {/* Navigation Buttons */}
            <div className="flex justify-between mt-8 pt-6 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={handlePrev}
                disabled={currentStep === 0}
                className="h-9"
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Sebelumnya
              </Button>
              
              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/patients/${id}`)}
                  className="h-9"
                >
                  Batal
                </Button>
                
                {currentStep < steps.length - 1 ? (
                  <Button
                    type="button"
                    onClick={handleNext}
                    className="h-9"
                  >
                    Selanjutnya
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={handleSubmit}
                    disabled={loading}
                    className="h-9 min-w-24"
                  >
                    {loading ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="mr-2 h-4 w-4" />
                    )}
                    Perbarui
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
