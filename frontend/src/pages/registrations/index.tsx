import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";

import { DataTable } from "@/components/ui/data-table";
import type { ColumnDef } from "@tanstack/react-table";
import { createRegistrationColumns } from "./columns";
import { registrationApi, type Registration } from "@/lib/api/queue";
import { bpjsApi, type BPJSQueue } from "@/lib/api/bpjs";
import { patientsApi, type Patient } from "@/lib/api";
import { visitsApi, type Visit } from "@/lib/api/visits";
import { vclaimApi, type SEPLocal } from "@/lib/api/vclaim";
import { admissionRequestApi, type AdmissionRequest } from "@/lib/api/admission-request";
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
  CalendarClock,
  Clock,
  Eye,
  SlidersHorizontal,
  XCircle,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
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
import { ScrollArea } from "@/components/ui/scroll-area";
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
  key: string;
  label: string;        // displayed label
  serviceTypes: string[]; // service_type values used to filter room dropdown
  mode?: "registrations" | "admission_requests";
}

const REGISTRATION_STATUS_OPTIONS = [
  { value: "all", label: "Semua" },
  { value: "scheduled", label: "Terjadwal" },
  { value: "registered", label: "Terdaftar" },
  { value: "in_queue", label: "Dalam Antrean" },
  { value: "in_progress", label: "Diproses" },
  { value: "completed", label: "Selesai" },
  { value: "discharged", label: "Pulang" },
  { value: "cancelled", label: "Dibatalkan" },
];

const ADMISSION_STATUS_OPTIONS = [
  { value: "all", label: "Semua" },
  { value: "pending", label: "Menunggu" },
  { value: "approved", label: "Disetujui" },
  { value: "rejected", label: "Ditolak" },
  { value: "cancelled", label: "Dibatalkan" },
];

const REG_TAB_ALL = "__all__";

const normalizeRegTabKey = (value: string | null | undefined) => {
  if (!value) return REG_TAB_ALL;
  return REG_TABS.some((tab) => tab.key === value) ? value : REG_TAB_ALL;
};

const normalizeRegistrationStatus = (value: string | null | undefined) => {
  if (!value) return "all";
  return REGISTRATION_STATUS_OPTIONS.some((option) => option.value === value) ? value : "all";
};

const normalizeAdmissionStatus = (value: string | null | undefined) => {
  if (!value) return "all";
  return ADMISSION_STATUS_OPTIONS.some((option) => option.value === value) ? value : "all";
};

