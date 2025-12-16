import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { visitsApi } from "@/lib/api";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Loader2, Clock, CheckCircle2, XCircle, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface VisitHistoryProps {
  patientId: number;
  currentVisitId: number;
  currentVisitType: string;
  currentServiceType?: string; // PENTING: service_type dari room (rawat_jalan, rawat_inap, gawat_darurat)
  isConsultationOrder?: boolean;
  onVisitSelect: (visitId: number) => void;
}

interface VisitHistoryItem {
  id: number;
  visit_number: string;
  visit_type: string;
  check_in_time?: string;
  status: string;
  room?: {
    name: string;
    service_type: string;
  };
  doctor?: {
    name: string;
  };
  complaint?: string;
}

const visitTypeLabels: Record<string, string> = {
  consultation: "Konsultasi", // Hanya untuk ORDER konsultasi
  procedure: "Tindakan",
  lab: "Laboratorium",
  radiology: "Radiologi",
  pharmacy: "Farmasi",
  inpatient: "Rawat Inap",
  outpatient: "Rawat Jalan", // Kunjungan biasa ke Poli
  emergency: "Gawat Darurat", // Kunjungan biasa ke UGD
  other: "Lainnya",
};

const statusLabels: Record<string, string> = {
  waiting: "Menunggu",
  in_queue: "Dalam Antrian",
  in_progress: "Sedang Dilayani",
  completed: "Selesai",
  cancelled: "Dibatalkan",
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />;
    case "cancelled":
      return <XCircle className="h-3.5 w-3.5 text-red-600" />;
    case "in_progress":
      return <Clock className="h-3.5 w-3.5 text-blue-600" />;
    default:
      return <Clock className="h-3.5 w-3.5 text-gray-400" />;
  }
};

const getStatusBadgeVariant = (status: string): "default" | "secondary" | "outline" | "destructive" => {
  switch (status) {
    case "completed":
      return "default";
    case "cancelled":
      return "destructive";
    case "in_progress":
      return "secondary";
    default:
      return "outline";
  }
};

