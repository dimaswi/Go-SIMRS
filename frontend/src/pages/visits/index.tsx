import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";
import { DataTable } from "@/components/ui/data-table";
import { Input } from "@/components/ui/input";
import { PharmacyReview } from "@/components/medical-record/pharmacy-review";
import { createVisitColumns } from "./columns";
import { useToast } from "@/hooks/use-toast";
import { usePermission } from "@/hooks/usePermission";
import { setPageTitle } from "@/lib/page-title";
import {
  Loader2,
  RefreshCcw,
  Check,
  ChevronsUpDown,
  SlidersHorizontal,
  Tv,
  Volume2,
  ExternalLink,
  ScreenShare,
} from "lucide-react";
import { medicineOrdersApi, roomQueuesApi, roomsApi, visitsApi } from "@/lib/api";
import type { Room } from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatPatientName } from "@/lib/print-utils";
import { useAuthStore } from "@/lib/store";
import { queueSharedAnnouncement } from "@/lib/shared-queue-announcer";

const INDONESIAN_SPEECH_MAP: Record<string, string> = {
  A: "a",
  B: "be",
  C: "ce",
  D: "de",
  E: "e",
  F: "ef",
  G: "ge",
  H: "ha",
  I: "i",
  J: "je",
  K: "ka",
  L: "el",
  M: "em",
  N: "en",
  O: "o",
  P: "pe",
  Q: "kiu",
  R: "er",
  S: "es",
  T: "te",
  U: "u",
  V: "ve",
  W: "we",
  X: "eks",
  Y: "ye",
  Z: "zet",
  "0": "nol",
  "1": "satu",
  "2": "dua",
  "3": "tiga",
  "4": "empat",
  "5": "lima",
  "6": "enam",
  "7": "tujuh",
  "8": "delapan",
  "9": "sembilan",
};

const spellQueueNumberForSpeech = (value: string) =>
  value
    .trim()
    .split("")
    .map((char) => INDONESIAN_SPEECH_MAP[char.toUpperCase()] || "")
    .filter(Boolean)
    .join(" ");

const getRoomQueueAnnouncementVersion = (queue: { id: number; called_at?: string; updated_at?: string; created_at?: string }) =>
  queue.called_at || queue.updated_at || queue.created_at || new Date().toISOString();

const PHARMACY_REVIEW_REQUEST_EVENT = "pharmacy-review-request";


// ── Tab definitions ─────────────────────────────────────────────────────────
interface VisitTab {
  key: string;               // visit_type value(s) sent to API (comma-separated)
  label: string;             // displayed label
  roomTypes: string[];       // room_type values used to filter room dropdown
}

const VISIT_TABS: VisitTab[] = [
  {
    key: "outpatient",
    label: "Rawat Jalan",
    roomTypes: ["poliklinik", "poli", "rawat_jalan", "klinik"],
  },
  {
    key: "inpatient",
    label: "Rawat Inap",
    roomTypes: ["rawat_inap", "icu", "iccu", "nicu", "picu", "vk", "isolasi"],
  },
  {
    key: "emergency",
    label: "UGD / IGD",
    roomTypes: ["ugd", "igd", "emergency", "gawat_darurat"],
  },
  {
    key: "pharmacy",
    label: "Farmasi",
    roomTypes: ["depo_farmasi", "farmasi", "apotek", "pharmacy"],
  },
  {
    key: "lab",
    label: "Laboratorium",
    roomTypes: ["laboratorium", "lab"],
  },
  {
    key: "radiology",
    label: "Radiologi",
    roomTypes: ["radiologi", "radiology"],
  },
  {
    key: "consultation",
    label: "Konsul",
    roomTypes: ["poliklinik", "poli", "rawat_jalan", "klinik", "rawat_inap", "icu", "iccu"],
  },
  {
    key: "surgery",
    label: "Operasi",
    roomTypes: ["ok", "kamar_operasi", "bedah", "surgery"],
  },
];

const VISIT_DEFAULT_TAB = VISIT_TABS[0].key;
const VISIT_DEFAULT_STATUS = "active";

const normalizeVisitTab = (value: string | null | undefined) => {
  if (!value) return VISIT_DEFAULT_TAB;
  return VISIT_TABS.some((tab) => tab.key === value) ? value : VISIT_DEFAULT_TAB;
};

