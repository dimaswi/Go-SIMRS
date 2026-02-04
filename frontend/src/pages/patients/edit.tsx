import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { DatePickerDropdown } from "@/components/ui/date-picker-dropdown";
import { Checkbox } from "@/components/ui/checkbox";
import { masterDataApi, regionsApi, patientsApi } from "@/lib/api";
import type {
  PatientRequest,
  MasterData,
  Province,
  Regency,
  District,
  Village,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { setPageTitle } from "@/lib/page-title";
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
  Keyboard,
  X,
} from "lucide-react";

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
  const formRef = useRef<HTMLFormElement>(null);

  const [formData, setFormData] = useState<PatientRequest>(initialFormData);
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingMaster, setLoadingMaster] = useState(true);
  const [sameAddress, setSameAddress] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Age input state
  const [ageYears, setAgeYears] = useState<string>("");
  const [ageMonths, setAgeMonths] = useState<string>("");
  const [ageDays, setAgeDays] = useState<string>("");

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

  // Calculate date of birth from age
  const calculateDOBFromAge = useCallback(
    (years: string, months: string, days: string) => {
      const y = parseInt(years) || 0;
      const m = parseInt(months) || 0;
      const d = parseInt(days) || 0;

      if (y === 0 && m === 0 && d === 0) return;

      const today = new Date();
      const dob = new Date(
        today.getFullYear() - y,
        today.getMonth() - m,
        today.getDate() - d
      );

      const dobString = dob.toISOString().split("T")[0];
      setFormData((prev) => ({ ...prev, tanggal_lahir: dobString }));
    },
    []
  );

  // Calculate age from date of birth
  const calculateAgeFromDOB = useCallback((dob: string | undefined) => {
    if (!dob) {
      setAgeYears("");
      setAgeMonths("");
      setAgeDays("");
      return;
    }

    const birthDate = new Date(dob);
    const today = new Date();

    let years = today.getFullYear() - birthDate.getFullYear();
    let months = today.getMonth() - birthDate.getMonth();
    let days = today.getDate() - birthDate.getDate();

    if (days < 0) {
      months--;
      const lastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
      days += lastMonth.getDate();
    }

    if (months < 0) {
      years--;
      months += 12;
    }

    setAgeYears(years.toString());
    setAgeMonths(months.toString());
    setAgeDays(days.toString());
  }, []);

  // Handle age input change
  const handleAgeChange = (type: "years" | "months" | "days", value: string) => {
    const numValue = value.replace(/\D/g, "");

    if (type === "years") {
      setAgeYears(numValue);
      calculateDOBFromAge(numValue, ageMonths, ageDays);
    } else if (type === "months") {
      setAgeMonths(numValue);
      calculateDOBFromAge(ageYears, numValue, ageDays);
    } else {
      setAgeDays(numValue);
      calculateDOBFromAge(ageYears, ageMonths, numValue);
    }
  };

  // Handle DOB change
  const handleDOBChange = (value: string | undefined) => {
    setFormData((prev) => ({ ...prev, tanggal_lahir: value }));
    calculateAgeFromDOB(value);
  };

  const loadPatientData = async (provincesData: typeof provinces) => {
    if (!id) return;
    setLoadingData(true);
    try {
      const response = await patientsApi.getById(parseInt(id));
      const patient = response.data;
      if (patient) {
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

        // Calculate age from DOB
        if (patient.tanggal_lahir) {
          calculateAgeFromDOB(patient.tanggal_lahir);
        }

        // Load region data for KTP
        if (patient.provinsi_ktp) {
          try {
            const provinceKTP = provincesData.find((p) => p.name === patient.provinsi_ktp);
            if (provinceKTP) {
              const regenciesRes = await regionsApi.getRegencies(provinceKTP.id);
              setRegenciesKTP(regenciesRes.data.data || []);

              if (patient.kota_ktp) {
                const regencyKTP = (regenciesRes.data.data || []).find(
                  (r: Regency) => r.name === patient.kota_ktp
                );
                if (regencyKTP) {
                  const districtsRes = await regionsApi.getDistricts(regencyKTP.id);
                  setDistrictsKTP(districtsRes.data.data || []);

                  if (patient.kecamatan_ktp) {
                    const districtKTP = (districtsRes.data.data || []).find(
                      (d: District) => d.name === patient.kecamatan_ktp
                    );
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

        // Load region data for Domisili
        if (patient.provinsi_domisili) {
          try {
            const provinceDomisili = provincesData.find(
              (p) => p.name === patient.provinsi_domisili
            );
            if (provinceDomisili) {
              const regenciesRes = await regionsApi.getRegencies(provinceDomisili.id);
              setRegenciesDomisili(regenciesRes.data.data || []);

              if (patient.kota_domisili) {
                const regencyDomisili = (regenciesRes.data.data || []).find(
                  (r: Regency) => r.name === patient.kota_domisili
                );
                if (regencyDomisili) {
                  const districtsRes = await regionsApi.getDistricts(regencyDomisili.id);
                  setDistrictsDomisili(districtsRes.data.data || []);

                  if (patient.kecamatan_domisili) {
                    const districtDomisili = (districtsRes.data.data || []).find(
                      (d: District) => d.name === patient.kecamatan_domisili
                    );
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case "s":
            e.preventDefault();
            handleSubmit();
            break;
          case "b":
            e.preventDefault();
            navigate(`/patients/${id}`);
            break;
          case "/":
            e.preventDefault();
            setShowShortcuts((prev) => !prev);
            break;
        }
      }

      if (e.key === "Escape") {
        if (showShortcuts) {
          setShowShortcuts(false);
        } else {
          navigate(`/patients/${id}`);
        }
      }

      if (e.key === "F1") {
        e.preventDefault();
        setShowShortcuts(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate, showShortcuts, id]);

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
    setFormData({
      ...formData,
      provinsi_ktp: value,
      kota_ktp: "",
      kecamatan_ktp: "",
      kelurahan_ktp: "",
    });
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
    setFormData({
      ...formData,
      kota_ktp: value,
      kecamatan_ktp: "",
      kelurahan_ktp: "",
    });
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
    setFormData({
      ...formData,
      provinsi_domisili: value,
      kota_domisili: "",
      kecamatan_domisili: "",
      kelurahan_domisili: "",
    });
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
    setFormData({
      ...formData,
      kota_domisili: value,
      kecamatan_domisili: "",
      kelurahan_domisili: "",
    });
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
    setFormData({
      ...formData,
      kecamatan_domisili: value,
      kelurahan_domisili: "",
    });
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
  }, [sameAddress, regenciesKTP, districtsKTP, villagesKTP]);

  const handleSubmit = async () => {
    if (!formData.nama_lengkap) {
      toast({
        variant: "destructive",
        title: "Validasi",
        description: "Nama lengkap wajib diisi",
      });
      return;
    }

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

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center"
          onClick={() => setShowShortcuts(false)}
        >
          <div
            className="bg-background rounded-lg shadow-xl p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Keyboard className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold">Keyboard Shortcuts</h3>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setShowShortcuts(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm">Simpan Perubahan</span>
                <div className="flex gap-1">
                  <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Ctrl</kbd>
                  <span className="text-muted-foreground">+</span>
                  <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">S</kbd>
                </div>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm">Kembali ke Detail</span>
                <div className="flex gap-1">
                  <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Ctrl</kbd>
                  <span className="text-muted-foreground">+</span>
                  <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">B</kbd>
                </div>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm">Batal / Tutup</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Esc</kbd>
              </div>
              <div className="flex items-center justify-between py-2 border-b">
                <span className="text-sm">Tampilkan Shortcuts</span>
                <div className="flex gap-1">
                  <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">F1</kbd>
                  <span className="text-muted-foreground">atau</span>
                  <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Ctrl</kbd>
                  <span className="text-muted-foreground">+</span>
                  <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">/</kbd>
                </div>
              </div>
              <div className="flex items-center justify-between py-2">
                <span className="text-sm">Pindah Field</span>
                <kbd className="px-2 py-1 bg-muted rounded text-xs font-mono">Tab</kbd>
              </div>
            </div>
          </div>
        </div>
      )}

      <form
        ref={formRef}
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <Card className="shadow-md">
          <CardHeader className="border-b bg-muted/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => navigate(`/patients/${id}`)}
                  className="h-9 w-9"
                  tabIndex={-1}
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                  <CardTitle className="text-base font-semibold">Edit Data Pasien</CardTitle>
                  <CardDescription>Perbarui data pasien sesuai dengan standar Kemenkes RI</CardDescription>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowShortcuts(true)}
                className="text-muted-foreground"
                tabIndex={-1}
              >
                <Keyboard className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Shortcuts</span>
                <kbd className="ml-2 px-1.5 py-0.5 bg-muted rounded text-xs font-mono hidden sm:inline">F1</kbd>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-8">
            {/* Section: Identitas */}
            <section className="pb-6">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b">
                <User className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-semibold text-primary">DATA IDENTITAS</h3>
              </div>
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
                    tabIndex={1}
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
                    tabIndex={2}
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
                    tabIndex={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Jenis Kelamin *</Label>
                  <Combobox
                    options={genderOptions}
                    value={formData.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan"}
                    onValueChange={(value) =>
                      setFormData({ ...formData, jenis_kelamin: value === "Laki-laki" ? "L" : "P" })
                    }
                    placeholder="Pilih jenis kelamin"
                    className="h-9"
                    tabIndex={4}
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
                    tabIndex={5}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Tanggal Lahir</Label>
                  <DatePickerDropdown
                    value={formData.tanggal_lahir}
                    onChange={handleDOBChange}
                    disableFuture
                    tabIndex={6}
                  />
                </div>

                {/* Age Input Fields */}
                <div className="space-y-2 lg:col-span-1">
                  <Label className="text-xs font-medium">Umur (auto-hitung tanggal lahir)</Label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <div className="relative">
                        <Input
                          placeholder="0"
                          value={ageYears}
                          onChange={(e) => handleAgeChange("years", e.target.value)}
                          className="h-9 text-sm pr-12"
                          tabIndex={9}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Thn</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="relative">
                        <Input
                          placeholder="0"
                          value={ageMonths}
                          onChange={(e) => handleAgeChange("months", e.target.value)}
                          className="h-9 text-sm pr-10"
                          tabIndex={10}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Bln</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="relative">
                        <Input
                          placeholder="0"
                          value={ageDays}
                          onChange={(e) => handleAgeChange("days", e.target.value)}
                          className="h-9 text-sm pr-10"
                          tabIndex={11}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">Hari</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-medium">Golongan Darah</Label>
                  <Combobox
                    options={bloodTypeOptions}
                    value={formData.golongan_darah || ""}
                    onValueChange={(value) => setFormData({ ...formData, golongan_darah: value as any })}
                    placeholder="Pilih golongan darah"
                    className="h-9"
                    tabIndex={12}
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
                    tabIndex={13}
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
                    tabIndex={14}
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
                    tabIndex={15}
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
                    tabIndex={16}
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
                    tabIndex={17}
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
                    tabIndex={18}
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
                    tabIndex={19}
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
                    tabIndex={20}
                  />
                </div>
              </div>
            </section>

            {/* Section: Alamat KTP */}
            <section className="pb-6">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b">
                <MapPin className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-semibold text-primary">ALAMAT KTP</h3>
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="alamat_ktp" className="text-xs font-medium">Alamat Lengkap</Label>
                  <Textarea
                    id="alamat_ktp"
                    placeholder="Jalan, Nomor Rumah, Gang, dll"
                    value={formData.alamat_ktp || ""}
                    onChange={(e) => setFormData({ ...formData, alamat_ktp: e.target.value })}
                    className="text-sm"
                    tabIndex={21}
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
                      tabIndex={22}
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
                      tabIndex={23}
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
                      tabIndex={24}
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
                      tabIndex={25}
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
                      tabIndex={26}
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
                      tabIndex={27}
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
                      tabIndex={28}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Section: Alamat Domisili */}
            <section className="pb-6">
              <div className="flex items-center justify-between mb-4 pb-2 border-b">
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  <h3 className="text-sm font-semibold text-primary">ALAMAT DOMISILI</h3>
                </div>
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
                    tabIndex={29}
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
                      tabIndex={30}
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
                      tabIndex={31}
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
                      tabIndex={32}
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
                      tabIndex={33}
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
                      tabIndex={34}
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
                      tabIndex={35}
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
                      tabIndex={36}
                    />
                  </div>
                </div>
              </div>
            </section>

            {/* Section: Kontak */}
            <section className="pb-6">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b">
                <Phone className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-semibold text-primary">DATA KONTAK</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="no_telepon" className="text-xs font-medium">Nomor Telepon Rumah</Label>
                  <Input
                    id="no_telepon"
                    placeholder="021-xxxxxxx"
                    value={formData.no_telepon || ""}
                    onChange={(e) => setFormData({ ...formData, no_telepon: e.target.value })}
                    className="h-9 text-sm"
                    tabIndex={37}
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
                    tabIndex={38}
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
                    tabIndex={39}
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
                    tabIndex={40}
                  />
                </div>
              </div>
            </section>

            {/* Section: Keluarga */}
            <section className="pb-6">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b">
                <Users className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-semibold text-primary">DATA KELUARGA / PENANGGUNG JAWAB</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="nama_penanggung_jawab" className="text-xs font-medium">Nama Penanggung Jawab</Label>
                  <Input
                    id="nama_penanggung_jawab"
                    placeholder="Nama lengkap"
                    value={formData.nama_penanggung_jawab || ""}
                    onChange={(e) => setFormData({ ...formData, nama_penanggung_jawab: e.target.value })}
                    className="h-9 text-sm"
                    tabIndex={41}
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
                    tabIndex={42}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="nik_penanggung_jawab" className="text-xs font-medium">NIK Penanggung Jawab</Label>
                  <Input
                    id="nik_penanggung_jawab"
                    placeholder="16 digit NIK"
                    maxLength={16}
                    value={formData.nik_penanggung_jawab || ""}
                    onChange={(e) =>
                      setFormData({ ...formData, nik_penanggung_jawab: e.target.value.replace(/\D/g, "") })
                    }
                    className="h-9 text-sm"
                    tabIndex={43}
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
                    tabIndex={44}
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
                    tabIndex={45}
                  />
                </div>
              </div>

              {/* Data Orang Tua */}
              <div className="mt-6 pt-4 border-t">
                <h4 className="text-xs font-semibold text-muted-foreground mb-4">DATA ORANG TUA (UNTUK PASIEN ANAK)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h5 className="text-xs font-semibold">Data Ayah</h5>
                    <div className="space-y-2">
                      <Label htmlFor="nama_ayah" className="text-xs font-medium">Nama Ayah</Label>
                      <Input
                        id="nama_ayah"
                        placeholder="Nama lengkap ayah"
                        value={formData.nama_ayah || ""}
                        onChange={(e) => setFormData({ ...formData, nama_ayah: e.target.value })}
                        className="h-9 text-sm"
                        tabIndex={46}
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
                        tabIndex={47}
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
                        tabIndex={48}
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h5 className="text-xs font-semibold">Data Ibu</h5>
                    <div className="space-y-2">
                      <Label htmlFor="nama_ibu" className="text-xs font-medium">Nama Ibu</Label>
                      <Input
                        id="nama_ibu"
                        placeholder="Nama lengkap ibu"
                        value={formData.nama_ibu || ""}
                        onChange={(e) => setFormData({ ...formData, nama_ibu: e.target.value })}
                        className="h-9 text-sm"
                        tabIndex={49}
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
                        tabIndex={50}
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
                        tabIndex={51}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Section: Jaminan */}
            <section className="pb-6">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b">
                <Shield className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-semibold text-primary">DATA JAMINAN / ASURANSI</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Jenis Jaminan/Pembayaran</Label>
                  <Combobox
                    options={insuranceOptions}
                    value={formData.jenis_jaminan || "Umum"}
                    onValueChange={(value) => setFormData({ ...formData, jenis_jaminan: value as any })}
                    placeholder="Pilih jenis jaminan"
                    className="h-9"
                    tabIndex={52}
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
                        tabIndex={53}
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
                        tabIndex={54}
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
                        tabIndex={55}
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
                        tabIndex={53}
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
                        tabIndex={54}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium">Masa Berlaku</Label>
                      <DatePickerDropdown
                        value={formData.masa_berlaku_asuransi}
                        onChange={(v) => setFormData({ ...formData, masa_berlaku_asuransi: v })}
                        minYear={new Date().getFullYear()}
                        maxYear={new Date().getFullYear() + 20}
                        tabIndex={55}
                      />
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* Section: Medis */}
            <section className="pb-6">
              <div className="flex items-center gap-2 mb-4 pb-2 border-b">
                <Heart className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-semibold text-primary">DATA MEDIS</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="alergi_obat" className="text-xs font-medium">Alergi Obat</Label>
                  <Textarea
                    id="alergi_obat"
                    placeholder="Daftar obat yang menyebabkan alergi"
                    value={formData.alergi_obat || ""}
                    onChange={(e) => setFormData({ ...formData, alergi_obat: e.target.value })}
                    className="text-sm"
                    tabIndex={56}
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
                    tabIndex={57}
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
                    tabIndex={58}
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
                    tabIndex={59}
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
                    tabIndex={60}
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
                    tabIndex={61}
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
                    tabIndex={62}
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
                    tabIndex={63}
                  />
                </div>
              </div>
            </section>

            {/* Action Buttons */}
            <div className="flex justify-between items-center pt-6 border-t sticky bottom-0 bg-background pb-2">
              <div className="text-xs text-muted-foreground hidden sm:flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Ctrl+S</kbd>
                  <span>Simpan</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Esc</kbd>
                  <span>Batal</span>
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono">Tab</kbd>
                  <span>Pindah Field</span>
                </span>
              </div>

              <div className="flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(`/patients/${id}`)}
                  className="h-9"
                  tabIndex={-1}
                >
                  Batal (ESC)
                </Button>

                <Button type="submit" disabled={loading} className="h-9 min-w-32" tabIndex={64}>
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Perbarui (CTRL + S)
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