export function VisitHistory({ patientId, currentVisitId, currentVisitType, currentServiceType, isConsultationOrder = false, onVisitSelect }: VisitHistoryProps) {
  const [visits, setVisits] = useState<VisitHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVisitHistory();
  }, [patientId, currentVisitType, currentServiceType, isConsultationOrder]);

  const loadVisitHistory = async () => {
    setLoading(true);
    try {
      const params: any = {
        patient_id: patientId,
      };
      
      // LOGIC BARU YANG BENAR:
      // 1. Kunjungan KLINIK (poli/ugd/ranap) dengan service_type rawat_jalan/gawat_darurat/rawat_inap
      //    -> Tampilkan SEMUA kunjungan klinik (yang service_type-nya klinik)
      //    -> KECUALI konsultasi order (yang punya referral_from)
      // 2. Kunjungan KONSULTASI ORDER (punya referral_from)
      //    -> Tampilkan HANYA konsultasi order
      // 3. Kunjungan PENUNJANG (radiology/lab/pharmacy)
      //    -> Tampilkan HANYA tipe yang sama
      
      const clinicalServiceTypes = ["rawat_jalan", "rawat_inap", "gawat_darurat"];
      
      console.log("=== VISIT HISTORY FILTER ===");
      console.log("Current service_type:", currentServiceType);
      console.log("Current visit_type:", currentVisitType);
      console.log("Is consultation order:", isConsultationOrder);
      
      // Untuk konsultasi ORDER (rujukan) - HANYA tampilkan konsultasi order
      if (isConsultationOrder) {
        // Filter backend: ambil semua consultation
        params.visit_type = "consultation";
        console.log("Mode: Consultation ORDER - will filter by referral_from");
      }
      // Untuk kunjungan KLINIK - tampilkan semua kunjungan klinik
      else if (currentServiceType && clinicalServiceTypes.includes(currentServiceType)) {
        // JANGAN filter visit_type di backend, ambil semua
        // Nanti di frontend filter by service_type
        console.log("Mode: CLINICAL visits - will filter by service_type");
      }
      // Untuk kunjungan PENUNJANG (radiology, lab, pharmacy)
      else if (["radiology", "lab", "pharmacy"].includes(currentVisitType)) {
        params.visit_type = currentVisitType;
        console.log("Mode: SUPPORT visit -", currentVisitType);
      }

      console.log("API call params:", params);
      const response = await visitsApi.getAll(params);
      console.log("API response:", response.data.length, "total visits");
      
      let filteredVisits = response.data;
      
      // FILTER DI FRONTEND
      if (isConsultationOrder) {
        // HANYA konsultasi yang punya referral_from
        filteredVisits = response.data.filter((visit: any) => 
          visit.visit_type === "consultation" && visit.referral_from
        );
        console.log("Filtered: Consultation orders only:", filteredVisits.length);
      } 
      else if (currentServiceType && clinicalServiceTypes.includes(currentServiceType)) {
        // HANYA kunjungan dengan service_type klinik
        // KECUALI yang merupakan ORDER (punya referral_from)
        filteredVisits = response.data.filter((visit: any) => {
          const visitServiceType = visit.room?.service_type;
          
          // Clinical visit bisa dideteksi dari:
          // 1. room.service_type = rawat_jalan/rawat_inap/gawat_darurat
          // 2. ATAU visit_type = inpatient (rawat inap PASTI clinical)
          // 3. ATAU visit_type = consultation DAN TANPA referral_from (konsultasi biasa, bukan order)
          const isClinicalByServiceType = visitServiceType && clinicalServiceTypes.includes(visitServiceType);
          const isInpatientVisit = visit.visit_type === "inpatient";
          const isNormalConsultation = visit.visit_type === "consultation" && !visit.referral_from;
          
          const isClinicalService = isClinicalByServiceType || isInpatientVisit || isNormalConsultation;
          
          // Order = support visit (lab/rad/pharmacy/consultation) yang punya referral_from
          const supportTypes = ["lab", "radiology", "pharmacy"];
          const isOrder = visit.referral_from != null && (supportTypes.includes(visit.visit_type) || visit.visit_type === "consultation");
          
          console.log(`Visit ${visit.visit_number}:`, {
            visit_type: visit.visit_type,
            service_type: visitServiceType,
            referral_from: visit.referral_from,
            isClinicalByServiceType,
            isInpatientVisit,
            isNormalConsultation,
            isClinicalService,
            isOrder,
            included: isClinicalService && !isOrder
          });
          
          // Hanya ambil yang clinical service DAN bukan order
          return isClinicalService && !isOrder;
        });
        console.log("Filtered: Clinical visits (excluding orders):", filteredVisits.length);
        
        // Debug: tampilkan visit yang di-exclude
        const excluded = response.data.filter((visit: any) => {
          const visitServiceType = visit.room?.service_type;
          const isClinicalByServiceType = visitServiceType && clinicalServiceTypes.includes(visitServiceType);
          const isInpatientVisit = visit.visit_type === "inpatient";
          const isNormalConsultation = visit.visit_type === "consultation" && !visit.referral_from;
          const isClinicalService = isClinicalByServiceType || isInpatientVisit || isNormalConsultation;
          const supportTypes = ["lab", "radiology", "pharmacy"];
          const isOrder = visit.referral_from != null && (supportTypes.includes(visit.visit_type) || visit.visit_type === "consultation");
          return !isClinicalService || isOrder;
        });
        console.log("Excluded visits:", excluded.length, excluded.map((v: any) => ({
          id: v.id,
          visit_number: v.visit_number,
          visit_type: v.visit_type,
          service_type: v.room?.service_type,
          has_referral: !!v.referral_from
        })));
      }
      
      // Pastikan current visit ada
      const hasCurrentVisit = filteredVisits.some((v: any) => v.id === currentVisitId);
      if (!hasCurrentVisit) {
        const currentVisit = response.data.find((v: any) => v.id === currentVisitId);
        if (currentVisit) {
          filteredVisits = [currentVisit, ...filteredVisits];
          console.log("Added current visit to list");
        } else {
          console.warn("Current visit NOT FOUND in API response!");
        }
      }
      
      console.log("=== FINAL RESULT:", filteredVisits.length, "visits ===\n");
      setVisits(filteredVisits);
    } catch (error) {
      console.error("ERROR loading visit history:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (visits.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground h-full flex items-center justify-center">
        Tidak ada riwayat kunjungan
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-[calc(100vh-400px)] overflow-y-auto pr-1">
      {visits.map((visit) => {
        const isActive = visit.id === currentVisitId;

        return (
          <button
            key={visit.id}
            onClick={() => onVisitSelect(visit.id)}
            disabled={isActive}
            className={cn(
              "w-full text-left p-3 rounded-lg border transition-all",
              "hover:shadow-sm hover:border-primary/50",
              isActive
                ? "bg-primary/10 border-primary shadow-sm cursor-default"
                : "bg-background border-border hover:bg-muted/30"
            )}
          >
            {/* Visit Number & Date */}
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-foreground mb-0.5">
                  {visit.visit_number}
                </div>
                {visit.check_in_time && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    {format(new Date(visit.check_in_time), "dd MMM yyyy, HH:mm", {
                      locale: localeId,
                    })}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1">
                {getStatusIcon(visit.status)}
              </div>
            </div>

            {/* Room & Doctor */}
            <div className="space-y-1 mb-2">
              {visit.room && (
                <div className="text-[11px] text-muted-foreground truncate">
                  <span className="font-medium">Ruangan:</span> {visit.room.name}
                </div>
              )}
              {visit.doctor && (
                <div className="text-[11px] text-muted-foreground truncate">
                  <span className="font-medium">Dokter:</span> {visit.doctor.name}
                </div>
              )}
            </div>

            {/* Visit Type & Status */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                {visitTypeLabels[visit.visit_type] || visit.visit_type}
              </Badge>
              <Badge variant={getStatusBadgeVariant(visit.status)} className="text-[10px] px-1.5 py-0">
                {statusLabels[visit.status] || visit.status}
              </Badge>
            </div>

            {/* Complaint Preview */}
            {visit.complaint && (
              <div className="mt-2 text-[10px] text-muted-foreground italic truncate">
                {visit.complaint}
              </div>
            )}

            {/* Active Indicator */}
            {isActive && (
              <div className="mt-2 text-[10px] font-medium text-primary">
                • Kunjungan Aktif
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