const normalizeVisitStatus = (value: string | null | undefined) => {
  if (!value) return VISIT_DEFAULT_STATUS;
  return VISIT_STATUS_OPTIONS.some((option) => option.value === value) ? value : VISIT_DEFAULT_STATUS;
};

interface Visit {
  id: number;
  visit_number: string;
  registration_id: number;
  room_id: number;
  doctor_id?: number;
  visit_type: string;
  status: string;
  check_in_time?: string;
  check_out_time?: string;
  complaint?: string;
  registration?: {
    id: number;
    registration_number: string;
    patient?: {
      id: number;
      no_rm: string;
      nama_lengkap: string;
      jenis_kelamin: string;
      tanggal_lahir?: string;
    };
  };
  room?: {
    id: number;
    code: string;
    name: string;
    service_type?: string;
  };
  doctor?: {
    id: number;
    nama_lengkap: string;
  };
  room_queue?: {
    id: number;
    queue_number: string;
    status: string;
    priority: string;
  };
}

const VISIT_STATUS_OPTIONS = [
  { value: "active", label: "Aktif" },
  { value: "all", label: "Semua" },
  { value: "waiting", label: "Menunggu" },
  { value: "in_queue", label: "Dalam Antrian" },
  { value: "in_progress", label: "Dilayani" },
  { value: "completed", label: "Selesai" },
];

