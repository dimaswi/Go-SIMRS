import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

import { DataTable } from "@/components/ui/data-table";
import { createRegistrationColumns } from "./columns";
import { registrationApi, type Registration } from "@/lib/api/queue";
import { bpjsApi, type BPJSQueue } from "@/lib/api/bpjs";
import { patientsApi, type Patient } from "@/lib/api";
import { vclaimApi, type SEPLocal } from "@/lib/api/vclaim";
import { SPRIFormSheet } from "@/components/sep/spri-form-sheet";
import { SEPFormSheet } from "@/components/sep/sep-form-sheet";
import { usePermission } from "@/hooks/usePermission";
import { useToast } from "@/hooks/use-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EditPaymentDialog } from "./edit-payment-dialog";
import { printApi } from "@/lib/api";
import { setPageTitle } from "@/lib/page-title";
import {
  Loader2,
  Plus,
  RefreshCcw,
  Check,
  ChevronsUpDown,
  SlidersHorizontal,
  CalendarClock,
} from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api/client";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface Room {
  id: number;
  code: string;
  name: string;
  service_type?: string;
  room_type?: string;
}

// ── Tab definitions ─────────────────────────────────────────────────────────
interface RegTab {
  key: string;          // service_type value sent to API ("" = all)
  label: string;        // displayed label
  serviceTypes: string[]; // service_type values used to filter room dropdown
}

const REG_TABS: RegTab[] = [
  {
    key: "",
    label: "Semua",
    serviceTypes: [],
  },
  {
    key: "rawat_jalan",
    label: "Rawat Jalan",
    serviceTypes: ["rawat_jalan"],
  },
  {
    key: "gawat_darurat",
    label: "UGD / IGD",
    serviceTypes: ["gawat_darurat"],
  },
];

