import { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import { DatePickerDropdown } from "@/components/ui/date-picker-dropdown";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { regionsApi } from "@/lib/api";
import { vclaimApi, type VClaimPeserta } from "@/lib/api/vclaim";
import type {
  PatientRequest,
  MasterData,
  Province,
  Regency,
  District,
  Village,
  BloodType,
  RhesusType,
} from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  User,
  MapPin,
  Phone,
  Users,
  Shield,
  Heart,
  CheckCircle2,
  XCircle,
  Search,
} from "lucide-react";

interface PatientCreateFormFieldsProps {
  formData: PatientRequest;
  setFormData: React.Dispatch<React.SetStateAction<PatientRequest>>;
  masterData: Record<string, MasterData[]>;
  provinces: Province[];
  regencies: Regency[];
  sameAddress: boolean;
  setSameAddress: React.Dispatch<React.SetStateAction<boolean>>;
}

export function PatientCreateFormFields({
  formData,
  setFormData,
  masterData,
  provinces,
  regencies,
  sameAddress,
  setSameAddress,
}: PatientCreateFormFieldsProps) {
  const { toast } = useToast();
  const defaultsInitializedRef = useRef(false);

  // BPJS lookup state
  const [bpjsLoading, setBpjsLoading] = useState(false);
  const [bpjsData, setBpjsData] = useState<VClaimPeserta | null>(null);
  const [bpjsError, setBpjsError] = useState<string | null>(null);
  const [bpjsApplied, setBpjsApplied] = useState(false);

  // Age input state
  const [ageYears, setAgeYears] = useState<string>("");
  const [ageMonths, setAgeMonths] = useState<string>("");
  const [ageDays, setAgeDays] = useState<string>("");

  // Region cascading state
  const [regenciesKTP, setRegenciesKTP] = useState<Regency[]>([]);
  const [districtsKTP, setDistrictsKTP] = useState<District[]>([]);
  const [villagesKTP, setVillagesKTP] = useState<Village[]>([]);
  const [regenciesDomisili, setRegenciesDomisili] = useState<Regency[]>([]);
  const [districtsDomisili, setDistrictsDomisili] = useState<District[]>([]);
  const [villagesDomisili, setVillagesDomisili] = useState<Village[]>([]);

  // Initialize default region (Jawa Timur -> Bojonegoro) and blood/rhesus defaults
  useEffect(() => {
    if (defaultsInitializedRef.current || provinces.length === 0) return;
    defaultsInitializedRef.current = true;

    const applyDefaults = async () => {
      const defaultProvince = provinces.find((p) => p.name === "JAWA TIMUR");
      let defaultProvId = "";
      let defaultKotaId = "";

      if (defaultProvince) {
        defaultProvId = defaultProvince.id;
        try {
          const resRegencies = await regionsApi.getRegencies(defaultProvId);
          const ktpRegencies = resRegencies.data.data || [];
          setRegenciesKTP(ktpRegencies);

          const defaultRegency = ktpRegencies.find(
            (r: Regency) => r.name === "KABUPATEN BOJONEGORO" || r.name === "KAB. BOJONEGORO"
          );
          if (defaultRegency) {
            defaultKotaId = defaultRegency.id;
            const resDistricts = await regionsApi.getDistricts(defaultKotaId);
            setDistrictsKTP(resDistricts.data.data || []);
          }
        } catch (err) {
          console.error("Failed to load default regions:", err);
        }
      }

      const defaultBlood = (masterData.blood_type?.find(
        (b) => b.name.toLowerCase() === "tidak diketahui"
      )?.name || "Tidak Diketahui") as BloodType;
      const defaultRhesus = (masterData.rhesus_type?.find(
        (r) => r.name.toLowerCase() === "tidak diketahui"
      )?.name || "Tidak Diketahui") as RhesusType;

      setFormData((prev) => ({
        ...prev,
        provinsi_ktp: prev.provinsi_ktp || defaultProvId,
        kota_ktp: prev.kota_ktp || defaultKotaId,
        golongan_darah: prev.golongan_darah || defaultBlood,
        rhesus: prev.rhesus || defaultRhesus,
      }));
    };

    applyDefaults();
  }, [provinces, masterData, setFormData]);

  // Calculate date of birth from age
  const calculateDOBFromAge = useCallback(
    (years: string, months: string, days: string) => {
      const y = parseInt(years, 10) || 0;
      const m = parseInt(months, 10) || 0;
      const d = parseInt(days, 10) || 0;
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
    [setFormData]
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
    if (Number.isNaN(birthDate.getTime())) return;
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

  const handleDOBChange = (value: string | undefined) => {
    setFormData((prev) => ({ ...prev, tanggal_lahir: value }));
    calculateAgeFromDOB(value);
  };

  // NIK parser when NIK reaches 16 digits (local only, does not hit BPJS automatically)
  useEffect(() => {
    const nik = formData.nik?.replace(/\D/g, "") || "";
    setBpjsData(null);
    setBpjsError(null);
    setBpjsApplied(false);

    if (nik.length !== 16) {
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const regencyCode = nik.substring(0, 4);
        const dateStr = nik.substring(6, 8);
        const monthStr = nik.substring(8, 10);
        const yearStr = nik.substring(10, 12);

        let dateNum = parseInt(dateStr, 10);
        const gender = dateNum > 40 ? "P" : "L";
        if (dateNum > 40) dateNum -= 40;

        let yearNum = parseInt(yearStr, 10);
        const currentYear = new Date().getFullYear();
        if (yearNum > currentYear % 100) {
          yearNum += 1900;
        } else {
          yearNum += 2000;
        }

        if (
          dateNum >= 1 &&
          dateNum <= 31 &&
          parseInt(monthStr, 10) >= 1 &&
          parseInt(monthStr, 10) <= 12
        ) {
          const dob = `${yearNum}-${monthStr.padStart(2, "0")}-${String(dateNum).padStart(2, "0")}`;

          let tempatLahir = "";
          try {
            const regencyRes = await regionsApi.getRegency(regencyCode);
            if (regencyRes.data?.data?.name) {
              tempatLahir = regencyRes.data.data.name;
            }
          } catch {
            // Ignore regency lookup failure
          }

          setFormData((prev) => ({
            ...prev,
            jenis_kelamin: gender,
            tanggal_lahir: prev.tanggal_lahir || dob,
            tempat_lahir: prev.tempat_lahir || tempatLahir,
          }));

          calculateAgeFromDOB(formData.tanggal_lahir || dob);
        }
      } catch (e) {
        console.error("Failed to parse NIK:", e);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [formData.nik]);

  // Manual BPJS VClaim lookup by NIK when search button is clicked
  const handleLookupBpjsByNik = useCallback(async () => {
    const nik = formData.nik?.replace(/\D/g, "") || "";
    if (nik.length !== 16) {
      toast({
        variant: "destructive",
        title: "NIK Tidak Valid",
        description: "Masukkan 16 digit NIK terlebih dahulu untuk mencari data BPJS.",
      });
      return;
    }

    setBpjsLoading(true);
    setBpjsError(null);
    setBpjsData(null);
    setBpjsApplied(false);

    try {
      const today = new Date().toISOString().split("T")[0];
      const res = await vclaimApi.getPesertaByNIK(nik, today);
      const peserta = res.data.data;
      if (peserta) {
        setBpjsData(peserta);
      } else {
        setBpjsError("Data peserta tidak ditemukan di BPJS");
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || "Gagal mengambil data BPJS";
      setBpjsError(msg);
    } finally {
      setBpjsLoading(false);
    }
  }, [formData.nik, toast]);

  const applyBpjsData = useCallback(() => {
    if (!bpjsData) return;
    const kelasMap: Record<string, string> = { "1": "Kelas 1", "2": "Kelas 2", "3": "Kelas 3" };

    setFormData((prev) => ({
      ...prev,
      nama_lengkap: prev.nama_lengkap || bpjsData.nama || "",
      jenis_kelamin: bpjsData.sex === "P" ? "P" : "L",
      tanggal_lahir: prev.tanggal_lahir || bpjsData.tglLahir || "",
      jenis_jaminan: "BPJS",
      no_bpjs: bpjsData.noKartu || "",
      kelas_bpjs: kelasMap[bpjsData.hakKelas?.kode] || bpjsData.hakKelas?.keterangan || "",
      faskes_tingkat_1: bpjsData.provUmum?.nmProvider || "",
      no_telepon: prev.no_telepon || bpjsData.mr?.noTelepon || "",
    }));

    if (!formData.tanggal_lahir && bpjsData.tglLahir) {
      calculateAgeFromDOB(bpjsData.tglLahir);
    }

    setBpjsApplied(true);
    toast({
      variant: "success",
      title: "Data BPJS diterapkan",
      description: `Data peserta ${bpjsData.nama} berhasil diisi ke form`,
    });
  }, [bpjsData, formData.tanggal_lahir, calculateAgeFromDOB, setFormData, toast]);

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
  }, [
    sameAddress,
    formData.alamat_ktp,
    formData.rt_ktp,
    formData.rw_ktp,
    formData.kelurahan_ktp,
    formData.kecamatan_ktp,
    formData.kota_ktp,
    formData.provinsi_ktp,
    formData.kode_pos_ktp,
    regenciesKTP,
    districtsKTP,
    villagesKTP,
    setFormData,
  ]);

  const toOptions = (data: MasterData[] | undefined) =>
    data ? data.map((item) => ({ value: item.name, label: item.name })) : [];

  const toRegionOptions = (data: { id: string; name: string }[] | undefined) =>
    data ? data.map((item) => ({ value: item.id, label: item.name })) : [];

  const handleProvinceKTPChange = async (value: string) => {
    setFormData((prev) => ({
      ...prev,
      provinsi_ktp: value,
      kota_ktp: "",
      kecamatan_ktp: "",
      kelurahan_ktp: "",
    }));
    setDistrictsKTP([]);
    setVillagesKTP([]);
    const province = provinces.find((p) => p.id === value);
    if (province) {
      try {
        const res = await regionsApi.getRegencies(province.id);
        setRegenciesKTP(res.data.data || []);
      } catch (error) {
        console.error("Failed to load regencies:", error);
      }
    }
  };

  const handleRegencyKTPChange = async (value: string) => {
    setFormData((prev) => ({
      ...prev,
      kota_ktp: value,
      kecamatan_ktp: "",
      kelurahan_ktp: "",
    }));
    setVillagesKTP([]);
    const regency = regenciesKTP.find((r) => r.id === value);
    if (regency) {
      try {
        const res = await regionsApi.getDistricts(regency.id);
        setDistrictsKTP(res.data.data || []);
      } catch (error) {
        console.error("Failed to load districts:", error);
      }
    }
  };

  const handleDistrictKTPChange = async (value: string) => {
    setFormData((prev) => ({ ...prev, kecamatan_ktp: value, kelurahan_ktp: "" }));
    const district = districtsKTP.find((d) => d.id === value);
    if (district) {
      try {
        const res = await regionsApi.getVillages(district.id);
        setVillagesKTP(res.data.data || []);
      } catch (error) {
        console.error("Failed to load villages:", error);
      }
    }
  };

  const handleProvinceDomisiliChange = async (value: string) => {
    setFormData((prev) => ({
      ...prev,
      provinsi_domisili: value,
      kota_domisili: "",
      kecamatan_domisili: "",
      kelurahan_domisili: "",
    }));
    setDistrictsDomisili([]);
    setVillagesDomisili([]);
    const province = provinces.find((p) => p.id === value);
    if (province) {
      try {
        const res = await regionsApi.getRegencies(province.id);
        setRegenciesDomisili(res.data.data || []);
      } catch (error) {
        console.error("Failed to load regencies:", error);
      }
    }
  };

  const handleRegencyDomisiliChange = async (value: string) => {
    setFormData((prev) => ({
      ...prev,
      kota_domisili: value,
      kecamatan_domisili: "",
      kelurahan_domisili: "",
    }));
    setVillagesDomisili([]);
    const regency = regenciesDomisili.find((r) => r.id === value);
    if (regency) {
      try {
        const res = await regionsApi.getDistricts(regency.id);
        setDistrictsDomisili(res.data.data || []);
      } catch (error) {
        console.error("Failed to load districts:", error);
      }
    }
  };

  const handleDistrictDomisiliChange = async (value: string) => {
    setFormData((prev) => ({ ...prev, kecamatan_domisili: value, kelurahan_domisili: "" }));
    const district = districtsDomisili.find((d) => d.id === value);
    if (district) {
      try {
        const res = await regionsApi.getVillages(district.id);
        setVillagesDomisili(res.data.data || []);
      } catch (error) {
        console.error("Failed to load villages:", error);
      }
    }
  };

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

  const provinceOptions = toRegionOptions(provinces);
  const regenciesOptions = toRegionOptions(regencies);
  const regencyKTPOptions = toRegionOptions(regenciesKTP);
  const districtKTPOptions = toRegionOptions(districtsKTP);
  const villageKTPOptions = toRegionOptions(villagesKTP);
  const regencyDomisiliOptions = toRegionOptions(regenciesDomisili);
  const districtDomisiliOptions = toRegionOptions(districtsDomisili);
  const villageDomisiliOptions = toRegionOptions(villagesDomisili);

  return (
    <div className="space-y-6 [&_label]:tracking-[0.01em] [&_input]:h-9">
      {/* Section: Identitas */}
      <div className="space-y-3">
        <div className="border-b border-neutral-200 dark:border-neutral-800 pb-2 text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
          <User className="h-3.5 w-3.5" />
          DATA IDENTITAS
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          <div className="space-y-1">
            <Label htmlFor="nik" className="text-xs font-medium">
              NIK
            </Label>
            <div className="flex items-stretch">
              <Input
                id="nik"
                placeholder="16 digit NIK"
                maxLength={16}
                value={formData.nik || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    nik: e.target.value.replace(/\D/g, ""),
                  })
                }
                className="h-9 flex-1 text-sm rounded-r-none border-destructive font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleLookupBpjsByNik}
                disabled={bpjsLoading || (formData.nik?.replace(/\D/g, "").length || 0) !== 16}
                title="Cari data peserta BPJS berdasarkan NIK"
                className="h-9 w-9 shrink-0 rounded-l-none border-l-0 border-destructive"
              >
                {bpjsLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            {bpjsData && !bpjsApplied && (
              <div className="mt-2 rounded-none border border-green-200 bg-green-50 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold text-green-800">Peserta BPJS Ditemukan</p>
                    <p className="text-xs text-green-700 mt-0.5">
                      {bpjsData.nama} &middot; {bpjsData.noKartu} &middot; {bpjsData.statusPeserta?.keterangan}
                    </p>
                    <p className="text-[11px] text-green-600 mt-0.5">
                      Kelas {bpjsData.hakKelas?.keterangan} &middot; {bpjsData.jenisPeserta?.keterangan} &middot;{" "}
                      {bpjsData.provUmum?.nmProvider || "-"}
                    </p>
                  </div>
                </div>
                <Button
                  type="button"
                  size="sm"
                  className="w-full h-8 text-xs rounded-none bg-green-600 hover:bg-green-700"
                  onClick={applyBpjsData}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                  Terapkan Data BPJS ke Form
                </Button>
              </div>
            )}
            {bpjsApplied && bpjsData && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-green-700">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Data BPJS {bpjsData.nama} telah diterapkan
              </div>
            )}
            {bpjsError && formData.nik?.length === 16 && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-amber-600">
                <XCircle className="h-3.5 w-3.5" />
                {bpjsError}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <Label htmlFor="nama_lengkap" className="text-xs font-medium">
              Nama Lengkap *
            </Label>
            <Input
              id="nama_lengkap"
              placeholder="Nama sesuai KTP/Akta"
              value={formData.nama_lengkap}
              onChange={(e) => setFormData({ ...formData, nama_lengkap: e.target.value })}
              required
              autoFocus
              className="h-9 text-sm border-destructive"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="nama_panggilan" className="text-xs font-medium">
              Nama Panggilan
            </Label>
            <Input
              id="nama_panggilan"
              placeholder="Nama panggilan"
              value={formData.nama_panggilan || ""}
              onChange={(e) => setFormData({ ...formData, nama_panggilan: e.target.value })}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium">Jenis Kelamin *</Label>
            <Combobox
              options={genderOptions}
              value={formData.jenis_kelamin === "L" ? "Laki-laki" : "Perempuan"}
              onValueChange={(value) =>
                setFormData({
                  ...formData,
                  jenis_kelamin: value === "Laki-laki" ? "L" : "P",
                })
              }
              placeholder="Pilih jenis kelamin"
              className="h-9 [&>button]:border-destructive"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium">Tempat Lahir *</Label>
            <Combobox
              options={regenciesOptions}
              value={formData.tempat_lahir || ""}
              onValueChange={(value) => setFormData({ ...formData, tempat_lahir: value })}
              placeholder="Pilih kabupaten/kota"
              searchPlaceholder="Cari kabupaten/kota..."
              className="h-9 [&>button]:border-destructive"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium">Tanggal Lahir *</Label>
            <Input
              type="date"
              max={new Date().toISOString().split("T")[0]}
              value={formData.tanggal_lahir ? formData.tanggal_lahir.split("T")[0] : ""}
              onChange={(e) => handleDOBChange(e.target.value)}
              className="h-9 text-sm border-destructive"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium">Umur (auto-hitung tanggal lahir)</Label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Input
                  placeholder="0"
                  value={ageYears}
                  onChange={(e) => handleAgeChange("years", e.target.value)}
                  className="h-9 text-sm pr-10"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  Thn
                </span>
              </div>
              <div className="flex-1 relative">
                <Input
                  placeholder="0"
                  value={ageMonths}
                  onChange={(e) => handleAgeChange("months", e.target.value)}
                  className="h-9 text-sm pr-9"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  Bln
                </span>
              </div>
              <div className="flex-1 relative">
                <Input
                  placeholder="0"
                  value={ageDays}
                  onChange={(e) => handleAgeChange("days", e.target.value)}
                  className="h-9 text-sm pr-9"
                />
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  Hr
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium">Golongan Darah</Label>
            <Combobox
              options={bloodTypeOptions}
              value={formData.golongan_darah || ""}
              onValueChange={(value) =>
                setFormData({ ...formData, golongan_darah: value as BloodType })
              }
              placeholder="Pilih golongan darah"
              className="h-9 [&>button]:border-blue-500 [&>button]:text-blue-700"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium">Rhesus</Label>
            <Combobox
              options={rhesusOptions}
              value={formData.rhesus || ""}
              onValueChange={(value) =>
                setFormData({ ...formData, rhesus: value as RhesusType })
              }
              placeholder="Pilih rhesus"
              className="h-9 [&>button]:border-blue-500 [&>button]:text-blue-700"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium">Agama *</Label>
            <Combobox
              options={religionOptions}
              value={formData.agama || ""}
              onValueChange={(value) => setFormData({ ...formData, agama: value })}
              placeholder="Pilih agama"
              className="h-9 [&>button]:border-destructive"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium">Status Perkawinan</Label>
            <Combobox
              options={maritalOptions}
              value={formData.status_perkawinan || ""}
              onValueChange={(value) => setFormData({ ...formData, status_perkawinan: value })}
              placeholder="Pilih status"
              className="h-9"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium">Pendidikan Terakhir</Label>
            <Combobox
              options={educationOptions}
              value={formData.pendidikan_terakhir || ""}
              onValueChange={(value) => setFormData({ ...formData, pendidikan_terakhir: value })}
              placeholder="Pilih pendidikan"
              className="h-9"
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs font-medium">Pekerjaan</Label>
            <Combobox
              options={occupationOptions}
              value={formData.pekerjaan || ""}
              onValueChange={(value) => setFormData({ ...formData, pekerjaan: value })}
              placeholder="Pilih pekerjaan"
              className="h-9"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="kewarganegaraan" className="text-xs font-medium">
              Kewarganegaraan
            </Label>
            <Input
              id="kewarganegaraan"
              placeholder="WNI / WNA"
              value={formData.kewarganegaraan || "WNI"}
              onChange={(e) => setFormData({ ...formData, kewarganegaraan: e.target.value })}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="suku" className="text-xs font-medium">
              Suku / Etnis
            </Label>
            <Input
              id="suku"
              placeholder="Suku / Etnis"
              value={formData.suku || ""}
              onChange={(e) => setFormData({ ...formData, suku: e.target.value })}
              className="h-9 text-sm"
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="bahasa" className="text-xs font-medium">
              Bahasa yang Dikuasai
            </Label>
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

      {/* Section: Alamat KTP & Domisili */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Alamat KTP */}
        <div className="space-y-3 border border-neutral-200 dark:border-neutral-800 p-4">
          <div className="border-b border-neutral-200 dark:border-neutral-800 pb-2 text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
            <MapPin className="h-3.5 w-3.5" />
            ALAMAT KTP
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="alamat_ktp" className="text-xs font-medium">
                Alamat Lengkap *
              </Label>
              <Textarea
                id="alamat_ktp"
                placeholder="Jalan, Nomor Rumah, Gang, dll"
                value={formData.alamat_ktp || ""}
                onChange={(e) => setFormData({ ...formData, alamat_ktp: e.target.value })}
                rows={2}
                className="text-sm border-destructive"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="rt_ktp" className="text-xs font-medium">
                  RT *
                </Label>
                <Input
                  id="rt_ktp"
                  placeholder="001"
                  maxLength={5}
                  value={formData.rt_ktp || ""}
                  onChange={(e) => setFormData({ ...formData, rt_ktp: e.target.value })}
                  className="h-9 text-sm border-destructive"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="rw_ktp" className="text-xs font-medium">
                  RW *
                </Label>
                <Input
                  id="rw_ktp"
                  placeholder="001"
                  maxLength={5}
                  value={formData.rw_ktp || ""}
                  onChange={(e) => setFormData({ ...formData, rw_ktp: e.target.value })}
                  className="h-9 text-sm border-destructive"
                />
              </div>
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <Label htmlFor="kode_pos_ktp" className="text-xs font-medium">
                  Kode Pos *
                </Label>
                <Input
                  id="kode_pos_ktp"
                  placeholder="62119"
                  maxLength={10}
                  value={formData.kode_pos_ktp || ""}
                  onChange={(e) => setFormData({ ...formData, kode_pos_ktp: e.target.value })}
                  className="h-9 text-sm border-destructive"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Provinsi *</Label>
                <Combobox
                  options={provinceOptions}
                  value={formData.provinsi_ktp || ""}
                  onValueChange={handleProvinceKTPChange}
                  placeholder="Pilih provinsi"
                  searchPlaceholder="Cari provinsi..."
                  className="h-9 [&>button]:border-blue-500 [&>button]:text-blue-700"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Kota/Kabupaten *</Label>
                <Combobox
                  options={regencyKTPOptions}
                  value={formData.kota_ktp || ""}
                  onValueChange={handleRegencyKTPChange}
                  placeholder="Pilih kota/kabupaten"
                  searchPlaceholder="Cari kota..."
                  className="h-9 [&>button]:border-blue-500 [&>button]:text-blue-700"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Kecamatan *</Label>
                <Combobox
                  options={districtKTPOptions}
                  value={formData.kecamatan_ktp || ""}
                  onValueChange={handleDistrictKTPChange}
                  placeholder="Pilih kecamatan"
                  searchPlaceholder="Cari kecamatan..."
                  disabled={!formData.kota_ktp}
                  className="h-9 [&>button]:border-destructive"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Kelurahan/Desa *</Label>
                <Combobox
                  options={villageKTPOptions}
                  value={formData.kelurahan_ktp || ""}
                  onValueChange={(value) => setFormData({ ...formData, kelurahan_ktp: value })}
                  placeholder="Pilih kelurahan"
                  searchPlaceholder="Cari kelurahan..."
                  disabled={!formData.kecamatan_ktp}
                  className="h-9 [&>button]:border-destructive"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Alamat Domisili */}
        <div className="space-y-3 border border-neutral-200 dark:border-neutral-800 p-4">
          <div className="border-b border-neutral-200 dark:border-neutral-800 pb-2 text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <MapPin className="h-3.5 w-3.5" />
              ALAMAT DOMISILI
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="same_address"
                checked={sameAddress}
                onCheckedChange={(checked) => setSameAddress(checked === true)}
              />
              <Label
                htmlFor="same_address"
                className="text-[11px] font-mono uppercase tracking-wider cursor-pointer text-muted-foreground"
              >
                Sama dengan KTP
              </Label>
            </div>
          </div>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="alamat_domisili" className="text-xs font-medium">
                Alamat Lengkap
              </Label>
              <Textarea
                id="alamat_domisili"
                placeholder="Jalan, Nomor Rumah, Gang, dll"
                value={formData.alamat_domisili || ""}
                onChange={(e) => setFormData({ ...formData, alamat_domisili: e.target.value })}
                disabled={sameAddress}
                rows={2}
                className="text-sm"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="rt_domisili" className="text-xs font-medium">
                  RT
                </Label>
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
              <div className="space-y-1">
                <Label htmlFor="rw_domisili" className="text-xs font-medium">
                  RW
                </Label>
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
              <div className="space-y-1 col-span-2 sm:col-span-1">
                <Label htmlFor="kode_pos_domisili" className="text-xs font-medium">
                  Kode Pos
                </Label>
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
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
              <div className="space-y-1">
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
              <div className="space-y-1">
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
              <div className="space-y-1">
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
            </div>
          </div>
        </div>
      </div>

      {/* Section: Kontak */}
      <div className="space-y-3">
        <div className="border-b border-neutral-200 dark:border-neutral-800 pb-2 text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
          <Phone className="h-3.5 w-3.5" />
          DATA KONTAK
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="space-y-1">
            <Label htmlFor="no_telepon" className="text-xs font-medium">
              Nomor Telepon Rumah
            </Label>
            <Input
              id="no_telepon"
              placeholder="021-xxxxxxx"
              value={formData.no_telepon || ""}
              onChange={(e) => setFormData({ ...formData, no_telepon: e.target.value })}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="no_hp" className="text-xs font-medium">
              Nomor HP *
            </Label>
            <Input
              id="no_hp"
              placeholder="08xxxxxxxxxx"
              value={formData.no_hp || ""}
              onChange={(e) => setFormData({ ...formData, no_hp: e.target.value })}
              className="h-9 text-sm border-destructive"
            />
            <p className="text-[10px] text-destructive">Wajib diisi minimal 1</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="no_hp_alternatif" className="text-xs font-medium">
              Nomor HP Alternatif
            </Label>
            <Input
              id="no_hp_alternatif"
              placeholder="08xxxxxxxxxx"
              value={formData.no_hp_alternatif || ""}
              onChange={(e) => setFormData({ ...formData, no_hp_alternatif: e.target.value })}
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="email" className="text-xs font-medium">
              Email
            </Label>
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

      {/* Section: Penanggung Jawab & Orang Tua */}
      <div className="space-y-3">
        <div className="border-b border-neutral-200 dark:border-neutral-800 pb-2 text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
          <Users className="h-3.5 w-3.5" />
          DATA PENANGGUNG JAWAB & KELUARGA
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          <div className="space-y-1">
            <Label htmlFor="nama_penanggung_jawab" className="text-xs font-medium">
              Nama Penanggung Jawab *
            </Label>
            <Input
              id="nama_penanggung_jawab"
              placeholder="Nama lengkap"
              value={formData.nama_penanggung_jawab || ""}
              onChange={(e) => setFormData({ ...formData, nama_penanggung_jawab: e.target.value })}
              className="h-9 text-sm border-destructive"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs font-medium">Hubungan dengan Pasien *</Label>
            <Combobox
              options={relationshipOptions}
              value={formData.hubungan_penanggung_jawab || ""}
              onValueChange={(value) => setFormData({ ...formData, hubungan_penanggung_jawab: value })}
              placeholder="Pilih hubungan"
              className="h-9 [&>button]:border-destructive"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="nik_penanggung_jawab" className="text-xs font-medium">
              NIK Penanggung Jawab
            </Label>
            <Input
              id="nik_penanggung_jawab"
              placeholder="16 digit NIK"
              maxLength={16}
              value={formData.nik_penanggung_jawab || ""}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  nik_penanggung_jawab: e.target.value.replace(/\D/g, ""),
                })
              }
              className="h-9 text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="telepon_penanggung_jawab" className="text-xs font-medium">
              Telepon Penanggung Jawab
            </Label>
            <Input
              id="telepon_penanggung_jawab"
              placeholder="08xxxxxxxxxx"
              value={formData.telepon_penanggung_jawab || ""}
              onChange={(e) => setFormData({ ...formData, telepon_penanggung_jawab: e.target.value })}
              className="h-9 text-sm"
            />
          </div>
          <div className="md:col-span-2 space-y-1">
            <Label htmlFor="alamat_penanggung_jawab" className="text-xs font-medium">
              Alamat Penanggung Jawab
            </Label>
            <Input
              id="alamat_penanggung_jawab"
              placeholder="Alamat lengkap"
              value={formData.alamat_penanggung_jawab || ""}
              onChange={(e) => setFormData({ ...formData, alamat_penanggung_jawab: e.target.value })}
              className="h-9 text-sm"
            />
          </div>
        </div>

        <div className="pt-2 grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-neutral-100 dark:border-neutral-800/70">
          <div className="space-y-2.5">
            <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              Data Ayah (Opsional / Pasien Anak)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <Label htmlFor="nama_ayah" className="text-xs font-medium">
                  Nama Ayah
                </Label>
                <Input
                  id="nama_ayah"
                  placeholder="Nama ayah"
                  value={formData.nama_ayah || ""}
                  onChange={(e) => setFormData({ ...formData, nama_ayah: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nik_ayah" className="text-xs font-medium">
                  NIK Ayah
                </Label>
                <Input
                  id="nik_ayah"
                  placeholder="16 digit NIK"
                  maxLength={16}
                  value={formData.nik_ayah || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, nik_ayah: e.target.value.replace(/\D/g, "") })
                  }
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
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
          </div>

          <div className="space-y-2.5">
            <div className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
              Data Ibu (Opsional / Pasien Anak)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="space-y-1">
                <Label htmlFor="nama_ibu" className="text-xs font-medium">
                  Nama Ibu
                </Label>
                <Input
                  id="nama_ibu"
                  placeholder="Nama ibu"
                  value={formData.nama_ibu || ""}
                  onChange={(e) => setFormData({ ...formData, nama_ibu: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="nik_ibu" className="text-xs font-medium">
                  NIK Ibu
                </Label>
                <Input
                  id="nik_ibu"
                  placeholder="16 digit NIK"
                  maxLength={16}
                  value={formData.nik_ibu || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, nik_ibu: e.target.value.replace(/\D/g, "") })
                  }
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
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

      {/* Section: Jaminan */}
      <div className="space-y-3">
        <div className="border-b border-neutral-200 dark:border-neutral-800 pb-2 text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
          <Shield className="h-3.5 w-3.5" />
          DATA JAMINAN / PEMBAYARAN
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="space-y-1">
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
              <div className="space-y-1">
                <Label htmlFor="no_bpjs" className="text-xs font-medium">
                  Nomor BPJS
                </Label>
                <Input
                  id="no_bpjs"
                  placeholder="13 digit nomor BPJS"
                  maxLength={20}
                  value={formData.no_bpjs || ""}
                  onChange={(e) => setFormData({ ...formData, no_bpjs: e.target.value })}
                  className="h-9 text-sm font-mono"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">Kelas BPJS</Label>
                <Combobox
                  options={bpjsClassOptions}
                  value={formData.kelas_bpjs || ""}
                  onValueChange={(value) => setFormData({ ...formData, kelas_bpjs: value })}
                  placeholder="Pilih kelas"
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="faskes_tingkat_1" className="text-xs font-medium">
                  Faskes Tingkat 1
                </Label>
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
              <div className="space-y-1">
                <Label htmlFor="nama_asuransi" className="text-xs font-medium">
                  Nama Asuransi
                </Label>
                <Input
                  id="nama_asuransi"
                  placeholder="Nama perusahaan asuransi"
                  value={formData.nama_asuransi || ""}
                  onChange={(e) => setFormData({ ...formData, nama_asuransi: e.target.value })}
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="no_polis_asuransi" className="text-xs font-medium">
                  Nomor Polis
                </Label>
                <Input
                  id="no_polis_asuransi"
                  placeholder="Nomor polis asuransi"
                  value={formData.no_polis_asuransi || ""}
                  onChange={(e) => setFormData({ ...formData, no_polis_asuransi: e.target.value })}
                  className="h-9 text-sm font-mono"
                />
              </div>
              <div className="space-y-1">
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

      {/* Section: Riwayat Medis */}
      <div className="space-y-3">
        <div className="border-b border-neutral-200 dark:border-neutral-800 pb-2 text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
          <Heart className="h-3.5 w-3.5" />
          RIWAYAT MEDIS
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          <div className="space-y-1">
            <Label htmlFor="alergi_obat" className="text-xs font-medium">
              Alergi Obat
            </Label>
            <Textarea
              id="alergi_obat"
              placeholder="Daftar obat yang menyebabkan alergi"
              value={formData.alergi_obat || ""}
              onChange={(e) => setFormData({ ...formData, alergi_obat: e.target.value })}
              rows={2}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="alergi_makanan" className="text-xs font-medium">
              Alergi Makanan
            </Label>
            <Textarea
              id="alergi_makanan"
              placeholder="Daftar makanan yang menyebabkan alergi"
              value={formData.alergi_makanan || ""}
              onChange={(e) => setFormData({ ...formData, alergi_makanan: e.target.value })}
              rows={2}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="alergi_lainnya" className="text-xs font-medium">
              Alergi Lainnya
            </Label>
            <Textarea
              id="alergi_lainnya"
              placeholder="Debu, serbuk sari, dll"
              value={formData.alergi_lainnya || ""}
              onChange={(e) => setFormData({ ...formData, alergi_lainnya: e.target.value })}
              rows={2}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="penyakit_kronis" className="text-xs font-medium">
              Penyakit Kronis
            </Label>
            <Textarea
              id="penyakit_kronis"
              placeholder="Diabetes, Hipertensi, Asma, dll"
              value={formData.penyakit_kronis || ""}
              onChange={(e) => setFormData({ ...formData, penyakit_kronis: e.target.value })}
              rows={2}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="riwayat_operasi" className="text-xs font-medium">
              Riwayat Operasi
            </Label>
            <Textarea
              id="riwayat_operasi"
              placeholder="Operasi yang pernah dilakukan"
              value={formData.riwayat_operasi || ""}
              onChange={(e) => setFormData({ ...formData, riwayat_operasi: e.target.value })}
              rows={2}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="obat_rutin" className="text-xs font-medium">
              Obat yang Sedang Dikonsumsi
            </Label>
            <Textarea
              id="obat_rutin"
              placeholder="Obat-obatan yang rutin dikonsumsi"
              value={formData.obat_rutin || ""}
              onChange={(e) => setFormData({ ...formData, obat_rutin: e.target.value })}
              rows={2}
              className="text-sm"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="disabilitas" className="text-xs font-medium">
              Disabilitas
            </Label>
            <Input
              id="disabilitas"
              placeholder="Jenis disabilitas (jika ada)"
              value={formData.disabilitas || ""}
              onChange={(e) => setFormData({ ...formData, disabilitas: e.target.value })}
              className="h-9 text-sm"
            />
          </div>
          <div className="md:col-span-2 space-y-1">
            <Label htmlFor="catatan_khusus" className="text-xs font-medium">
              Catatan Khusus
            </Label>
            <Textarea
              id="catatan_khusus"
              placeholder="Catatan khusus lainnya"
              value={formData.catatan_khusus || ""}
              onChange={(e) => setFormData({ ...formData, catatan_khusus: e.target.value })}
              rows={2}
              className="text-sm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