export default function VisitsIndex() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const { user } = useAuthStore();
  const isDoctor = (user?.employee?.tipe_karyawan?.toLowerCase() === "dokter" || user?.role?.name?.toLowerCase().includes("dokter")) ?? false;

  // ── All visits (no visit_type filter) used for badge counts ──
  const [allVisits, setAllVisits] = useState<Visit[]>([]);
  // ── Filtered visits displayed in table ──
  const [visits, setVisits] = useState<Visit[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  // Active tab (visit_type key)
  const [activeTab, setActiveTab] = useState<string>(() => normalizeVisitTab(searchParams.get("tab") || sessionStorage.getItem("visits_tab")));
  const [selectedRoom, setSelectedRoom] = useState<string>(() => searchParams.get("room") || sessionStorage.getItem("visits_room") || "");

  const [selectedStatus, setSelectedStatus] = useState<string>(() => normalizeVisitStatus(searchParams.get("status") || sessionStorage.getItem("visits_status")));
  const [selectedDate, setSelectedDate] = useState<string>(() => searchParams.get("date") || sessionStorage.getItem("visits_date") || ""); // Empty = show all data
  const [showMyPatientsOnly, setShowMyPatientsOnly] = useState<boolean>(() => {
    const stored = sessionStorage.getItem("visits_my_patients");
    return stored ? stored === "true" : isDoctor;
  });
  const [loading, setLoading] = useState(false);
  const [callingId, setCallingId] = useState<number | null>(null);
  const [recallingId, setRecallingId] = useState<number | null>(null);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [roomPopoverOpen, setRoomPopoverOpen] = useState(false);
  const [displayPanelOpen, setDisplayPanelOpen] = useState(false);
  const [filterDialogOpen, setFilterDialogOpen] = useState(false);
  const [draftSelectedRoom, setDraftSelectedRoom] = useState<string>("");
  const [draftSelectedStatus, setDraftSelectedStatus] = useState<string>("active");
  const [draftSelectedDate, setDraftSelectedDate] = useState<string>("");
  const [draftShowMyPatientsOnly, setDraftShowMyPatientsOnly] = useState<boolean>(false);
  const [cancelConfirmVisit, setCancelConfirmVisit] = useState<Visit | null>(null);
  const [pendingPharmacyReviewVisit, setPendingPharmacyReviewVisit] = useState<Visit | null>(null);

  // Check if user is admin
  const adminRoles = ["admin", "super admin", "system administrator", "sistem admin"];
  const isAdmin = adminRoles.includes(user?.role?.name?.toLowerCase() || "");

  // Determine available tabs based on user's rooms
  const availableTabs = useMemo(() => {
    if (isAdmin) return VISIT_TABS;

    return VISIT_TABS.filter((tab) => {
      if (tab.roomTypes.length === 0) return true;
      return rooms.some((room) =>
        tab.roomTypes.some((rt) =>
          room.room_type?.toLowerCase().includes(rt) ||
          rt.includes(room.room_type?.toLowerCase() ?? "")
        )
      );
    });
  }, [rooms, isAdmin]);

  // Current tab definition
  const currentTab = availableTabs.find((t) => t.key === activeTab) ?? availableTabs[0] ?? VISIT_TABS[0];

  // Auto-switch tab if the activeTab is no longer available after rooms load
  useEffect(() => {
    if (availableTabs.length > 0 && !availableTabs.some((t) => t.key === activeTab)) {
      setActiveTab(availableTabs[0].key);
    }
  }, [availableTabs, activeTab]);

  // Rooms filtered to match current tab's room types
  const tabRoomOptions = useMemo(() => {
    if (currentTab.roomTypes.length === 0) return rooms;
    return rooms.filter((r) =>
      currentTab.roomTypes.some(
        (rt) =>
          r.room_type?.toLowerCase().includes(rt) ||
          rt.includes(r.room_type?.toLowerCase() ?? "")
      )
    );
  }, [rooms, currentTab]);

  // Badge counts: active (waiting/in_queue/in_progress) per tab
  const tabBadgeCounts = useMemo(() => {
    const activeStatuses = ["waiting", "in_queue", "in_progress"];
    const counts: Record<string, number> = {};
    for (const tab of availableTabs) {
      counts[tab.key] = allVisits.filter(
        (v) =>
          v.visit_type === tab.key &&
          activeStatuses.includes(v.status)
      ).length;
    }
    return counts;
  }, [allVisits, availableTabs]);

  const buildRoomAnnouncementText = useCallback((queueNumber: string) => {
    const queueText = spellQueueNumberForSpeech(queueNumber);
    const roomName = rooms.find((room) => String(room.id) === selectedRoom)?.name || "ruangan";
    return `Nomor antrean ${queueText}. Silakan menuju ${roomName}.`;
  }, [rooms, selectedRoom]);

  useEffect(() => {
    try {
      [
        "visits_filter_tab",
        "visits_filter_status",
        "visits_tab_rooms",
        "dt_search_visits",
        "dt_page_visits",
        "dt_size_visits",
      ].forEach((key) => localStorage.removeItem(key));
    } catch { }
  }, []);

  useEffect(() => {
    const nextTab = normalizeVisitTab(searchParams.get("tab") || sessionStorage.getItem("visits_tab"));
    const nextRoom = searchParams.get("room") || sessionStorage.getItem("visits_room") || "";
    const nextStatus = normalizeVisitStatus(searchParams.get("status") || sessionStorage.getItem("visits_status"));
    const nextDate = searchParams.get("date") || sessionStorage.getItem("visits_date") || "";

    setActiveTab((prev) => (prev === nextTab ? prev : nextTab));
    setSelectedRoom((prev) => (prev === nextRoom ? prev : nextRoom));
    setSelectedStatus((prev) => (prev === nextStatus ? prev : nextStatus));
    setSelectedDate((prev) => (prev === nextDate ? prev : nextDate));
  }, [searchParams]);

  useEffect(() => {
    const nextParams = new URLSearchParams(searchParams);

    if (activeTab !== VISIT_DEFAULT_TAB) nextParams.set("tab", activeTab);
    else nextParams.delete("tab");

    if (selectedRoom) nextParams.set("room", selectedRoom);
    else nextParams.delete("room");

    if (selectedStatus !== VISIT_DEFAULT_STATUS) nextParams.set("status", selectedStatus);
    else nextParams.delete("status");

    if (selectedDate) nextParams.set("date", selectedDate);
    else nextParams.delete("date");

    if (nextParams.toString() !== searchParams.toString()) {
      setSearchParams(nextParams, { replace: true });
    }

    sessionStorage.setItem("visits_tab", activeTab);
    sessionStorage.setItem("visits_room", selectedRoom);
    sessionStorage.setItem("visits_status", selectedStatus);
    sessionStorage.setItem("visits_date", selectedDate);
    sessionStorage.setItem("visits_my_patients", showMyPatientsOnly.toString());
  }, [activeTab, searchParams, selectedDate, selectedRoom, selectedStatus, showMyPatientsOnly, setSearchParams]);

  useEffect(() => {
    if (!filterDialogOpen) {
      setRoomPopoverOpen(false);
      return;
    }

    setDraftSelectedDate(selectedDate);
    setDraftSelectedRoom(selectedRoom);
    setDraftSelectedStatus(selectedStatus);
    setDraftShowMyPatientsOnly(showMyPatientsOnly);
  }, [filterDialogOpen, selectedDate, selectedRoom, selectedStatus, showMyPatientsOnly]);

  useEffect(() => {
    if (isDoctor && !sessionStorage.getItem("visits_my_patients")) {
      setShowMyPatientsOnly(true);
    }
  }, [isDoctor]);

  useEffect(() => {
    setPageTitle("Kunjungan");
    loadRooms();
  }, [isAdmin]);

  useEffect(() => {
    loadAllVisits();
  }, [selectedDate]);



  const loadRooms = async () => {
    try {
      // Admin can see all rooms, regular users only see assigned rooms
      const response = isAdmin
        ? await roomsApi.getAll({ limit: 1000 }) // Request all rooms for admin
        : await roomsApi.getMyAssignedRooms();

      // Filter: hanya yang aktif dan bukan gudang farmasi
      const allRooms = response.data.data || [];

      const filteredRooms = allRooms.filter((room: Room) => {
        const isActive = room.is_active === true;
        const notGudang = room.room_type !== "gudang_farmasi";
        return isActive && notGudang;
      });

      setRooms(filteredRooms);
    } catch (error) {
      console.error("Failed to load rooms:", error);
    }
  };

  // Load ALL active visits (for badge counts), no visit_type filter
  const loadAllVisits = useCallback(async () => {
    try {
      const params: any = { status: "waiting,in_queue,in_progress" };
      if (selectedDate) {
        params.start_date = selectedDate;
        params.end_date = selectedDate;
      }
      if (showMyPatientsOnly && user?.employee_id) {
        params.doctor_id = user.employee_id;
      }
      const response = await visitsApi.getAll(params);
      setAllVisits(response.data || []);
    } catch { }
  }, [selectedDate, showMyPatientsOnly, user?.employee_id]);

  const loadVisits = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = {};

      // Filter by active tab visit_type
      params.visit_type = activeTab;

      // Only add date filter if date is selected
      if (selectedDate) {
        params.start_date = selectedDate;
        params.end_date = selectedDate;
      }

      // Only add room_id filter if a room is selected
      if (selectedRoom) {
        params.room_id = selectedRoom;
      }

      // Handle status filter
      if (selectedStatus === "active") {
        // Active means: waiting, in_queue, in_progress (not completed)
        params.status = "waiting,in_queue,in_progress";
      } else if (selectedStatus !== "all") {
        params.status = selectedStatus;
      }

      if (showMyPatientsOnly && user?.employee_id) {
        params.doctor_id = user.employee_id;
      }

      const response = await visitsApi.getAll(params);
      let data = response.data || [];

      // Exclude "scheduled" (Mobile JKN pending checkin) by default when "all" status is selected
      if (selectedStatus === "all") {
        data = data.filter((v: Visit) => v.status !== "scheduled");
      }

      // Sort by check_in_time descending (newest first)
      const sortedData = data.sort((a: Visit, b: Visit) => {
        const timeA = a.check_in_time ? new Date(a.check_in_time).getTime() : 0;
        const timeB = b.check_in_time ? new Date(b.check_in_time).getTime() : 0;
        return timeB - timeA; // Descending order (newest first)
      });

      setVisits(sortedData);
    } catch (error: any) {
      console.error("Failed to load visits:", error);
      toast({
        title: "Gagal memuat kunjungan",
        description: error.response?.data?.error || "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedDate, selectedRoom, selectedStatus, showMyPatientsOnly, user?.employee_id, toast]);

  useEffect(() => {
    // Load visits on mount and when filters or user data changes
    loadVisits();
    // Auto refresh every 10 seconds
    const interval = setInterval(() => {
      loadVisits();
      loadAllVisits();
    }, 10000);
    return () => clearInterval(interval);
  }, [loadVisits, loadAllVisits]);

  const handleCallQueue = async (visit: Visit) => {
    if (!visit.room_queue) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Kunjungan ini tidak memiliki nomor antrian",
      });
      return;
    }

    setCallingId(visit.id);
    try {
      const response = await roomQueuesApi.callQueue(visit.room_queue.id);

      if (response.data) {
        queueSharedAnnouncement({
          id: `${response.data.id}-${getRoomQueueAnnouncementVersion(response.data)}`,
          kind: "room",
          speechText: buildRoomAnnouncementText(response.data.queue_number),
        });
      }

      toast({
        title: "Antrian Dipanggil",
        description: `Nomor antrian ${visit.room_queue.queue_number} - ${formatPatientName(visit.registration?.patient?.nama_lengkap, visit.registration?.patient?.jenis_kelamin, undefined, visit.registration?.patient?.tanggal_lahir)}`,
      });

      loadVisits();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal memanggil antrian",
      });
    } finally {
      setCallingId(null);
    }
  };

  const handleRecallQueue = async (visit: Visit) => {
    if (!visit.room_queue) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Kunjungan ini tidak memiliki nomor antrian",
      });
      return;
    }

    setRecallingId(visit.id);
    try {
      const response = await roomQueuesApi.callQueue(visit.room_queue.id);

      if (response.data) {
        queueSharedAnnouncement({
          id: `${response.data.id}-${getRoomQueueAnnouncementVersion(response.data)}`,
          kind: "room",
          speechText: buildRoomAnnouncementText(response.data.queue_number),
        });
      }

      toast({
        title: "Antrian Dipanggil Ulang",
        description: `Nomor antrian ${visit.room_queue.queue_number} - ${formatPatientName(visit.registration?.patient?.nama_lengkap, visit.registration?.patient?.jenis_kelamin, undefined, visit.registration?.patient?.tanggal_lahir)}`,
      });

      loadVisits();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description:
          error.response?.data?.error || "Gagal memanggil ulang antrian",
      });
    } finally {
      setRecallingId(null);
    }
  };

  const handleAcceptPatient = async (visit: Visit) => {
    setAcceptingId(visit.id);
    try {
      await visitsApi.acceptVisit(visit.id);

      toast({
        title: "Pasien Diterima",
        description: `${formatPatientName(visit.registration?.patient?.nama_lengkap, visit.registration?.patient?.jenis_kelamin, undefined, visit.registration?.patient?.tanggal_lahir)} telah diterima untuk pemeriksaan`,
      });

      loadVisits();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal menerima pasien",
      });
    } finally {
      setAcceptingId(null);
    }
  };

  const handleViewDetail = async (visit: Visit) => {
    const isPharmacyVisit = visit.visit_type === "pharmacy" || visit.room?.service_type === "farmasi";
    if (!isPharmacyVisit) {
      navigate(`/visits/${visit.id}`);
      return;
    }

    try {
      const ordersRes = await medicineOrdersApi.getAll({ pharmacy_visit_id: visit.id });
      const activeOrders = (ordersRes.data || []).filter((order) => order.status !== "cancelled");

      let hasCompletedFinalReview = false;
      let needsInitialReview = false;

      for (const order of activeOrders) {
        let reviewData: any = null;
        try {
          const reviewRes = await medicineOrdersApi.getReview(order.id);
          reviewData = reviewRes.data;
        } catch {
          reviewData = null;
        }

        if (reviewData?.final_review_completed) {
          hasCompletedFinalReview = true;
        }

        if (order.status === "pending" && !reviewData?.initial_review_completed) {
          needsInitialReview = true;
        }
      }

      if (!hasCompletedFinalReview && needsInitialReview) {
        setPendingPharmacyReviewVisit(visit);
        return;
      }
    } catch {
      // Fall back to opening the workstation if the pre-check fails.
    }

    navigate(`/visits/${visit.id}`);
  };

  useEffect(() => {
    if (!pendingPharmacyReviewVisit) return;

    const frame = window.requestAnimationFrame(() => {
      window.dispatchEvent(
        new CustomEvent(PHARMACY_REVIEW_REQUEST_EVENT, {
          detail: { mode: "initial", lock: false },
        }),
      );
    });

    return () => window.cancelAnimationFrame(frame);
  }, [pendingPharmacyReviewVisit]);

  const handleCancelVisit = async (visit: Visit) => {
    setCancelConfirmVisit(visit);
  };

  const handleConfirmCancelVisit = async () => {
    const visit = cancelConfirmVisit;
    if (!visit) return;
    setCancelConfirmVisit(null);

    setCancellingId(visit.id);
    try {
      await visitsApi.cancelVisit(visit.id);

      toast({
        title: "Kunjungan Dibatalkan",
        description: `Kunjungan ${formatPatientName(visit.registration?.patient?.nama_lengkap, visit.registration?.patient?.jenis_kelamin, undefined, visit.registration?.patient?.tanggal_lahir)} berhasil dibatalkan`,
      });

      loadVisits();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.response?.data?.error || "Gagal membatalkan kunjungan",
      });
    } finally {
      setCancellingId(null);
    }
  };

  const columns = createVisitColumns({
    onCallQueue: handleCallQueue,
    onRecallQueue: handleRecallQueue,
    onAcceptPatient: handleAcceptPatient,
    onCancelVisit: handleCancelVisit,
    onViewDetail: handleViewDetail,
    callingId,
    recallingId,
    acceptingId,
    cancellingId,
    hasCallPermission: hasPermission("room_queues.call"),
    hasAcceptPermission: hasPermission("visits.update"),
    hasViewPermission: hasPermission("medical_records.view"),
    hasCancelPermission: hasPermission("visits.delete"),
  });

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
              "h-8 w-[220px] justify-between font-normal text-xs",
              !roomValue && "text-muted-foreground"
            )}
          >
            <span className="truncate">
              {roomValue
                ? (() => {
                  const r = rooms.find((r) => r.id.toString() === roomValue);
                  return r ? `${r.code} - ${r.name}` : `Semua ${currentTab.label}`;
                })()
                : `Semua ${currentTab.label}`}
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
                  Semua {currentTab.label}
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
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
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
    selectedStatus !== "active";

  const handleVisitTabChange = (tabKey: string) => {
    setActiveTab(tabKey);
    setSelectedRoom("");
    setRoomPopoverOpen(false);
  };

  return (
    <PageShell>
      <PageHeader
        title="Kunjungan Pasien"
        description="Kelola antrean dan pelayanan kunjungan per unit"
        count={visits.length}
        actions={
          <div className="flex items-center gap-1.5">
            {selectedRoom && (
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => window.open(`/room-queue/display/${selectedRoom}`, "_blank")}
              >
                <Tv className="mr-1.5 h-3.5 w-3.5" />
                Display Ruangan
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
              variant={displayPanelOpen ? "secondary" : "outline"}
              size="icon"
              className="h-8 w-8"
              onClick={() => setDisplayPanelOpen(!displayPanelOpen)}
            >
              <ScreenShare className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => {
                loadVisits();
                loadAllVisits();
              }}
            >
              <RefreshCcw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        }
      />
      <div className="border-b border-border bg-muted/15 px-4 py-2 flex items-center justify-between">
        <div className="flex min-w-0 overflow-x-auto gap-1.5">
          {availableTabs.map((tab) => {
            const isActive = activeTab === tab.key;
            const tabCount = tabBadgeCounts[tab.key] ?? 0;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => handleVisitTabChange(tab.key)}
                className={cn(
                  "flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium transition-colors border",
                  isActive
                    ? "bg-foreground text-background border-foreground"
                    : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground",
                )}
              >
                {tab.label}
                <Badge
                  className={cn(
                    "h-4 min-w-4 flex items-center justify-center rounded-full px-1.5 text-[10px] font-semibold border-none transition-colors",
                    isActive
                      ? "bg-background text-foreground hover:bg-background"
                      : tabCount > 0
                        ? "bg-red-600 text-white hover:bg-red-600"
                        : "bg-muted-foreground/20 text-muted-foreground hover:bg-muted-foreground/20"
                  )}
                >
                  {tabCount}
                </Badge>
              </button>
            );
          })}
        </div>
        {hasActiveFilters && (
          <div className="text-[10px] bg-green-100 text-green-600 font-medium whitespace-nowrap ml-4 flex items-center gap-1.5 border border-border px-2 py-1 rounded-md bg-background">
            <span className="h-1.5 w-1.5 bg-green-600 rounded-full" />
            Filter aktif
          </div>
        )}
      </div>

      <Dialog open={filterDialogOpen} onOpenChange={setFilterDialogOpen}>
        <DialogContent className="max-w-2xl p-0">
          <DialogHeader>
            <div className="border-b border-border bg-muted/20 px-4 py-4">
              <DialogTitle>Filter Kunjungan</DialogTitle>
              <DialogDescription className="mt-1">
                Jenis kunjungan tetap dipilih dari strip utama. Modal ini khusus untuk penyaringan operasional.
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

            <div className="grid gap-3 px-4 py-2 md:grid-cols-[170px_minmax(0,1fr)] md:items-start">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Ruangan</p>
              </div>
              <div className="space-y-2">
                {renderRoomFilterSlot(draftSelectedRoom, setDraftSelectedRoom)}
              </div>
            </div>

            <div className="grid gap-3 px-4 py-2 md:grid-cols-[170px_minmax(0,1fr)] md:items-start">
              <div>
                <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Status</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {VISIT_STATUS_OPTIONS.map((option) => {
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
            {isDoctor && (
              <div className="grid gap-3 px-4 py-2 md:grid-cols-[170px_minmax(0,1fr)] md:items-start border-t border-border">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Tampilan Pasien</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 border px-3 text-xs",
                      draftShowMyPatientsOnly
                        ? "border-foreground bg-foreground text-background hover:bg-foreground hover:text-background"
                        : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    onClick={() => setDraftShowMyPatientsOnly(true)}
                  >
                    Hanya Pasien Saya
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 border px-3 text-xs",
                      !draftShowMyPatientsOnly
                        ? "border-foreground bg-foreground text-background hover:bg-foreground hover:text-background"
                        : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                    onClick={() => setDraftShowMyPatientsOnly(false)}
                  >
                    Semua Pasien di Ruangan
                  </Button>
                </div>
              </div>
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
                  setDraftSelectedStatus("active");
                  setDraftShowMyPatientsOnly(isDoctor);
                }}
              >
                Reset
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setFilterDialogOpen(false);
                  setSelectedDate(draftSelectedDate);
                  setSelectedRoom(draftSelectedRoom);
                  setSelectedStatus(draftSelectedStatus);
                  setShowMyPatientsOnly(draftShowMyPatientsOnly);
                }}
                className="bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground h-8 text-xs"
              >
                Terapkan
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {displayPanelOpen && (
        <div className="border-b border-border px-4 py-2">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold">Display Per Ruangan</h3>
              <p className="text-xs text-muted-foreground">Buka display antrean per ruangan dengan suara pengumuman</p>
            </div>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => window.open("/queue-display", "_blank")}>
              <Tv className="mr-1 h-3 w-3" />
              Pengaturan Display
              <ExternalLink className="ml-1 h-3 w-3 text-muted-foreground" />
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {rooms.length === 0 ? (
              <span className="text-xs text-muted-foreground">Tidak ada ruangan</span>
            ) : (
              rooms.map((room) => (
                <Button
                  key={room.id}
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => window.open(`/room-queue/display/${room.id}`, "_blank")}
                >
                  <Volume2 className="mr-1.5 h-3 w-3" />
                  {room.queue_code || room.code} - {room.name}
                  <ExternalLink className="ml-1.5 h-2.5 w-2.5 text-muted-foreground" />
                </Button>
              ))
            )}
          </div>
        </div>
      )}
      <PageContent className="py-3">
        <div className="border border-border/70 bg-background">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Daftar Kunjungan
          </div>
          <div className="p-3 sm:p-4 relative">
            {loading && (
              <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/50 backdrop-blur-[1px] rounded-b-md">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}
            <DataTable
              columns={columns}
              data={visits}
              searchPlaceholder="Cari nomor RM, nama pasien, nomor kunjungan..."
              pageSize={10}
              tableId={`visits-${activeTab}`}
            />
          </div>
        </div>
      </PageContent>

      <AlertDialog
        open={!!cancelConfirmVisit}
        onOpenChange={(open) => !open && setCancelConfirmVisit(null)}
      >
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">Batalkan Kunjungan?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-xs">
                <p>Apakah Anda yakin ingin membatalkan kunjungan ini?</p>
                {cancelConfirmVisit && (
                  <dl className="border rounded-md px-3 py-2 space-y-1">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Pasien</dt>
                      <dd className="font-medium">{formatPatientName(cancelConfirmVisit.registration?.patient?.nama_lengkap, cancelConfirmVisit.registration?.patient?.jenis_kelamin, undefined, cancelConfirmVisit.registration?.patient?.tanggal_lahir)}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">No. RM</dt>
                      <dd className="font-mono">{cancelConfirmVisit.registration?.patient?.no_rm}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Ruangan</dt>
                      <dd>{cancelConfirmVisit.room?.name}</dd>
                    </div>
                  </dl>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">Batal</AlertDialogCancel>
            <AlertDialogAction
              className="h-8 text-xs bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleConfirmCancelVisit}
            >
              Ya, Batalkan
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {pendingPharmacyReviewVisit && (
        <div className="hidden">
          <PharmacyReview
            visitId={pendingPharmacyReviewVisit.id}
            onInitialReviewSaved={() => {
              const nextVisitId = pendingPharmacyReviewVisit.id;
              setPendingPharmacyReviewVisit(null);
              navigate(`/visits/${nextVisitId}`);
            }}
          />
        </div>
      )}
    </PageShell>
  );
}