const REG_TABS: RegTab[] = [
  {
    key: REG_TAB_ALL,
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
  {
    key: "laboratory",
    label: "Laboratorium",
    serviceTypes: ["laboratorium", "laboratorium_pk", "laboratorium_pa", "lab", "laboratory"],
  },
  {
    key: "radiology",
    label: "Radiologi",
    serviceTypes: ["radiologi", "radiology"],
  },
  {
    key: "pharmacy",
    label: "Farmasi",
    serviceTypes: ["farmasi", "depo_farmasi", "gudang_farmasi", "apotek", "pharmacy"],
  },
  {
    key: "admission_requests",
    label: "Permintaan Rawat Inap",
    serviceTypes: [],
    mode: "admission_requests",
  },
];

export default function RegistrationIndex() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { hasPermission } = usePermission();
  const { toast } = useToast();
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [allRegistrations, setAllRegistrations] = useState<Registration[]>([]);
  const [loading, setLoading] = useState(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [activeTab, setActiveTab] = useState<string>(() => normalizeRegTabKey(searchParams.get("tab") || sessionStorage.getItem("reg_tab")));
  const [selectedRoom, setSelectedRoom] = useState<string>(() => searchParams.get("room") || sessionStorage.getItem("reg_room") || "");
  const [selectedStatus, setSelectedStatus] = useState<string>(() => normalizeRegistrationStatus(searchParams.get("status") || sessionStorage.getItem("reg_status")));
  const [selectedAdmissionStatus, setSelectedAdmissionStatus] = useState<string>(() => normalizeAdmissionStatus(searchParams.get("admissionStatus") || sessionStorage.getItem("reg_admission_status")));
  const [selectedDate, setSelectedDate] = useState<string>(() => searchParams.get("date") || sessionStorage.getItem("reg_date") || ""); // Empty = show all data
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [serviceTypeOpen, setServiceTypeOpen] = useState(false);
  const [draftSelectedRoom, setDraftSelectedRoom] = useState<string>("");
  const [draftSelectedStatus, setDraftSelectedStatus] = useState<string>("all");
  const [draftSelectedAdmissionStatus, setDraftSelectedAdmissionStatus] = useState<string>("all");
  const [draftSelectedDate, setDraftSelectedDate] = useState<string>("");
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [cancelMjknId, setCancelMjknId] = useState<number | null>(null);
  const [printingType, setPrintingType] = useState<{ regId: number; type: 'queue' | 'label' } | null>(null);
  const [roomPopoverOpen, setRoomPopoverOpen] = useState(false);
  const [mjknQueueMap, setMjknQueueMap] = useState<Map<number, BPJSQueue>>(new Map());
  const [activatingCheckin, setActivatingCheckin] = useState<number | null>(null);
  const [scheduledTodayCount, setScheduledTodayCount] = useState(0);
  const [editPaymentReg, setEditPaymentReg] = useState<Registration | null>(null);
  const [admissionRequests, setAdmissionRequests] = useState<AdmissionRequest[]>([]);
  const [pendingAdmissionCount, setPendingAdmissionCount] = useState(0);
  const [journeyDialogOpen, setJourneyDialogOpen] = useState(false);
  const [journeyRegistration, setJourneyRegistration] = useState<Registration | null>(null);
  const [journeyLoading, setJourneyLoading] = useState(false);
  const [journeyDetailsLoaded, setJourneyDetailsLoaded] = useState(false);
  const [journeyVisitDetails, setJourneyVisitDetails] = useState<Map<number, Visit>>(new Map());
  const [journeyNodeLimit, setJourneyNodeLimit] = useState(8);
  const [journeyExpandedNodes, setJourneyExpandedNodes] = useState<Set<string>>(new Set());

  // SPRI & SEP Ranap state
  const [spriMap, setSpriMap] = useState<Map<number, { no_spri: string; is_bpjs: boolean }>>(new Map());
  const [sepRanapMap, setSepRanapMap] = useState<Map<number, string>>(new Map());
  const [spriSheetReg, setSpriSheetReg] = useState<Registration | null>(null);
  const [sepRanapSheetReg, setSepRanapSheetReg] = useState<Registration | null>(null);
  const [spriPatient, setSpriPatient] = useState<Patient | null>(null);
  const [sepRanapPatient, setSepRanapPatient] = useState<Patient | null>(null);
  const spriSepLoadedRegIdsRef = useRef<Set<number>>(new Set());

  // Current tab definition
  const currentTab = REG_TABS.find((t) => t.key === activeTab) ?? REG_TABS[0];
  const isAdmissionRequestTab = currentTab.mode === "admission_requests";

  useEffect(() => {
    const nextTab = normalizeRegTabKey(searchParams.get("tab") || sessionStorage.getItem("reg_tab"));
    const nextRoom = searchParams.get("room") || sessionStorage.getItem("reg_room") || "";
    const nextStatus = normalizeRegistrationStatus(searchParams.get("status") || sessionStorage.getItem("reg_status"));
    const nextAdmissionStatus = normalizeAdmissionStatus(searchParams.get("admissionStatus") || sessionStorage.getItem("reg_admission_status"));
    const nextDate = searchParams.get("date") || sessionStorage.getItem("reg_date") || "";

    setActiveTab((prev) => (prev === nextTab ? prev : nextTab));
    setSelectedRoom((prev) => (prev === nextRoom ? prev : nextRoom));
    setSelectedStatus((prev) => (prev === nextStatus ? prev : nextStatus));
    setSelectedAdmissionStatus((prev) => (prev === nextAdmissionStatus ? prev : nextAdmissionStatus));
    setSelectedDate((prev) => (prev === nextDate ? prev : nextDate));
  }, [searchParams]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);

    if (activeTab !== REG_TAB_ALL) nextParams.set("tab", activeTab);
    else nextParams.delete("tab");

    if (selectedRoom) nextParams.set("room", selectedRoom);
    else nextParams.delete("room");

    if (selectedStatus !== "all") nextParams.set("status", selectedStatus);
    else nextParams.delete("status");

    if (selectedAdmissionStatus !== "all") nextParams.set("admissionStatus", selectedAdmissionStatus);
    else nextParams.delete("admissionStatus");

    if (selectedDate) nextParams.set("date", selectedDate);
    else nextParams.delete("date");

    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }

    sessionStorage.setItem("reg_tab", activeTab);
    sessionStorage.setItem("reg_room", selectedRoom);
    sessionStorage.setItem("reg_status", selectedStatus);
    sessionStorage.setItem("reg_admission_status", selectedAdmissionStatus);
    sessionStorage.setItem("reg_date", selectedDate);
  }, [activeTab, searchParams, selectedAdmissionStatus, selectedDate, selectedRoom, selectedStatus, setSearchParams]);

  useEffect(() => {
    if (!filterDialogOpen) {
      setRoomPopoverOpen(false);
      return;
    }

    setDraftSelectedDate(selectedDate);
    setDraftSelectedRoom(selectedRoom);
    setDraftSelectedStatus(selectedStatus);
    setDraftSelectedAdmissionStatus(selectedAdmissionStatus);
  }, [filterDialogOpen, selectedDate, selectedRoom, selectedStatus, selectedAdmissionStatus]);

  const handleTabChange = (tabKey: string) => {
    setActiveTab(tabKey);
    setSelectedRoom("");
    setRoomPopoverOpen(false);
  };

  // Rooms filtered to match current tab's service types
  const tabRoomOptions = useMemo(() => {
    if (currentTab.serviceTypes.length === 0) return rooms;
    return rooms.filter((r) =>
      currentTab.serviceTypes.some((st) => {
        const serviceType = r.service_type?.toLowerCase();
        const roomType = r.room_type?.toLowerCase();
        return serviceType === st || roomType === st;
      })
    );
  }, [rooms, currentTab]);

  // Badge counts: active (registered, in_queue, in_progress) per tab
  const tabBadgeCounts = useMemo(() => {
    const activeStatuses = ["registered", "in_queue", "in_progress", "scheduled"];
    const counts: Record<string, number> = {};
    for (const tab of REG_TABS) {
      if (tab.mode === "admission_requests") {
        counts[tab.key] = pendingAdmissionCount;
        continue;
      }
      if (tab.key === REG_TAB_ALL) {
        // "Semua" tab: count all active
        counts[tab.key] = allRegistrations.filter((r) =>
          activeStatuses.includes(r.status)
        ).length;
      } else {
        counts[tab.key] = allRegistrations.filter((r) => {
          const serviceType = r.destination_room?.service_type?.toLowerCase();
          const roomType = r.destination_room?.room_type?.toLowerCase();
          return (
            tab.serviceTypes.some(
              (st) => serviceType === st || roomType === st
            ) &&
            activeStatuses.includes(r.status)
          );
        }).length;
      }
    }
    return counts;
  }, [allRegistrations, pendingAdmissionCount]);

  const totalServiceTypeCount = useMemo(
    () => Object.values(tabBadgeCounts).reduce((sum, count) => sum + count, 0),
    [tabBadgeCounts],
  );

  useEffect(() => {
    try {
      [
        "reg_filter_tab",
        "reg_tab_rooms",
        "dt_search_registrations",
        "dt_page_registrations",
        "dt_size_registrations",
        "dt_search_admission-requests-in-registrations",
        "dt_page_admission-requests-in-registrations",
        "dt_size_admission-requests-in-registrations",
      ].forEach((key) => localStorage.removeItem(key));
    } catch {}
  }, []);

  const loadScheduledCount = useCallback(async () => {
    try {
      const today = new Date().toISOString().split("T")[0];
      const response = await registrationApi.getScheduled({ date: today, status: "scheduled" });
      setScheduledTodayCount(response.data.summary?.today || response.data.data?.length || 0);
    } catch {
      // Silently fail
    }
  }, []);

  const loadAdmissionRequests = useCallback(async () => {
    setLoading(true);
    try {
      const response = await admissionRequestApi.getAll({
        status: selectedAdmissionStatus === "all" ? undefined : selectedAdmissionStatus,
        limit: 1000,
      });
      setAdmissionRequests(response.data.data || []);
    } catch {
      setAdmissionRequests([]);
    } finally {
      setLoading(false);
    }
  }, [selectedAdmissionStatus]);

  const loadPendingAdmissionCount = useCallback(async () => {
    try {
      const response = await admissionRequestApi.getPendingCount();
      setPendingAdmissionCount(response.data.count || 0);
    } catch {
      setPendingAdmissionCount(0);
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
      if (activeTab !== REG_TAB_ALL) {
        const serviceTypeMap: Record<string, string> = {
          laboratory: "penunjang_medis",
          radiology: "penunjang_medis",
          pharmacy: "farmasi",
        };
        params.service_type = serviceTypeMap[activeTab] || activeTab;
      }

      if (selectedRoom)
        params.destination_room_id = parseInt(selectedRoom);
      if (selectedStatus !== "all") params.status = selectedStatus;

      const response = await registrationApi.getAll(params);
      let registrationsData = response.data.data || [];

      if (activeTab === "laboratory") {
        const validRoomTypes = ["laboratorium", "laboratorium_pk", "laboratorium_pa", "lab", "laboratory"];
        registrationsData = registrationsData.filter((r) => {
          const roomType = r.destination_room?.room_type?.toLowerCase();
          return validRoomTypes.includes(roomType || "");
        });
      } else if (activeTab === "radiology") {
        registrationsData = registrationsData.filter((r) => {
          const roomType = r.destination_room?.room_type?.toLowerCase();
          return roomType === "radiologi" || roomType === "radiology";
        });
      } else if (activeTab === "pharmacy") {
        const validRoomTypes = ["farmasi", "depo_farmasi", "gudang_farmasi", "apotek", "pharmacy"];
        registrationsData = registrationsData.filter((r) => {
          const roomType = r.destination_room?.room_type?.toLowerCase();
          const serviceType = r.destination_room?.service_type?.toLowerCase();
          return serviceType === "farmasi" || validRoomTypes.includes(roomType || "");
        });
      }

      // Sort by registration_date descending (newest first)
      const sortedData = registrationsData.sort(
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
    loadPendingAdmissionCount();
  }, [loadRooms, loadMjknQueues, loadScheduledCount, loadPendingAdmissionCount]);

  useEffect(() => {
    loadAllRegistrations();
  }, [loadAllRegistrations]);

  useEffect(() => {
    if (!isAdmissionRequestTab) {
      loadData();
    } else {
      loadAdmissionRequests();
      loadPendingAdmissionCount();
    }

    const interval = setInterval(() => {
      if (!isAdmissionRequestTab) {
        loadData();
      } else {
        loadAdmissionRequests();
      }
      loadAllRegistrations();
      loadPendingAdmissionCount();
    }, 60000);

    return () => clearInterval(interval);
  }, [
    loadData,
    isAdmissionRequestTab,
    loadAdmissionRequests,
    loadPendingAdmissionCount,
  ]);

  // Load SPRI/SEP Ranap status for BPJS inpatient registrations
  const loadSPRIAndSEPData = useCallback(async (regs: Registration[]) => {
    const bpjsInpatient = regs
      .filter((r) => r.payment_method === "bpjs" && r.registration_type === "inpatient")
      .filter((r) => {
        const regId = r.ID || r.id || 0;
        return regId > 0 && !spriSepLoadedRegIdsRef.current.has(regId);
      });

    if (bpjsInpatient.length === 0) return;

    const newSpriMap = new Map<number, { no_spri: string; is_bpjs: boolean }>();
    const newSepRanapMap = new Map<number, string>();
    const processedRegIds = new Set<number>();

    await Promise.allSettled(
      bpjsInpatient.map(async (reg) => {
        const regId = reg.ID || reg.id || 0;
        if (regId <= 0) return;

        processedRegIds.add(regId);
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

    if (newSpriMap.size > 0) {
      setSpriMap((prev) => {
        const merged = new Map(prev);
        for (const [key, value] of newSpriMap.entries()) {
          merged.set(key, value);
        }
        return merged;
      });
    }

    if (newSepRanapMap.size > 0) {
      setSepRanapMap((prev) => {
        const merged = new Map(prev);
        for (const [key, value] of newSepRanapMap.entries()) {
          merged.set(key, value);
        }
        return merged;
      });
    }

    for (const regId of processedRegIds) {
      spriSepLoadedRegIdsRef.current.add(regId);
    }
  }, []);

  useEffect(() => {
    if (!isAdmissionRequestTab && registrations.length > 0) {
      loadSPRIAndSEPData(registrations);
    }
  }, [isAdmissionRequestTab, registrations, loadSPRIAndSEPData]);

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

  const handleOpenJourney = (registration: Registration) => {
    setJourneyLoading(false);
    setJourneyDetailsLoaded(false);
    setJourneyNodeLimit(8);
    setJourneyExpandedNodes(new Set());
    setJourneyVisitDetails(new Map());
    setJourneyRegistration(registration);
    setJourneyDialogOpen(true);
  };

  const toggleJourneyNode = (nodeKey: string) => {
    const shouldExpand = !journeyExpandedNodes.has(nodeKey);
    if (shouldExpand && !journeyDetailsLoaded && !journeyLoading) {
      void loadJourneyDetails();
    }

    setJourneyExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeKey)) next.delete(nodeKey);
      else next.add(nodeKey);
      return next;
    });
  };

  const loadJourneyDetails = useCallback(async () => {
    if (!journeyRegistration || journeyLoading || journeyDetailsLoaded) return;

    const visitIds = (journeyRegistration.visits || [])
      .map((v) => v.ID || v.id)
      .filter((id): id is number => typeof id === "number" && id > 0);

    if (visitIds.length === 0) {
      setJourneyVisitDetails(new Map());
      setJourneyDetailsLoaded(true);
      return;
    }

    setJourneyLoading(true);
    const results = await Promise.allSettled(visitIds.map((visitId) => visitsApi.getById(visitId)));

    const nextMap = new Map<number, Visit>();
    results.forEach((result, index) => {
      const visitId = visitIds[index];
      if (result.status === "fulfilled" && result.value?.data) {
        nextMap.set(visitId, result.value.data);
      }
    });

    setJourneyVisitDetails(nextMap);
    setJourneyDetailsLoaded(true);
    setJourneyLoading(false);
  }, [journeyRegistration, journeyLoading, journeyDetailsLoaded]);

  const getVisitTypeLabel = (visitType?: string) => {
    switch ((visitType || "").toLowerCase()) {
      case "outpatient":
        return "Rawat Jalan";
      case "emergency":
        return "UGD / IGD";
      case "inpatient":
        return "Rawat Inap";
      case "radiology":
        return "Order Radiologi";
      case "lab":
      case "laboratory":
        return "Order Laboratorium";
      case "pharmacy":
        return "Order Farmasi";
      case "consultation":
        return "Konsultasi";
      case "surgery":
        return "Operasi";
      default:
        return visitType || "Kunjungan";
    }
  };

  const getVisitStatusBadge = (status?: string) => {
    const value = (status || "").toLowerCase();
    if (value === "completed" || value === "done") {
      return <Badge className="bg-green-100 text-green-700">Selesai</Badge>;
    }
    if (value === "in_progress" || value === "serving") {
      return <Badge className="bg-blue-100 text-blue-700">Berjalan</Badge>;
    }
    if (value === "cancelled") {
      return <Badge className="bg-red-100 text-red-700">Batal</Badge>;
    }
    if (value === "waiting" || value === "in_queue") {
      return <Badge className="bg-amber-100 text-amber-700">Menunggu</Badge>;
    }
    return <Badge variant="outline">{status || "-"}</Badge>;
  };

  const getDoctorName = (visit?: Partial<Visit>) => {
    const doctor = visit?.doctor as any;
    return doctor?.nama_lengkap || doctor?.nama || doctor?.name || "-";
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
    onViewJourney: handleOpenJourney,
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

  const getAdmissionStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-300"><Clock className="h-3 w-3 mr-1" /> Menunggu</Badge>;
      case "approved":
        return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-300">Disetujui</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-300"><XCircle className="h-3 w-3 mr-1" /> Ditolak</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-300">Dibatalkan</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const admissionColumns: ColumnDef<AdmissionRequest>[] = [
    {
      accessorKey: "request_number",
      header: "No. Request",
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.request_number}</span>,
    },
    {
      id: "patient",
      header: "Pasien",
      cell: ({ row }) => {
        const patient = row.original.patient || row.original.registration?.patient || row.original.source_visit?.registration?.patient;
        return (
          <div>
            <Link
              to={`/patient-search/${patient?.id}`}
              className="font-medium hover:underline hover:text-primary"
            >
              {patient?.name || patient?.nama_lengkap || "N/A"}
            </Link>
            <p className="text-xs text-muted-foreground">RM: {patient?.medical_record_number || patient?.no_rm || "N/A"}</p>
          </div>
        );
      },
    },
    {
      accessorKey: "source_visit",
      header: "Asal Unit",
      cell: ({ row }) => {
        const visit = row.original.source_visit;
        return visit?.id ? (
          <Link to={`/visits/${visit.id}`} className="hover:underline hover:text-primary flex items-center gap-1">
            {visit?.room?.name || "N/A"}
            <ExternalLink className="h-3 w-3" />
          </Link>
        ) : (
          <span>{visit?.room?.name || "N/A"}</span>
        );
      },
    },
    {
      accessorKey: "admission_type",
      header: "Tipe",
      cell: ({ row }) => <span className="capitalize">{row.original.admission_type}</span>,
    },
    {
      accessorKey: "requested_at",
      header: "Tanggal Request",
      cell: ({ row }) => (
        <div className="text-sm">
          {row.original.requested_at
            ? format(new Date(row.original.requested_at), "dd MMM yyyy HH:mm", { locale: idLocale })
            : "N/A"}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => getAdmissionStatusBadge(row.original.status),
    },
    {
      id: "actions",
      header: "Aksi",
      cell: ({ row }) => {
        const request = row.original;
        if (request.status === "pending") {
          return (
            <Button size="sm" asChild>
              <Link to={`/admisi/${request.id}`}>
                <ArrowRight className="h-4 w-4 mr-1" />
                Proses
              </Link>
            </Button>
          );
        }
        return request.inpatient_visit_id ? (
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/visits/${request.inpatient_visit_id}`}>
              <Eye className="h-4 w-4 mr-1" />
              Lihat
            </Link>
          </Button>
        ) : (
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/admisi/${request.id}`}>
              <Eye className="h-4 w-4 mr-1" />
              Detail
            </Link>
          </Button>
        );
      },
    },
  ];

  if (
    loading &&
    ((isAdmissionRequestTab && admissionRequests.length === 0) ||
      (!isAdmissionRequestTab && registrations.length === 0))
  ) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const renderRoomFilterSlot = (
    roomValue: string,
    onRoomChange: (roomId: string) => void,
  ) => (
    <div className="flex items-center gap-2">
      <Popover open={roomPopoverOpen} onOpenChange={setRoomPopoverOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className={cn(
              "h-9 w-[220px] justify-between font-normal",
              !roomValue && "text-muted-foreground"
            )}
          >
            <span className="truncate">
              {roomValue
                ? (() => {
                  const r = rooms.find((r) => r.id.toString() === roomValue);
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
                  onSelect={() => { onRoomChange(""); setRoomPopoverOpen(false); }}
                >
                  <Check className={cn("mr-2 h-4 w-4", !roomValue ? "opacity-100" : "opacity-0")} />
                  Semua Ruangan
                </CommandItem>
                {(tabRoomOptions.length > 0 ? tabRoomOptions : rooms).map((room) => (
                  <CommandItem
                    key={room.id}
                    value={`${room.code} ${room.name}`}
                    onSelect={() => { onRoomChange(room.id.toString()); setRoomPopoverOpen(false); }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", roomValue === room.id.toString() ? "opacity-100" : "opacity-0")} />
                    {room.code} - {room.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {roomValue && (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
          onClick={() => onRoomChange("")}
        >
          <RefreshCcw className="h-3.5 w-3.5" />
        </Button>
      )}
      {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
    </div>
  );

  const hasActiveFilters =
    selectedDate !== "" ||
    selectedRoom !== "" ||
    (!isAdmissionRequestTab && selectedStatus !== "all") ||
    (isAdmissionRequestTab && selectedAdmissionStatus !== "all");

  return (
    <PageShell>
      <PageHeader
        title="Pendaftaran Pasien"
        description="Kelola registrasi pasien dan permintaan rawat inap"
        count={isAdmissionRequestTab ? admissionRequests.length : registrations.length}
        actions={
          <div className="flex items-center gap-1.5">
            <Button
              variant={serviceTypeOpen ? "secondary" : "outline"}
              size="sm"
              className="h-8 gap-2 text-xs"
              onClick={() => setServiceTypeOpen((prev) => !prev)}
            >
              <span className="max-w-[140px] truncate font-medium text-foreground">{currentTab.label}</span>
              {totalServiceTypeCount > 0 && (
                <Badge className="h-5 rounded-full bg-red-600 px-1.5 text-[10px] font-semibold text-white hover:bg-red-600">
                  {totalServiceTypeCount}
                </Badge>
              )}
              <ChevronsUpDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", serviceTypeOpen && "rotate-180")} />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/registrations/scheduled")}
              className="relative h-8 text-xs"
            >
              <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
              Jadwal Kontrol
              {scheduledTodayCount > 0 && (
                <Badge className="ml-1.5 h-5 min-w-5 rounded-full bg-blue-500 px-1.5 text-[10px] font-semibold text-white hover:bg-blue-500">
                  {scheduledTodayCount}
                </Badge>
              )}
            </Button>
            {hasPermission("registrations.create") && (
              <Button onClick={() => navigate("/registrations/create")} size="sm" className="h-8 text-xs">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Tambah Pendaftaran
              </Button>
            )}
            <Button
              variant={filterDialogOpen ? "secondary" : "outline"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setFilterDialogOpen(true)}
            >
              <SlidersHorizontal className="mr-1.5 h-3.5 w-3.5" />
              Filter
              {hasActiveFilters && <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-primary" />}
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                if (isAdmissionRequestTab) {
                  loadAdmissionRequests();
                } else {
                  loadData();
                }
                loadAllRegistrations();
                loadPendingAdmissionCount();
              }}
            >
              <RefreshCcw className="h-4 w-4" />
            </Button>
          </div>
        }
      />

      <Collapsible open={serviceTypeOpen} onOpenChange={setServiceTypeOpen}>
        <CollapsibleContent>
          <div className=" border-border bg-muted/15 px-6 py-2">
            <div className="flex min-w-0 overflow-x-auto border-y border-border bg-background">
              {REG_TABS.map((tab) => {
                const isActive = activeTab === tab.key;
                const tabCount = tabBadgeCounts[tab.key] ?? 0;

                return (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => handleTabChange(tab.key)}
                    className={cn(
                      "min-w-[148px] border-r border-border px-3 py-2 text-left transition-colors last:border-r-0",
                      isActive ? "bg-background text-foreground" : "text-muted-foreground hover:bg-background/70 hover:text-foreground",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Layanan</span>
                      {tabCount > 0 ? (
                        <Badge className="h-5 rounded-full bg-red-600 px-1.5 text-[10px] font-semibold text-white hover:bg-red-600">
                          {tabCount}
                        </Badge>
                      ) : (
                        <span className="text-[11px] tabular-nums text-muted-foreground">0</span>
                      )}
                    </div>
                    <div className={cn("mt-1 text-sm font-medium", isActive && "text-foreground")}>{tab.label}</div>
                  </button>
                );
              })}
            </div>

            {hasActiveFilters && (
              <div className="pt-2 text-[11px] text-muted-foreground">Filter aktif</div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
        <DialogContent className="max-w-2xl p-0">
          <DialogHeader>
            <div className="border-b border-border bg-muted/20 px-4 py-4">
              <DialogTitle>Filter Pendaftaran</DialogTitle>
              <DialogDescription>
                Fokus pada parameter operasional. Jenis layanan tetap dipilih dari strip utama di halaman.
              </DialogDescription>
            </div>
          </DialogHeader>

          <div className="divide-y divide-border">
            <div className="grid gap-3 px-4 py-2 md:grid-cols-[170px_minmax(0,1fr)] md:items-start">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Tanggal</p>
              </div>
              <div className="space-y-3">
                <Input
                  type="date"
                  value={draftSelectedDate}
                  onChange={(e) => setDraftSelectedDate(e.target.value)}
                  className="h-9 w-full text-sm"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setDraftSelectedDate(new Date().toISOString().split("T")[0])}
                  >
                    Hari Ini
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => setDraftSelectedDate("")}
                  >
                    Kosongkan Tanggal
                  </Button>
                </div>
              </div>
            </div>

            {isAdmissionRequestTab ? (
              <div className="grid gap-3 px-4 py-2 md:grid-cols-[170px_minmax(0,1fr)] md:items-start">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Status Permintaan</p>
                  <p className="mt-1 text-xs text-muted-foreground">Opsi utama ditampilkan langsung agar lebih cepat dibaca dan dipilih.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ADMISSION_STATUS_OPTIONS.map((option) => {
                    const isActive = draftSelectedAdmissionStatus === option.value;

                    return (
                      <Button
                        key={option.value}
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn(
                          "h-8 border px-3 text-xs",
                          isActive
                            ? "border-foreground bg-foreground text-background hover:bg-foreground hover:text-background"
                            : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                        )}
                        onClick={() => setDraftSelectedAdmissionStatus(option.value)}
                      >
                        {option.label}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
                <div className="grid gap-3 px-4 py-2 md:grid-cols-[170px_minmax(0,1fr)] md:items-start">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Ruangan</p>
                  </div>
                  <div className="space-y-2">
                    {renderRoomFilterSlot(draftSelectedRoom, setDraftSelectedRoom)}
                    <p className="text-[11px] text-muted-foreground">Biarkan kosong bila ingin melihat semua ruangan pada layanan ini.</p>
                  </div>
                </div>

                <div className="grid gap-3 px-4 py-2 md:grid-cols-[170px_minmax(0,1fr)] md:items-start">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Status</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {REGISTRATION_STATUS_OPTIONS.map((option) => {
                      const isActive = draftSelectedStatus === option.value;

                      return (
                        <Button
                          key={option.value}
                          type="button"
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "h-8 border px-3 text-xs",
                            isActive
                              ? "border-foreground bg-foreground text-background hover:bg-foreground hover:text-background"
                              : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                          onClick={() => setDraftSelectedStatus(option.value)}
                        >
                          {option.label}
                        </Button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-2">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => {
                  setDraftSelectedDate("");
                  setDraftSelectedRoom("");
                  setDraftSelectedStatus("all");
                  setDraftSelectedAdmissionStatus("all");
                }}
              >
                Reset
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setFilterDialogOpen(false)}>
                Batal
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  setSelectedDate(draftSelectedDate);
                  setSelectedRoom(draftSelectedRoom);
                  setSelectedStatus(draftSelectedStatus);
                  setSelectedAdmissionStatus(draftSelectedAdmissionStatus);
                  setFilterDialogOpen(false);
                }}
              >
                Terapkan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <PageContent>
        {isAdmissionRequestTab ? (
          <DataTable
            columns={admissionColumns}
            data={admissionRequests}
            searchPlaceholder="Cari no. request, nama pasien, atau RM..."
            pageSize={10}
          />
        ) : (
          <DataTable
            columns={columns}
            data={registrations}
            searchPlaceholder="Cari no. registrasi, nama pasien, atau no. RM..."
            pageSize={10}
          />
        )}
      </PageContent>

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

      <Dialog open={journeyDialogOpen} onOpenChange={setJourneyDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Perjalanan Pasien</DialogTitle>
            <DialogDescription>
              Alur perpindahan pasien berdasarkan kunjungan dan order pada pendaftaran ini.
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="max-h-[60vh] pr-3">
            {!journeyRegistration ? (
              <div className="text-sm text-muted-foreground">Data tidak tersedia.</div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-md border bg-muted/30 p-3">
                  <p className="text-xs text-muted-foreground">Registrasi</p>
                  <p className="font-mono text-sm">{journeyRegistration.registration_number}</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {journeyRegistration.patient?.nama_lengkap || journeyRegistration.patient?.name || "Pasien"}
                  </p>
                </div>

                <div className="space-y-0">
                  {journeyLoading && (
                    <div className="mb-3 flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Memuat detail kunjungan...
                    </div>
                  )}

                  {(journeyRegistration.visits || [])
                    .slice()
                    .sort((a, b) => {
                      const ta = new Date(a.created_at || "").getTime() || 0;
                      const tb = new Date(b.created_at || "").getTime() || 0;
                      return ta - tb;
                    })
                    .slice(0, journeyNodeLimit)
                    .map((visit, index, arr) => {
                      const visitId = visit.ID || visit.id;
                      const detailed = (visitId ? journeyVisitDetails.get(visitId) : undefined) || (visit as any);
                      const nodeKey = String(visitId || `${visit.visit_number}-${index}`);
                      const expanded = journeyExpandedNodes.has(nodeKey);
                      const isLast = index === arr.length - 1;
                      return (
                        <div key={nodeKey} className="flex gap-3">
                          <div className="flex w-6 flex-col items-center">
                            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-primary" />
                            {!isLast && <span className="mt-1 h-full w-px bg-border" />}
                          </div>
                          <div className="flex-1 pb-5">
                            <div className="rounded-md border p-3">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-sm font-semibold">{getVisitTypeLabel(detailed.visit_type)}</p>
                                <div className="flex items-center gap-2">
                                  {getVisitStatusBadge(detailed.status)}
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2 text-xs"
                                    onClick={() => toggleJourneyNode(nodeKey)}
                                  >
                                    {expanded ? "Sembunyikan" : "Detail"}
                                  </Button>
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {detailed.visit_number || "-"}
                                {(detailed.room as any)?.name ? ` • ${(detailed.room as any).name}` : ""}
                              </p>

                              {journeyDetailsLoaded && expanded && (
                                <>
                                  <div className="mt-2 grid grid-cols-1 gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
                                    <p>Dokter: <span className="text-foreground">{getDoctorName(detailed)}</span></p>
                                    <p>Antrian: <span className="text-foreground">{(detailed.room_queue as any)?.queue_number || "-"}</span></p>
                                    <p>Check-in: <span className="text-foreground">{detailed.check_in_time ? format(new Date(detailed.check_in_time), "dd MMM yyyy HH:mm", { locale: idLocale }) : "-"}</span></p>
                                    <p>Mulai: <span className="text-foreground">{detailed.start_time ? format(new Date(detailed.start_time), "dd MMM yyyy HH:mm", { locale: idLocale }) : "-"}</span></p>
                                    <p>Selesai: <span className="text-foreground">{detailed.end_time ? format(new Date(detailed.end_time), "dd MMM yyyy HH:mm", { locale: idLocale }) : "-"}</span></p>
                                    <p>Masuk/Keluar RI: <span className="text-foreground">{detailed.admission_time ? format(new Date(detailed.admission_time), "dd MMM yyyy HH:mm", { locale: idLocale }) : "-"} / {detailed.discharge_time ? format(new Date(detailed.discharge_time), "dd MMM yyyy HH:mm", { locale: idLocale }) : "-"}</span></p>
                                  </div>

                                  {(detailed.complaint || detailed.diagnosis || detailed.notes) && (
                                    <div className="mt-2 rounded-sm bg-muted/40 p-2 text-xs text-muted-foreground space-y-1">
                                      {detailed.complaint && <p>Keluhan: <span className="text-foreground">{detailed.complaint}</span></p>}
                                      {detailed.diagnosis && <p>Diagnosis: <span className="text-foreground">{detailed.diagnosis}</span></p>}
                                      {detailed.notes && <p>Catatan: <span className="text-foreground">{detailed.notes}</span></p>}
                                    </div>
                                  )}

                                  {typeof detailed.referral_from === "number" && detailed.referral_from > 0 && (
                                    <p className="mt-2 text-xs text-muted-foreground">
                                      Rujukan dari Visit ID: <span className="font-mono text-foreground">{detailed.referral_from}</span>
                                    </p>
                                  )}
                                </>
                              )}

                              {expanded && !journeyDetailsLoaded && (
                                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  Memuat detail kunjungan...
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}

                  {(journeyRegistration.visits || []).length > journeyNodeLimit && (
                    <div className="pt-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setJourneyNodeLimit((prev) => prev + 10)}
                      >
                        Tampilkan lebih banyak
                      </Button>
                    </div>
                  )}
                </div>

                {(journeyRegistration.visits || []).length === 0 && (
                  <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                    Belum ada data perjalanan kunjungan untuk registrasi ini.
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

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
    </PageShell>
  );
}
