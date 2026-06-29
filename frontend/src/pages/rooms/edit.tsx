import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Combobox, type ComboboxOption } from "@/components/ui/combobox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { roomsApi, masterDataApi, employeesApi, ROOM_TARIFF_COMPONENTS, type MasterData, type Employee, type RoomTariffRequest } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Loader2, Building2, FileText, Layers, User, BedDouble, Calendar } from "lucide-react";
import { setPageTitle } from "@/lib/page-title";

export default function RoomEdit() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [masterData, setMasterData] = useState<Record<string, MasterData[]>>({});
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    queue_code: "",
    service_type: "",
    room_type: "",
    room_class: "",
    total_floors: 1,
    tariff_per_day: 0,
    registration_fee: 0,
    facilities: "",
    description: "",
    has_bed: false,
    has_schedule: false,
    is_active: true,
    pic_employee_id: null as number | null,
    tariffs: [] as RoomTariffRequest[],
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
        masterDataApi.getMultiple(['service_type', 'room_type', 'patient_class']),
        employeesApi.getAll({ limit: 1000 }),
      ]);

      const room = roomRes.data.data;
      setFormData({
        code: room.code,
        name: room.name,
        queue_code: room.queue_code || "",
        service_type: room.service_type || "",
        room_type: room.room_type || "",
        room_class: room.room_class || "",
        total_floors: room.total_floors || 1,
        tariff_per_day: room.tariff_per_day || 0,
        registration_fee: room.registration_fee || 0,
        facilities: room.facilities || "",
        description: room.description || "",
        has_bed: room.has_bed || false,
        has_schedule: room.has_schedule || false,
        is_active: room.is_active,
        pic_employee_id: room.pic_employee_id || null,
        tariffs: room.tariffs?.map((t: any) => ({
          patient_class: t.patient_class,
          akomodasi: t.akomodasi,
          makan: t.makan,
          perawatan: t.perawatan,
          administrasi: t.administrasi,
          lainnya: t.lainnya,
          is_active: t.is_active,
        })) || [],
      });
      const data = masterDataRes.data.data || {};
      setMasterData(data);
      setEmployees(employeesRes.data.data || []);

      // Merge tariffs with patient_class master data
      if (data.patient_class && data.patient_class.length > 0) {
        const existingTariffs = room.tariffs || [];
        const mergedTariffs: RoomTariffRequest[] = data.patient_class.map((pc: any) => {
          const existing = existingTariffs.find((t: any) => t.patient_class === pc.code);
          return existing ? {
            patient_class: existing.patient_class,
            akomodasi: existing.akomodasi,
            makan: existing.makan,
            perawatan: existing.perawatan,
            administrasi: existing.administrasi,
            lainnya: existing.lainnya,
            is_active: existing.is_active,
          } : {
            patient_class: pc.code,
            akomodasi: 0,
            makan: 0,
            perawatan: 0,
            administrasi: 0,
            lainnya: 0,
            is_active: true,
          };
        });
        setFormData(prev => ({ ...prev, tariffs: mergedTariffs }));
      }
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
        name: formData.name,
        queue_code: formData.queue_code,
        service_type: formData.service_type,
        room_type: formData.room_type,
        room_class: formData.room_class || undefined,
        total_floors: formData.total_floors,
        tariff_per_day: formData.tariff_per_day,
        registration_fee: formData.registration_fee,
        facilities: formData.facilities,
        description: formData.description,
        has_bed: formData.has_bed,
        has_schedule: formData.has_schedule,
        is_active: formData.is_active,
        pic_employee_id: formData.pic_employee_id,
        tariffs: formData.tariffs,
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

  const employeeOptions: ComboboxOption[] = employees.map(emp => ({
    value: emp.id.toString(),
    label: `${emp.nama_lengkap} (${emp.nik})`,
  }));

  const updateTariff = (patientClass: string, component: string, value: number) => {
    setFormData(prev => ({
      ...prev,
      tariffs: prev.tariffs?.map((t) =>
        t.patient_class === patientClass
          ? ({ ...t, [component]: value } as unknown as RoomTariffRequest)
          : t
      ) || [],
    }));
  };

  const getTariffValue = (patientClass: string, component: string): number => {
    const tariff = formData.tariffs?.find((t) => t.patient_class === patientClass);
    return tariff ? (tariff[component as keyof RoomTariffRequest] as number) || 0 : 0;
  };

  const calculateRowTotal = (patientClass: string): number => {
    const tariff = formData.tariffs?.find((t) => t.patient_class === patientClass);
    if (!tariff) return 0;
    return ROOM_TARIFF_COMPONENTS.reduce((sum: number, comp: any) => sum + ((tariff[comp.key as keyof RoomTariffRequest] as number) || 0), 0);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title="Edit Ruangan"
        description="Perbarui detail informasi ruangan"
        icon={Building2}
        actions={
          <Button
            variant="outline"
            size="icon"
            onClick={() => window.history.back()}
            className="h-9 w-9"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        }
      />
      <PageContent>
        <div className="border border-border/70 bg-background">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
            <Building2 className="h-3 w-3" />
            DATA RUANGAN
          </div>
          <div className="p-3 sm:p-4">
            <form onSubmit={handleSubmit} className="space-y-5 [&_input]:h-9 [&_[role=combobox]]:h-9">
              {/* Basic Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="code" className="text-xs font-medium">
                    Kode Ruangan
                  </Label>
                  <Input
                    id="code"
                    value={formData.code}
                    disabled
                    className="h-9 text-sm bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor="name"
                    className="text-xs font-medium"
                  >
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
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


              <hr className="border-border/50" />

              {/* Total Floors and PIC */}
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
                {formData.service_type === 'rawat_inap' && (
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

              {/* Tarif Per Kelas Pasien */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium">Tarif Per Kelas Pasien</h3>
                {masterData.patient_class?.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground">Tidak ada data kelas pasien</div>
                ) : (
                  <div className="border rounded-lg overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead className="font-semibold min-w-[120px] sticky left-0 bg-muted/50">Kelas Pasien</TableHead>
                          {ROOM_TARIFF_COMPONENTS.map((comp: any) => (
                            <TableHead key={comp.key} className="text-center min-w-[120px]">
                              {comp.label}
                            </TableHead>
                          ))}
                          <TableHead className="text-center min-w-[130px] font-semibold bg-muted/50">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {masterData.patient_class?.map((pc: any) => (
                          <TableRow key={pc.code}>
                            <TableCell className="font-medium sticky left-0 bg-background">
                              {pc.name}
                            </TableCell>
                            {ROOM_TARIFF_COMPONENTS.map((comp: any) => (
                              <TableCell key={comp.key} className="p-1">
                                <Input
                                  type="number"
                                  className="h-8 text-right text-sm"
                                  value={getTariffValue(pc.code, comp.key) || ""}
                                  onChange={(e) =>
                                    updateTariff(pc.code, comp.key, Number(e.target.value) || 0)
                                  }
                                  placeholder="0"
                                />
                              </TableCell>
                            ))}
                            <TableCell className="text-right font-semibold bg-muted/30">
                              {formatCurrency(calculateRowTotal(pc.code))}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
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

              {/* Sticky Footer */}
              <div className="sticky bottom-0 z-10 flex items-center justify-end gap-2 border-t border-border/70 bg-background/95 px-3 py-3 backdrop-blur -mx-3 sm:-mx-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate("/rooms")}
                  className="h-9"
                >
                  Batal
                </Button>
                <Button type="submit" disabled={loading} className="h-9 min-w-28">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Simpan
                </Button>
              </div>
            </form>
          </div>
        </div>
      </PageContent>
    </PageShell>
  );
}
