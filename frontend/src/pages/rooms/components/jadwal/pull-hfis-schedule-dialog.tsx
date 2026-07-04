import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { bpjsApi, roomsApi, employeesApi, type Employee } from "@/lib/api";
import type { BPJSPoliMapping, BPJSJadwalDokter } from "@/lib/api/bpjs";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CalendarPlus, Check, ChevronsUpDown, AlertTriangle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PullHfisScheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: number;
  poliMapping: BPJSPoliMapping | null;
  onSuccess: () => void;
}

export function PullHfisScheduleDialog({
  open,
  onOpenChange,
  roomId,
  poliMapping,
  onSuccess,
}: PullHfisScheduleDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [hfisSchedules, setHfisSchedules] = useState<BPJSJadwalDokter[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  // State to hold user mapping: HFIS kodedokter -> SIMRS employee_id
  const [doctorMatches, setDoctorMatches] = useState<Record<number, number>>({});
  // Combobox popover states
  const [openComboboxes, setOpenComboboxes] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (open && poliMapping) {
      loadData();
    } else if (!open) {
      setHfisSchedules([]);
      setDoctorMatches({});
    }
  }, [open, poliMapping]);

  const loadData = async () => {
    setLoading(true);
    try {
      const next7Days = Array.from({ length: 7 }).map((_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        // format to local date string YYYY-MM-DD
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      });

      const promises = [
        employeesApi.getAll({ limit: 1000 }),
        ...next7Days.map(date => bpjsApi.getJadwalDokter(poliMapping!.kode_poli_bpjs, date).catch(err => {
          console.warn(`Gagal mengambil jadwal untuk tanggal ${date}`, err);
          return { data: { data: [] } };
        }))
      ];

      const results = await Promise.all(promises);
      const empRes = results[0] as any;
      const jadwalResponses = results.slice(1) as any[];
      
      let allSchedules: BPJSJadwalDokter[] = [];
      jadwalResponses.forEach(res => {
        if (res?.data?.data) {
          allSchedules = [...allSchedules, ...res.data.data];
        }
      });
      
      // Remove duplicates based on kodedokter, hari, and jadwal string
      const uniqueSchedules = new Map<string, BPJSJadwalDokter>();
      allSchedules.forEach(s => {
        const key = `${s.kodedokter}-${s.hari}-${s.jadwal}`;
        if (!uniqueSchedules.has(key)) {
          uniqueSchedules.set(key, s);
        }
      });
      const schedules = Array.from(uniqueSchedules.values());
      
      let emps: Employee[] = empRes.data.data || [];
      const dokterEmps = emps.filter(e => e.tipe_karyawan && e.tipe_karyawan.toLowerCase() === 'dokter');
      if (dokterEmps.length > 0) {
        emps = dokterEmps;
      }
      
      setHfisSchedules(schedules);
      setEmployees(emps);
      
      // Auto match by name if possible
      const initialMatches: Record<number, number> = {};
      const uniqueHfisDoctors = new Map<number, string>();
      schedules.forEach(s => {
        if (!uniqueHfisDoctors.has(s.kodedokter)) {
          uniqueHfisDoctors.set(s.kodedokter, s.namadokter);
        }
      });
      
      uniqueHfisDoctors.forEach((namaHfis, kodeHfis) => {
        // Simple name matching (case insensitive)
        const match = emps.find((e: Employee) => 
          e.nama_lengkap.toLowerCase().includes(namaHfis.toLowerCase()) || 
          namaHfis.toLowerCase().includes(e.nama_lengkap.toLowerCase())
        );
        if (match) {
          initialMatches[kodeHfis] = match.id;
        }
      });
      
      setDoctorMatches(initialMatches);
      
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal memuat jadwal HFIS",
        description: error.response?.data?.error || "Gagal menghubungi server BPJS.",
      });
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const uniqueDoctors = useMemo(() => {
    const seen = new Map<number, { kodedokter: number; namadokter: string; schedules: BPJSJadwalDokter[] }>();
    hfisSchedules.forEach(s => {
      if (!seen.has(s.kodedokter)) {
        seen.set(s.kodedokter, { kodedokter: s.kodedokter, namadokter: s.namadokter, schedules: [s] });
      } else {
        seen.get(s.kodedokter)!.schedules.push(s);
      }
    });
    return Array.from(seen.values());
  }, [hfisSchedules]);

  const handlePullSchedules = async () => {
    try {
      setSaving(true);
      
      // Filter schedules for doctors that have been mapped
      const schedulesToPull = hfisSchedules.filter(s => doctorMatches[s.kodedokter]);
      
      if (schedulesToPull.length === 0) {
        toast({ variant: "destructive", title: "Error", description: "Pilih setidaknya satu dokter untuk ditarik." });
        setSaving(false);
        return;
      }

      for (const hfisDoc of uniqueDoctors) {
        const empId = doctorMatches[hfisDoc.kodedokter];
        if (!empId) continue;

        try {
          const existingMapRes = await bpjsApi.getDoctorMappings({ poli_mapping_id: poliMapping!.id });
          const existingMaps = existingMapRes.data.data || [];
          
          const existing = existingMaps.find(m => m.employee_id === empId);
          if (existing) {
            await bpjsApi.updateDoctorMapping(existing.id, {
              kode_dokter_bpjs: hfisDoc.kodedokter.toString(),
              nama_dokter_bpjs: hfisDoc.namadokter
            });
          } else {
            await bpjsApi.createDoctorMapping({
              poli_mapping_id: poliMapping!.id,
              employee_id: empId,
              kode_dokter_bpjs: hfisDoc.kodedokter.toString(),
              nama_dokter_bpjs: hfisDoc.namadokter
            });
          }
        } catch (e) {
          console.error("Failed to map doctor", e);
        }

        const docSchedules = hfisSchedules.filter(s => s.kodedokter === hfisDoc.kodedokter);
        for (const s of docSchedules) {
          let startTime = "08:00";
          let endTime = "12:00";
          if (s.jadwal && s.jadwal.includes("-")) {
            const parts = s.jadwal.split("-");
            if (parts.length >= 2) {
              startTime = parts[0].trim();
              endTime = parts[1].trim();
            }
          }

          try {
            await roomsApi.createDoctorSchedule(roomId, {
              employee_id: empId,
              day_of_week: s.hari,
              start_time: startTime,
              end_time: endTime,
              max_patients: s.kapasitaspasien || 0,
              consult_fee: 0,
              is_active: s.libur === 0,
              notes: "Ditarik dari HFIS"
            });
          } catch (e) {
            console.error("Failed to create schedule", e);
          }
        }
      }

      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Jadwal dokter berhasil ditarik dari HFIS.",
      });
      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal menarik jadwal",
        description: error.response?.data?.error || "Gagal memproses jadwal.",
      });
    } finally {
      setSaving(false);
    }
  };

  if (!poliMapping) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Tarik Jadwal dari HFIS</DialogTitle>
          <DialogDescription>
            Tarik jadwal dokter dari BPJS HFIS untuk {poliMapping.nama_poli_bpjs}. 
            Pasangkan dokter HFIS dengan dokter di SIMRS.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-10 space-y-4">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Mengambil jadwal dari HFIS BPJS...</p>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto py-4 space-y-6 custom-scrollbar pr-2">
            {hfisSchedules.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Tidak ada jadwal dokter ditemukan di HFIS untuk poli ini.</p>
              </div>
            ) : (
              <>
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Pilih dokter SIMRS yang sesuai untuk setiap dokter HFIS. Jadwal dokter yang tidak dipasangkan akan dilewati.
                  </AlertDescription>
                </Alert>

                <div className="space-y-4">
                  {uniqueDoctors.map(doc => (
                    <div key={doc.kodedokter} className="border rounded-lg p-4 space-y-3">
                      <div className="flex flex-col mb-4">
                        <p className="font-semibold mb-2">{doc.namadokter}</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                          {[
                            { id: 1, name: "Senin" },
                            { id: 2, name: "Selasa" },
                            { id: 3, name: "Rabu" },
                            { id: 4, name: "Kamis" },
                            { id: 5, name: "Jumat" },
                            { id: 6, name: "Sabtu" },
                            { id: 7, name: "Minggu" },
                          ].map(day => {
                            const daySchedules = doc.schedules.filter(s => s.hari === day.id);
                            return (
                              <div key={day.id} className="border rounded-md p-2 bg-muted/20">
                                <p className="text-xs font-medium text-muted-foreground mb-1">{day.name}</p>
                                {daySchedules.length > 0 ? (
                                  <div className="space-y-1">
                                    {daySchedules.map((s, idx) => (
                                      <div key={idx} className="text-xs font-semibold flex flex-col">
                                        <span>{s.jadwal}</span>
                                        {s.kapasitaspasien > 0 && (
                                          <span className="text-[10px] text-muted-foreground font-normal">Kapasitas: {s.kapasitaspasien}</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-[10px] text-muted-foreground/60 italic">Tidak ada jadwal</p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium">Cocokkan dengan Dokter SIMRS:</label>
                        <Popover 
                          open={openComboboxes[doc.kodedokter]} 
                          onOpenChange={(open) => setOpenComboboxes(prev => ({ ...prev, [doc.kodedokter]: open }))}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between"
                            >
                              {doctorMatches[doc.kodedokter]
                                ? employees.find(e => e.id === doctorMatches[doc.kodedokter])?.nama_lengkap
                                : "Pilih Dokter..."}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[300px] p-0" align="start">
                            <Command>
                              <CommandInput placeholder="Cari dokter..." />
                              <CommandList>
                                <CommandEmpty>Dokter tidak ditemukan.</CommandEmpty>
                                <CommandGroup>
                                  {employees.map(employee => (
                                    <CommandItem
                                      key={employee.id}
                                      value={employee.nama_lengkap}
                                      onSelect={() => {
                                        setDoctorMatches(prev => ({ ...prev, [doc.kodedokter]: employee.id }));
                                        setOpenComboboxes(prev => ({ ...prev, [doc.kodedokter]: false }));
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          doctorMatches[doc.kodedokter] === employee.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                                      {employee.nama_lengkap}
                                    </CommandItem>
                                  ))}
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter className="mt-4 border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving || loading}>
            Batal
          </Button>
          <Button onClick={handlePullSchedules} disabled={saving || loading || hfisSchedules.length === 0}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CalendarPlus className="mr-2 h-4 w-4" />}
            Mulai Tarik & Simpan Jadwal
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