export default function RegistrationIndex() {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const { toast } = useToast();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [allRegistrations, setAllRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeTab, setActiveTab] = useState<string>(() => {
    try {
      return localStorage.getItem("reg_filter_tab") || "";
    } catch {
      return "";
    }
  });
  const [tabRooms, setTabRooms] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem("reg_tab_rooms");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const selectedRoom = tabRooms[activeTab] || "";
  const setSelectedRoom = (roomId: string) => {
    setTabRooms((prev) => {
      const next = { ...prev, [activeTab]: roomId };
      try { localStorage.setItem("reg_tab_rooms", JSON.stringify(next)); } catch {}
      return next;
    });
  };
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedDate, setSelectedDate] = useState<string>(""); // Empty = show all data
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [cancelMjknId, setCancelMjknId] = useState<number | null>(null);
  const [printingType, setPrintingType] = useState<{ regId: number; type: 'queue' | 'label' } | null>(null);
  const [roomPopoverOpen, setRoomPopoverOpen] = useState(false);
  const [mjknQueueMap, setMjknQueueMap] = useState<Map<number, BPJSQueue>>(new Map());
  const [activatingCheckin, setActivatingCheckin] = useState<number | null>(null);
  const [scheduledTodayCount, setScheduledTodayCount] = useState(0);
  const [editPaymentReg, setEditPaymentReg] = useState<Registration | null>(null);

  // SPRI & SEP Ranap state
  const [spriMap, setSpriMap] = useState<Map<number, { no_spri: string; is_bpjs: boolean }>>(new Map());
  const [sepRanapMap, setSepRanapMap] = useState<Map<number, string>>(new Map());
  const [spriSheetReg, setSpriSheetReg] = useState<Registration | null>(null);
  const [sepRanapSheetReg, setSepRanapSheetReg] = useState<Registration | null>(null);
  const [spriPatient, setSpriPatient] = useState<Patient | null>(null);
  const [sepRanapPatient, setSepRanapPatient] = useState<Patient | null>(null);

  // Current tab definition
  const currentTab = REG_TABS.find((t) => t.key === activeTab) ?? REG_TABS[0];

  // Rooms filtered to match current tab's service types
  const tabRoomOptions = useMemo(() => {
    if (currentTab.serviceTypes.length === 0) return rooms;
    return rooms.filter((r) =>
      currentTab.serviceTypes.some(
        (st) => r.service_type?.toLowerCase() === st
      )
    );
  }, [rooms, currentTab]);

  // Badge counts: active (registered, in_queue, in_progress) per tab
  const tabBadgeCounts = useMemo(() => {
    const activeStatuses = ["registered", "in_queue", "in_progress", "scheduled"];
    const counts: Record<string, number> = {};
    for (const tab of REG_TABS) {
      if (tab.key === "") {
        // "Semua" tab: count all active
        counts[tab.key] = allRegistrations.filter((r) =>
          activeStatuses.includes(r.status)
        ).length;
      } else {
        counts[tab.key] = allRegistrations.filter(
          (r) =>
            tab.serviceTypes.some(
              (st) => r.destination_room?.service_type === st
            ) &&
            activeStatuses.includes(r.status)
        ).length;
      }
    }
    return counts;
  }, [allRegistrations]);

  // Persist active tab
  useEffect(() => {
    try {
      localStorage.setItem("reg_filter_tab", activeTab);
    } catch {}
  }, [activeTab]);

  const loadScheduledCount = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const response = await registrationApi.getScheduled({ date: today, status: "scheduled" });
      setScheduledTodayCount(response.data.summary?.today || response.data.data?.length || 0);
    } catch {
      // Silently fail
    }
  }, []);

  const loadMjknQueues = useCallback(async () => {
    try {
      // Load both booking and checkin MJKN queues to mark them in the table
      const [bookingRes, checkinRes] = await Promise.all([
        bpjsApi.getQueues({ status: "booking" }),
        bpjsApi.getQueues({ status: "checkin" }),
      ]);
      const allQueues = [
        ...(bookingRes.data.data || []),
        ...(checkinRes.data.data || []),
      ];
      const map = new Map<number, BPJSQueue>();
      for (const q of allQueues) {
        if (q.registration_id) {
          map.set(q.registration_id, q);
        }
      }
      setMjknQueueMap(map);
    } catch (error) {
      console.error("Failed to load MJKN queues:", error);
    }
  }, []);

  const handleActivateCheckin = async (queueId: number) => {
    setActivatingCheckin(queueId);
    try {
      await bpjsApi.activateQueueCheckin(queueId);
      toast({
        title: "Berhasil!",
        description: "Check-in MJKN berhasil diaktifkan",
      });
      loadMjknQueues();
      loadData();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Gagal mengaktifkan check-in";
      toast({
        variant: "destructive",
        title: "Error!",
        description: errorMessage,
      });
    } finally {
      setActivatingCheckin(null);
    }
  };

  const handleCancelMjkn = async () => {
    if (!cancelMjknId) return;
    try {
      await bpjsApi.cancelQueue(cancelMjknId);
      toast({
        title: "Antrian MJKN Dibatalkan",
        description: "Antrian MJKN berhasil dibatalkan.",
      });
      loadMjknQueues();
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.response?.data?.error || "Gagal membatalkan antrian MJKN.",
      });
    } finally {
      setCancelMjknId(null);
    }
  };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {
        limit: 1000, // Get all records
      };

      // Only add date filter if date is selected
      if (selectedDate) {
        params.date = selectedDate;
      }

      // Filter by room service_type (tab)
      if (activeTab) {
        params.service_type = activeTab;
      }

      if (selectedRoom)
        params.destination_room_id = parseInt(selectedRoom);
      if (selectedStatus !== "all") params.status = selectedStatus;

      const response = await registrationApi.getAll(params);

      // Sort by registration_date descending (newest first)
      const sortedData = (response.data.data || []).sort(
        (a: Registration, b: Registration) => {
          const dateA = a.registration_date
            ? new Date(a.registration_date).getTime()
            : 0;
          const dateB = b.registration_date
            ? new Date(b.registration_date).getTime()
            : 0;
          return dateB - dateA;
        }
      );

      setRegistrations(sortedData);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data pendaftaran.",
      });
    } finally {
      setLoading(false);
    }
  }, [selectedRoom, selectedStatus, selectedDate, activeTab, toast]);

  // Load all registrations (for badge counts), no type filter
  const loadAllRegistrations = useCallback(async () => {
    try {
      const params: Record<string, string | number> = { limit: 1000 };
      if (selectedDate) {
        params.date = selectedDate;
      }
      const response = await registrationApi.getAll(params);
      setAllRegistrations(response.data.data || []);
    } catch {
      // Silently fail
    }
  }, [selectedDate]);

  const loadRooms = useCallback(async () => {
    try {
      const response = await api.get("/rooms", {
        params: { limit: 100 },
      });
      // Include all service types except depo farmasi
      const filteredRooms = (response.data.data || []).filter(
        (room: Room) =>
          room.service_type &&
          [
            "rawat_jalan",
            "gawat_darurat",
            "penunjang_medis",
            "farmasi",
            "rawat_inap",
          ].includes(room.service_type) &&
          room.room_type !== "depo_farmasi"
      );
      setRooms(filteredRooms);
    } catch (error) {
      console.error("Failed to load rooms:", error);
    }
  }, []);

  useEffect(() => {
    setPageTitle("Pendaftaran");
    loadRooms();
    loadMjknQueues();
    loadScheduledCount();
  }, [loadRooms, loadMjknQueues, loadScheduledCount]);

  useEffect(() => {
    loadAllRegistrations();
  }, [loadAllRegistrations]);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => {
      loadData();
      loadAllRegistrations();
    }, 60000);
    return () => clearInterval(interval);
  }, [loadData, loadAllRegistrations]);

  // Load SPRI/SEP Ranap status for BPJS inpatient registrations
  const loadSPRIAndSEPData = useCallback(async (regs: Registration[]) => {
    const bpjsInpatient = regs.filter(
      (r) => r.payment_method === "bpjs" && r.registration_type === "inpatient"
    );
    if (bpjsInpatient.length === 0) return;

    const newSpriMap = new Map<number, { no_spri: string; is_bpjs: boolean }>();
    const newSepRanapMap = new Map<number, string>();

    await Promise.allSettled(
      bpjsInpatient.map(async (reg) => {
        const regId = reg.ID || reg.id || 0;
        const sourceVisit = reg.visits?.find((v) => v.visit_type !== "inpatient");
        const sourceVisitId = sourceVisit?.id || sourceVisit?.ID;
        const inpatientVisit = reg.visits?.find((v) => v.visit_type === "inpatient");
        const inpatientVisitId = inpatientVisit?.id || inpatientVisit?.ID;

        // SPRI
        try {
          if (sourceVisitId) {
            const res = await vclaimApi.getSPRIByVisit(sourceVisitId);
            if (res.data?.data?.no_spri) {
              newSpriMap.set(regId, { no_spri: res.data.data.no_spri, is_bpjs: res.data.data.is_bpjs });
            }
          }
        } catch {
          try {
            if (regId) {
              const res = await vclaimApi.getSPRIByRegistration(regId);
              if (res.data?.data?.no_spri) {
                newSpriMap.set(regId, { no_spri: res.data.data.no_spri, is_bpjs: res.data.data.is_bpjs });
              }
            }
          } catch { /* not found */ }
        }

        // SEP Ranap
        try {
          if (inpatientVisitId) {
            const res = await vclaimApi.getSEPByVisit(inpatientVisitId);
            if (res.data?.data?.no_sep && res.data.data.jns_pelayanan === "1") {
              newSepRanapMap.set(regId, res.data.data.no_sep);
            }
          }
        } catch { /* not found */ }
        if (!newSepRanapMap.has(regId)) {
          try {
            if (regId) {
              const res = await vclaimApi.getSEPList({ registration_id: regId, status: "active" });
              const ranapSEP = res.data?.data?.find((s: SEPLocal) => s.jns_pelayanan === "1");
              if (ranapSEP?.no_sep) {
                newSepRanapMap.set(regId, ranapSEP.no_sep);
              }
            }
          } catch { /* not found */ }
        }
      })
    );

    setSpriMap(newSpriMap);
    setSepRanapMap(newSepRanapMap);
  }, []);

  useEffect(() => {
    if (registrations.length > 0) {
      loadSPRIAndSEPData(registrations);
    }
  }, [registrations, loadSPRIAndSEPData]);

  const handleOpenSPRI = async (reg: Registration) => {
    // Load patient — that's all we need, activeSEP is optional now
    try {
      const patRes = await patientsApi.getById(reg.patient_id);
      setSpriPatient(patRes.data);
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Gagal memuat data pasien" });
      return;
    }
    setSpriSheetReg(reg);
  };

  const handleOpenSEPRanap = async (reg: Registration) => {
    try {
      const patRes = await patientsApi.getById(reg.patient_id);
      setSepRanapPatient(patRes.data);
    } catch {
      toast({ variant: "destructive", title: "Error", description: "Gagal memuat data pasien" });
      return;
    }
    setSepRanapSheetReg(reg);
  };

  const handleCancel = async () => {
    if (!cancelId) return;
    try {
      await registrationApi.cancel(cancelId);
      toast({
        title: "Pendaftaran Dibatalkan",
        description: "Pendaftaran berhasil dibatalkan.",
      });
      loadData();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.response?.data?.error || "Gagal membatalkan pendaftaran.",
      });
    } finally {
      setCancelId(null);
    }
  };

  const handleView = (id: number) => {
    navigate(`/registrations/show/${id}`);
  };

  const handlePrintQueueTicket = async (registration: Registration) => {
    if (!registration.visit?.room_queue) {
      toast({
        title: "Error",
        description: "Nomor antrian tidak tersedia",
        variant: "destructive",
      });
      return;
    }

    const regId = registration.ID || registration.id || 0;
    setPrintingType({ regId, type: 'queue' });
    try {
      const url = await printApi.queueTicket(registration.visit.room_queue.id);
      window.open(url, "_blank");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Gagal mencetak tiket antrian",
        variant: "destructive",
      });
    } finally {
      setPrintingType(null);
    }
  };

  const handlePrintPatientLabel = async (registration: Registration) => {
    if (!registration.patient?.id) {
      toast({
        title: "Error",
        description: "Data pasien tidak tersedia",
        variant: "destructive",
      });
      return;
    }

    const regId = registration.ID || registration.id || 0;
    setPrintingType({ regId, type: 'label' });
    try {
      const url = await printApi.patientLabel(registration.patient.id, 4);
      window.open(url, "_blank");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.error || "Gagal mencetak label pasien",
        variant: "destructive",
      });
    } finally {
      setPrintingType(null);
    }
  };

  const columns = createRegistrationColumns({
    onView: handleView,
    onPrintQueueTicket: handlePrintQueueTicket,
    onPrintPatientLabel: handlePrintPatientLabel,
    onCancel: setCancelId,
    onCancelMjkn: setCancelMjknId,
    onActivateMjkn: handleActivateCheckin,
    onEditPayment: (reg: Registration) => setEditPaymentReg(reg),
    onCreateSPRI: handleOpenSPRI,
    onCreateSEPRanap: handleOpenSEPRanap,
    hasViewPermission: hasPermission("registrations.view"),
    hasDeletePermission: hasPermission("registrations.delete"),
    printingType,
    mjknQueueMap,
    activatingCheckin,
    spriMap,
    sepRanapMap,
  });

  if (loading && registrations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const roomFilterSlot = (
    <div className="flex items-center gap-2">
      <Popover open={roomPopoverOpen} onOpenChange={setRoomPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className={cn(
              "h-9 w-[220px] justify-between font-normal",
              !selectedRoom && "text-muted-foreground"
            )}
          >
            <span className="truncate">
              {selectedRoom
                ? (() => {
                    const r = rooms.find((r) => r.id.toString() === selectedRoom);
                    return r ? `${r.code} - ${r.name}` : "Semua Ruangan";
                  })()
                : "Semua Ruangan"}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[260px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Cari ruangan..." />
            <CommandList>
              <CommandEmpty>Ruangan tidak ditemukan.</CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="Semua Ruangan"
                  onSelect={() => { setSelectedRoom(""); setRoomPopoverOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", !selectedRoom ? "opacity-100" : "opacity-0")} />
                  Semua Ruangan
                </CommandItem>
                {(tabRoomOptions.length > 0 ? tabRoomOptions : rooms).map((room) => (
                  <CommandItem
                    key={room.id}
                    value={`${room.code} ${room.name}`}
                    onSelect={() => { setSelectedRoom(room.id.toString()); setRoomPopoverOpen(false); }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", selectedRoom === room.id.toString() ? "opacity-100" : "opacity-0")} />
                    {room.code} - {room.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedRoom && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          onClick={() => setSelectedRoom("")}
        >
          <RefreshCcw className="h-3.5 w-3.5" />
        </Button>
      )}
      {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
    </div>
  );

  return (
    <div className="flex flex-1 flex-col p-4">
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold">Pendaftaran Pasien</h1>
          <p className="text-sm text-muted-foreground">
            {selectedDate
              ? format(new Date(selectedDate), "EEEE, dd MMMM yyyy", {
                  locale: idLocale,
                })
              : "Semua Data"}
            {selectedRoom && rooms.find((r) => r.id.toString() === selectedRoom) && (
              <>
                {" · "}
                <span className="text-primary">
                  {rooms.find((r) => r.id.toString() === selectedRoom)?.name}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/registrations/scheduled")}
            className="relative h-8 text-xs"
          >
            <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
            Jadwal Kontrol
            {scheduledTodayCount > 0 && (
              <Badge className="ml-1.5 h-5 min-w-5 px-1.5 text-[10px] font-semibold bg-blue-500 hover:bg-blue-500 text-white rounded-full">
                {scheduledTodayCount}
              </Badge>
            )}
          </Button>
          {hasPermission("registrations.create") && (
            <Button
              onClick={() => navigate("/registrations/create")}
              size="sm"
              className="h-8 text-xs"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              Tambah Pendaftaran
            </Button>
          )}
          <Button
            variant={filterOpen ? "secondary" : "outline"}
            size="sm"
            className="h-8 text-xs"
            onClick={() => setFilterOpen(!filterOpen)}
          >
            <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
            Filter
            {(selectedDate || selectedStatus !== "all") && (
              <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-primary inline-block" />
            )}
          </Button>
        </div>
      </div>

      {/* ── Filter Panel ─────────────────────────────────────────── */}
      {filterOpen && (
        <div className="flex items-center gap-2 flex-wrap p-3 border rounded-lg bg-muted/30">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="h-8 w-36 text-xs"
          />
          {selectedDate && (
            <Button variant="ghost" size="sm" onClick={() => setSelectedDate("")} className="h-8 px-2 text-xs">
              ✕ Reset Tgl
            </Button>
          )}
          <div className="h-5 border-r" />
          <Select
            value={selectedStatus}
            onValueChange={setSelectedStatus}
          >
            <SelectTrigger className="h-8 w-[155px] text-xs">
              <SelectValue placeholder="Semua Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Status</SelectItem>
              <SelectItem value="scheduled">Terjadwal (MJKN)</SelectItem>
              <SelectItem value="registered">Terdaftar</SelectItem>
              <SelectItem value="in_queue">Dalam Antrean</SelectItem>
              <SelectItem value="in_progress">Sedang Diproses</SelectItem>
              <SelectItem value="completed">Selesai</SelectItem>
              <SelectItem value="discharged">Sudah Pulang</SelectItem>
              <SelectItem value="cancelled">Dibatalkan</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => { loadData(); loadAllRegistrations(); }}
          >
            <RefreshCcw className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────── */}
      <div className="flex items-end gap-0 border-b overflow-x-auto">
        {REG_TABS.map((tab) => {
          const count = tabBadgeCounts[tab.key] ?? 0;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); setRoomPopoverOpen(false); }}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
              {count > 0 && (
                <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 text-[10px] font-semibold rounded-full bg-destructive text-destructive-foreground">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Data Table ───────────────────────────────────────────── */}
      <DataTable
        columns={columns}
        data={registrations}
        searchPlaceholder="Cari no. registrasi, nama pasien, atau no. RM..."
        pageSize={10}
        tableId="registrations"
        searchSlot={roomFilterSlot}
      />

      {/* Confirm dialog for regular registration cancellation */}
      <ConfirmDialog
        open={cancelId !== null}
        onOpenChange={(open) => !open && setCancelId(null)}
        onConfirm={handleCancel}
        title="Batalkan Pendaftaran?"
        description="Apakah Anda yakin ingin membatalkan pendaftaran ini?"
        confirmText="Ya, Batalkan"
        cancelText="Tidak"
        variant="destructive"
      />

      {/* Confirm dialog for MJKN queue cancellation */}
      <ConfirmDialog
        open={cancelMjknId !== null}
        onOpenChange={(open) => !open && setCancelMjknId(null)}
        onConfirm={handleCancelMjkn}
        title="Batalkan Antrian MJKN?"
        description="Apakah Anda yakin ingin membatalkan antrian Mobile JKN ini? Pendaftaran dan kunjungan terkait juga akan dibatalkan."
        confirmText="Ya, Batalkan"
        cancelText="Tidak"
        variant="destructive"
      />

      {/* Edit Payment Dialog */}
      {editPaymentReg && (
        <EditPaymentDialog
          open={!!editPaymentReg}
          onOpenChange={(open) => !open && setEditPaymentReg(null)}
          registrationId={editPaymentReg.ID || editPaymentReg.id || 0}
          currentPaymentMethod={editPaymentReg.payment_method}
          currentBpjsNumber={editPaymentReg.bpjs_number}
          currentInsuranceName={editPaymentReg.insurance_name}
          currentInsuranceNumber={editPaymentReg.insurance_number}
          patientBpjsNumber={editPaymentReg.patient?.no_bpjs}
          onSuccess={() => { loadData(); loadAllRegistrations(); }}
        />
      )}

      {/* SPRI Form Sheet */}
      {spriSheetReg && spriPatient && (
        <SPRIFormSheet
          open={!!spriSheetReg}
          onOpenChange={(open) => { if (!open) { setSpriSheetReg(null); setSpriPatient(null); } }}
          patient={{
            id: spriPatient.id,
            no_rm: spriPatient.no_rm,
            nama_lengkap: spriPatient.nama_lengkap,
            nik: spriPatient.nik,
            no_bpjs: spriPatient.no_bpjs,
            tanggal_lahir: spriPatient.tanggal_lahir,
            jenis_kelamin: spriPatient.jenis_kelamin,
          }}
          visitId={spriSheetReg.visits?.find((v) => v.visit_type !== "inpatient")?.id || spriSheetReg.visits?.find((v) => v.visit_type !== "inpatient")?.ID || 0}
          registrationId={spriSheetReg.ID || spriSheetReg.id}
          onSPRICreated={(spriData) => {
            const regId = spriSheetReg.ID || spriSheetReg.id || 0;
            setSpriMap((prev) => new Map(prev).set(regId, { no_spri: spriData.noSPRI, is_bpjs: true }));
            toast({ title: "Berhasil", description: `SPRI berhasil dibuat: ${spriData.noSPRI}` });
            setSpriSheetReg(null);
            setSpriPatient(null);
          }}
        />
      )}

      {/* SEP Ranap Form Sheet */}
      {sepRanapSheetReg && sepRanapPatient && (
        <SEPFormSheet
          open={!!sepRanapSheetReg}
          onOpenChange={(open) => { if (!open) { setSepRanapSheetReg(null); setSepRanapPatient(null); } }}
          patient={{
            id: sepRanapPatient.id,
            no_rm: sepRanapPatient.no_rm,
            nama_lengkap: sepRanapPatient.nama_lengkap,
            nik: sepRanapPatient.nik,
            no_bpjs: sepRanapPatient.no_bpjs,
            tanggal_lahir: sepRanapPatient.tanggal_lahir,
            jenis_kelamin: sepRanapPatient.jenis_kelamin,
            no_telepon: sepRanapPatient.no_telepon,
            kelas_bpjs: sepRanapPatient.kelas_bpjs,
          }}
          visitId={sepRanapSheetReg.visits?.find((v) => v.visit_type === "inpatient")?.id || sepRanapSheetReg.visits?.find((v) => v.visit_type === "inpatient")?.ID || undefined}
          registrationId={sepRanapSheetReg.ID || sepRanapSheetReg.id}
          initialValues={{
            jenisPelayanan: "1",
          }}
          onSEPCreated={(noSEP) => {
            const regId = sepRanapSheetReg.ID || sepRanapSheetReg.id || 0;
            setSepRanapMap((prev) => new Map(prev).set(regId, noSEP));
            toast({ title: "Berhasil", description: `SEP Rawat Inap berhasil dibuat: ${noSEP}` });
            setSepRanapSheetReg(null);
            setSepRanapPatient(null);
          }}
        />
      )}
    </div>
  );
}
