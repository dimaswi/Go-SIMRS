import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { roomsApi, masterDataApi, employeesApi, type MasterData, type Employee } from "@/lib/api";
import { bpjsApi, type AplicareRefKelasItem } from "@/lib/api/bpjs";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Building2, Tag, DollarSign, FileText, Layers, User, BedDouble, Calendar } from "lucide-react";
import { setPageTitle } from "@/lib/page-title";

export default function RoomEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [masterData, setMasterData] = useState<Record<string, MasterData[]>>({});
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [refKelasBpjs, setRefKelasBpjs] = useState<AplicareRefKelasItem[]>([]);

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    queue_code: "",
    service_type: "",
    room_type: "",
    room_class: "",
    kode_kelas_bpjs: "",
    total_floors: 1,
    registration_fee: 0,
    tariff_per_day: 0,
    facilities: "",
    description: "",
    has_bed: false,
    has_schedule: false,
    is_active: true,
    pic_employee_id: null as number | null,
  });

  useEffect(() => {
    setPageTitle("Edit Ruangan");
    loadData();
  }, [id]);

  const loadData = async () => {
    if (!id) return;
    
    try {
      const [roomRes, masterDataRes, employeesRes] = await Promise.all([
        roomsApi.getById(parseInt(id)),
        masterDataApi.getMultiple(['service_type', 'room_type', 'room_class']),
        employeesApi.getAll({ limit: 1000 }),
      ]);
      
      const room = roomRes.data.data;
      setFormData({
        code: room.code,
        name: room.name,
        queue_code: room.queue_code || "",
        service_type: room.service_type || "",
        room_type: room.room_type,
        room_class: room.room_class || "",
        kode_kelas_bpjs: room.kode_kelas_bpjs || "",
        total_floors: room.total_floors || 1,
        registration_fee: room.registration_fee || 0,
        tariff_per_day: room.tariff_per_day,
        facilities: room.facilities || "",
        description: room.description || "",
        has_bed: room.has_bed || false,
        has_schedule: room.has_schedule || false,
        is_active: room.is_active,
        pic_employee_id: room.pic_employee_id || null,
      });
      setMasterData(masterDataRes.data.data || {});
      setEmployees(employeesRes.data.data || []);
      // Load BPJS ref kelas (silent fail)
      try {
        const refRes = await bpjsApi.aplicareGetRefKelas();
        setRefKelasBpjs(refRes.data.data || []);
      } catch { /* silent - not critical */ }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data ruangan.",
      });
      navigate("/rooms");
    } finally {
      setLoadingData(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setLoading(true);

    try {
      await roomsApi.update(parseInt(id), {
        code: formData.code,
        name: formData.name,
        queue_code: formData.queue_code,
        service_type: formData.service_type,
        room_type: formData.room_type,
        room_class: formData.room_class || undefined,
        kode_kelas_bpjs: formData.kode_kelas_bpjs || undefined,
        total_floors: formData.total_floors,
        registration_fee: formData.registration_fee,
        tariff_per_day: formData.tariff_per_day,
        facilities: formData.facilities,
        description: formData.description,
        has_bed: formData.has_bed,
        has_schedule: formData.has_schedule,
        is_active: formData.is_active,
        pic_employee_id: formData.pic_employee_id,
      });

      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Ruangan berhasil diperbarui.",
      });
      navigate("/rooms");
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal memperbarui ruangan.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Prepare combobox options
  const serviceTypeOptions: ComboboxOption[] = (masterData.service_type || []).map(item => ({
    value: item.code,
    label: item.name,
  }));

  const roomTypeOptions: ComboboxOption[] = (masterData.room_type || []).map(item => ({
    value: item.code,
    label: item.name,
  }));

  const roomClassOptions: ComboboxOption[] = (masterData.room_class || []).map(item => ({
    value: item.code,
    label: item.name,
  }));

  const employeeOptions: ComboboxOption[] = employees.map(emp => ({
    value: emp.id.toString(),
    label: `${emp.nama_lengkap} (${emp.nik})`,
  }));

  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col px-4">
      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => window.history.back()}
          className="h-9 w-9"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold">
            Edit Ruangan
          </h1>
          <p className="text-sm text-muted-foreground">
            Perbarui detail informasi ruangan
          </p>
        </div>
      </div>
      <div className="rounded-lg border p-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label
                    htmlFor="code"
                    className="text-xs font-medium flex items-center gap-2"
                  >
                    <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                    Kode Ruangan *
                  </Label>
                  <Input
                    id="code"
                    required
                    placeholder="Contoh: BIR-ALI"
                    value={formData.code}
                    onChange={(e) =>
                      setFormData({ ...formData, code: e.target.value.toUpperCase() })
                    }
                    className="h-9 text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="name"
                    className="text-xs font-medium flex items-center gap-2"
                  >
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    Nama Ruangan *
                  </Label>
                  <Input
                    id="name"
                    required
                    placeholder="Contoh: BIR ALI"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="h-9 text-sm"
                  />
                </div>
              </div>

              <hr className="border-border/50" />

              {/* Queue Code */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="queue_code" className="text-xs font-medium">
                    Kode Antrean <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Input
                    id="queue_code"
                    placeholder="Contoh: A, B, L, R"
                    maxLength={5}
                    value={formData.queue_code}
                    onChange={(e) =>
                      setFormData({ ...formData, queue_code: e.target.value.toUpperCase() })
                    }
                    className="h-9 text-sm uppercase"
                  />
                  <p className="text-xs text-muted-foreground">
                    Prefix untuk nomor antrean ruangan (misal: A001, B001)
                  </p>
                </div>
              </div>

              <hr className="border-border/50" />

              {/* Service Type and Room Type */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Jenis Layanan *</Label>
                  <Combobox
                    options={serviceTypeOptions}
                    value={formData.service_type}
                    onValueChange={(value) => setFormData({ ...formData, service_type: value })}
                    placeholder="Pilih jenis layanan"
                    searchPlaceholder="Cari layanan..."
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Tipe Ruangan *</Label>
                  <Combobox
                    options={roomTypeOptions}
                    value={formData.room_type}
                    onValueChange={(value) => setFormData({ ...formData, room_type: value })}
                    placeholder="Pilih tipe ruangan"
                    searchPlaceholder="Cari tipe..."
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium">Kelas Ruangan</Label>
                  <Combobox
                    options={roomClassOptions}
                    value={formData.room_class}
                    onValueChange={(value) => setFormData({ ...formData, room_class: value })}
                    placeholder="Pilih kelas ruangan"
                    searchPlaceholder="Cari kelas..."
                  />
                </div>
              </div>

              <hr className="border-border/50" />

              {/* Features: has_bed, has_schedule */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label className="text-xs font-medium flex items-center gap-2">
                    <BedDouble className="h-3.5 w-3.5 text-muted-foreground" />
                    Punya Tempat Tidur
                  </Label>
                  <div className="flex items-center gap-3 h-9">
                    <Switch
                      id="has_bed"
                      checked={formData.has_bed}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, has_bed: checked })
                      }
                    />
                    <Label htmlFor="has_bed" className="text-sm text-muted-foreground">
                      {formData.has_bed ? "Ya" : "Tidak"}
                    </Label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs font-medium flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    Butuh Jadwal
                  </Label>
                  <div className="flex items-center gap-3 h-9">
                    <Switch
                      id="has_schedule"
                      checked={formData.has_schedule}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, has_schedule: checked })
                      }
                    />
                    <Label htmlFor="has_schedule" className="text-sm text-muted-foreground">
                      {formData.has_schedule ? "Ya" : "Tidak"}
                    </Label>
                  </div>
                </div>
              </div>

              {/* Kode Kelas BPJS Aplicare - muncul setelah has_bed diaktifkan */}
              {formData.has_bed && refKelasBpjs.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  <div className="space-y-2">
                    <Label className="text-xs font-medium flex items-center gap-2">
                      <BedDouble className="h-3.5 w-3.5 text-muted-foreground" />
                      Kode Kelas BPJS Aplicare
                    </Label>
                    <Combobox
                      options={refKelasBpjs.map(k => ({
                        value: k.kodekelas,
                        label: `${k.kodekelas} â€” ${k.namakelas}`,
                      }))}
                      value={formData.kode_kelas_bpjs}
                      onValueChange={(value) => setFormData({ ...formData, kode_kelas_bpjs: value })}
                      placeholder="Pilih kode kelas BPJS"
                      searchPlaceholder="Cari kode kelas..."
                    />
                    <p className="text-xs text-muted-foreground">Digunakan untuk integrasi BPJS Aplicare (ketersediaan tempat tidur)</p>
                  </div>
                </div>
              )}

              <hr className="border-border/50" />

              {/* Total Floors, Registration Fee, Tariff (only for rawat_inap) and PIC */}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {/* Registration Fee - untuk semua ruangan */}
                <div className="space-y-2">
                  <Label
                    htmlFor="registration_fee"
                    className="text-xs font-medium flex items-center gap-2"
                  >
                    <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                    Tarif Pendaftaran (Rp)
                  </Label>
                  <Input
                    id="registration_fee"
                    type="number"
                    min={0}
                    value={formData.registration_fee}
                    onChange={(e) =>
                      setFormData({ ...formData, registration_fee: parseFloat(e.target.value) || 0 })
                    }
                    className="h-9 text-sm"
                    placeholder="0"
                  />
                  <p className="text-xs text-muted-foreground">Tarif pendaftaran per kunjungan ke ruangan ini</p>
                </div>

                {formData.service_type === 'rawat_inap' && (
                  <>
                    <div className="space-y-2">
                      <Label
                        htmlFor="total_floors"
                        className="text-xs font-medium flex items-center gap-2"
                      >
                        <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                        Jumlah Lantai
                      </Label>
                      <Input
                        id="total_floors"
                        type="number"
                        min={1}
                        value={formData.total_floors}
                        onChange={(e) =>
                          setFormData({ ...formData, total_floors: parseInt(e.target.value) || 1 })
                        }
                        className="h-9 text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label
                        htmlFor="tariff_per_day"
                        className="text-xs font-medium flex items-center gap-2"
                      >
                        <DollarSign className="h-3.5 w-3.5 text-muted-foreground" />
                        Tarif per Hari (Rp)
                      </Label>
                      <Input
                        id="tariff_per_day"
                        type="number"
                        min={0}
                        value={formData.tariff_per_day}
                        onChange={(e) =>
                          setFormData({ ...formData, tariff_per_day: parseFloat(e.target.value) || 0 })
                        }
                        className="h-9 text-sm"
                      />
                    </div>
                  </>
                )}
                <div className="space-y-2">
                  <Label className="text-xs font-medium flex items-center gap-2">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    Penanggung Jawab
                  </Label>
                  <Combobox
                    options={employeeOptions}
                    value={formData.pic_employee_id?.toString() || ""}
                    onValueChange={(value) => setFormData({ 
                      ...formData, 
                      pic_employee_id: value ? parseInt(value) : null 
                    })}
                    placeholder="Pilih penanggung jawab"
                    searchPlaceholder="Cari karyawan..."
                  />
                </div>
              </div>

              <hr className="border-border/50" />

              {/* Facilities and Description */}
              <div className="space-y-2">
                <Label
                  htmlFor="facilities"
                  className="text-xs font-medium flex items-center gap-2"
                >
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  Fasilitas
                </Label>
                <Textarea
                  id="facilities"
                  value={formData.facilities}
                  onChange={(e) =>
                    setFormData({ ...formData, facilities: e.target.value })
                  }
                  placeholder="Contoh: AC, TV, Kamar Mandi Dalam, dll."
                  rows={3}
                  className="text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="description"
                  className="text-xs font-medium flex items-center gap-2"
                >
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                  Deskripsi
                </Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  placeholder="Keterangan tambahan tentang ruangan"
                  rows={3}
                  className="text-sm"
                />
              </div>

              <hr className="border-border/50" />

              {/* Status */}
              <div className="flex items-center gap-3">
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, is_active: checked })
                  }
                />
                <Label htmlFor="is_active" className="text-sm">
                  Ruangan Aktif
                </Label>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end gap-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/rooms")}
                >
                  Batal
                </Button>
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Simpan
                </Button>
              </div>
            </form>
      </div>
    </div>
  );
}
