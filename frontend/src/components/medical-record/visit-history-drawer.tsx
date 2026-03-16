import { useEffect, useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import { visitsApi, medicalRecordsApi, medicineOrdersApi, procedureOrdersApi } from "@/lib/api";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Stethoscope,
  BedDouble,
  AlertTriangle,
  FileText,
  Activity,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface VisitHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: number;
  currentVisitId: number;
  currentVisitType?: string;
  currentServiceType?: string;
  patientName?: string;
  onVisitSelect: (visitId: number) => void;
}

interface VisitHistoryItem {
  id: number;
  visit_number: string;
  visit_type: string;
  check_in_time?: string;
  start_time?: string;
  status: string;
  registration_id?: number;
  registration?: {
    registration_number: string;
    registration_date: string;
    registration_type: string;
  };
  room?: {
    name: string;
    service_type: string;
  };
  doctor?: {
    name: string;
    nama_lengkap?: string;
  };
  complaint?: string;
  referral_from?: number;
}

interface VisitDetail {
  diagnoses?: Array<{
    id: number;
    icd_code: string;
    icd_name: string;
    diagnosis_type: string;
  }>;
  medications?: Array<{
    id: number;
    medicine_name: string;
    quantity: number;
    unit: string;
    dosage: string;
    frequency: string;
    status: string;
  }>;
  procedures?: Array<{
    id: number;
    procedure_name: string;
    procedure_code: string;
    status: string;
    order_type: string;
  }>;
  anamnesis?: {
    chief_complaint?: string;
  };
  visitType?: string;
}

interface RegistrationGroup {
  registrationId: number;
  registrationNumber: string;
  registrationDate: string;
  registrationType: string;
  visits: VisitHistoryItem[];
}

const visitTypeLabels: Record<string, string> = {
  consultation: "Konsultasi",
  procedure: "Tindakan",
  lab: "Lab",
  radiology: "Radiologi",
  pharmacy: "Farmasi",
  inpatient: "Rawat Inap",
  outpatient: "Rawat Jalan",
  emergency: "UGD",
  surgery: "Operasi",
  other: "Lainnya",
};

const getVisitTypeIcon = (type: string) => {
  switch (type) {
    case "outpatient":
      return <Stethoscope className="h-4 w-4" />;
    case "inpatient":
      return <BedDouble className="h-4 w-4" />;
    case "emergency":
      return <AlertTriangle className="h-4 w-4" />;
    default:
      return <Stethoscope className="h-4 w-4" />;
  }
};

const getVisitTypeBadgeColor = (type: string): string => {
  const colors: Record<string, string> = {
    outpatient: "bg-blue-100 text-blue-800 border-blue-200",
    inpatient: "bg-purple-100 text-purple-800 border-purple-200",
    emergency: "bg-red-100 text-red-800 border-red-200",
    consultation: "bg-green-100 text-green-800 border-green-200",
    surgery: "bg-orange-100 text-orange-800 border-orange-200",
  };
  return colors[type] || "bg-gray-100 text-gray-800 border-gray-200";
};

const getStatusIcon = (status: string) => {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />;
    case "cancelled":
      return <XCircle className="h-3.5 w-3.5 text-red-600" />;
    case "in_progress":
      return <Clock className="h-3.5 w-3.5 text-blue-600 animate-pulse" />;
    default:
      return <Clock className="h-3.5 w-3.5 text-gray-400" />;
  }
};

export function VisitHistoryDrawer({
  open,
  onOpenChange,
  patientId,
  currentVisitId,
  currentVisitType,
  currentServiceType,
  patientName,
  onVisitSelect,
}: VisitHistoryDrawerProps) {
  const [visits, setVisits] = useState<VisitHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedVisitIds, setExpandedVisitIds] = useState<Set<number>>(new Set());
  const [visitDetails, setVisitDetails] = useState<Record<number, VisitDetail>>({});
  const [loadingDetails, setLoadingDetails] = useState<Set<number>>(new Set());

  // Group visits by registration
  const registrationGroups = useMemo((): RegistrationGroup[] => {
    const groupMap = new Map<number, RegistrationGroup>();

    for (const visit of visits) {
      const regId = visit.registration_id || 0;
      if (!groupMap.has(regId)) {
        groupMap.set(regId, {
          registrationId: regId,
          registrationNumber: visit.registration?.registration_number || `REG-${regId}`,
          registrationDate: visit.registration?.registration_date || visit.start_time || visit.check_in_time || "",
          registrationType: visit.registration?.registration_type || visit.visit_type,
          visits: [],
        });
      }
      groupMap.get(regId)!.visits.push(visit);
    }

    // Sort by registration date descending (newest first)
    return Array.from(groupMap.values()).sort(
      (a, b) => new Date(b.registrationDate).getTime() - new Date(a.registrationDate).getTime()
    );
  }, [visits]);

  useEffect(() => {
    if (open && patientId) {
      loadVisitHistory();
    }
  }, [open, patientId, currentVisitType, currentServiceType]);

  const loadVisitHistory = async () => {
    setLoading(true);
    try {
      const response = await visitsApi.getAll({
        patient_id: patientId,
      });

      // Determine which type of history to show based on current visit type
      const supportVisitTypes = ["pharmacy", "lab", "radiology", "surgery"];
      const clinicalServiceTypes = ["rawat_jalan", "rawat_inap", "gawat_darurat"];
      
      let filteredVisits = response.data;
      
      // If current visit is a support/order type (pharmacy, lab, radiology, surgery)
      // Show only visits of the same type
      if (currentVisitType && supportVisitTypes.includes(currentVisitType)) {
        filteredVisits = response.data.filter((visit: any) => 
          visit.visit_type === currentVisitType
        );
      }
      // For clinical visits (poli, ugd, ranap) - show only clinical visits
      else if (currentServiceType && clinicalServiceTypes.includes(currentServiceType)) {
        filteredVisits = response.data.filter((visit: any) => {
          const visitServiceType = visit.room?.service_type;
          const isClinicalByServiceType = visitServiceType && clinicalServiceTypes.includes(visitServiceType);
          const isInpatientVisit = visit.visit_type === "inpatient";
          const isNormalConsultation = visit.visit_type === "consultation" && !visit.referral_from;
          const isClinicalService = isClinicalByServiceType || isInpatientVisit || isNormalConsultation;
          const isOrder = visit.referral_from != null && (supportVisitTypes.includes(visit.visit_type) || visit.visit_type === "consultation");
          return isClinicalService && !isOrder;
        });
      }
      // Default: filter hanya kunjungan klinis
      else {
        filteredVisits = response.data.filter((visit: any) => {
          const visitServiceType = visit.room?.service_type;
          const isClinicalByServiceType = visitServiceType && clinicalServiceTypes.includes(visitServiceType);
          const isInpatientVisit = visit.visit_type === "inpatient";
          const isNormalConsultation = visit.visit_type === "consultation" && !visit.referral_from;
          const isClinicalService = isClinicalByServiceType || isInpatientVisit || isNormalConsultation;
          const isOrder = visit.referral_from != null && (["lab", "radiology", "pharmacy"].includes(visit.visit_type) || visit.visit_type === "consultation");
          return isClinicalService && !isOrder;
        });
      }

      setVisits(filteredVisits);
    } catch (error) {
      console.error("Error loading visit history:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadVisitDetail = async (visitId: number, visitType?: string) => {
    if (visitDetails[visitId] || loadingDetails.has(visitId)) return;

    setLoadingDetails((prev) => new Set(prev).add(visitId));
    try {
      // For pharmacy visits - load medicine orders
      if (visitType === "pharmacy") {
        const ordersRes = await medicineOrdersApi.getAll({ pharmacy_visit_id: visitId }).catch(() => ({ data: [] }));
        const orders = ordersRes.data || [];
        
        // Collect all active items from all orders
        const allMedications: any[] = [];
        for (const order of orders) {
          if (order.items) {
            for (const item of order.items) {
              // Filter out cancelled items
              if (item.status !== "cancelled") {
                allMedications.push({
                  id: item.id,
                  medicine_name: item.medicine?.name || "Obat",
                  quantity: item.quantity,
                  unit: item.unit,
                  dosage: item.dosage,
                  frequency: item.frequency,
                  status: item.status,
                });
              }
            }
          }
        }
        
        setVisitDetails((prev) => ({
          ...prev,
          [visitId]: {
            medications: allMedications,
            visitType: "pharmacy",
          },
        }));
      }
      // For lab/radiology/surgery visits - load procedure orders
      else if (visitType && ["lab", "radiology", "surgery"].includes(visitType)) {
        const ordersRes = await procedureOrdersApi.getAll({ target_visit_id: visitId }).catch(() => ({ data: [] }));
        const orders = ordersRes.data || [];
        
        // Collect all active items from all orders
        const allProcedures: any[] = [];
        for (const order of orders) {
          if (order.items) {
            for (const item of order.items) {
              // Filter out cancelled items
              if (item.status !== "cancelled") {
                allProcedures.push({
                  id: item.id,
                  procedure_name: item.procedure?.name || "Pemeriksaan",
                  procedure_code: item.procedure?.code || "",
                  status: item.status,
                  order_type: order.order_type,
                });
              }
            }
          }
        }
        
        setVisitDetails((prev) => ({
          ...prev,
          [visitId]: {
            procedures: allProcedures,
            visitType: visitType,
          },
        }));
      }
      // For clinical visits - load diagnosis and anamnesis
      else {
        const [diagnosisRes, anamnesisRes] = await Promise.all([
          medicalRecordsApi.getDiagnosis(visitId).catch(() => ({ data: null })),
          medicalRecordsApi.getAnamnesis(visitId).catch(() => ({ data: null })),
        ]);

        const diagnosisData = diagnosisRes.data as any;
        const anamnesisData = anamnesisRes.data as any;

        setVisitDetails((prev) => ({
          ...prev,
          [visitId]: {
            diagnoses: diagnosisData?.diagnoses || [],
            anamnesis: anamnesisData ? { chief_complaint: anamnesisData.chief_complaint } : undefined,
            visitType: "clinical",
          },
        }));
      }
    } catch (error) {
      console.error("Error loading visit detail:", error);
    } finally {
      setLoadingDetails((prev) => {
        const next = new Set(prev);
        next.delete(visitId);
        return next;
      });
    }
  };

  const toggleVisitExpand = (visitId: number, visitType?: string) => {
    setExpandedVisitIds((prev) => {
      const next = new Set(prev);
      if (next.has(visitId)) {
        next.delete(visitId);
      } else {
        next.add(visitId);
        loadVisitDetail(visitId, visitType);
      }
      return next;
    });
  };

  const handleVisitClick = (visitId: number) => {
    onVisitSelect(visitId);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-screen max-w-[100vw] sm:w-[450px] p-0">
        <SheetHeader className="px-4 py-3 border-b bg-muted/30">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <SheetTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Riwayat Kunjungan
              </SheetTitle>
              {patientName && (
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {patientName}
                </p>
              )}
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-80px)]">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : visits.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Tidak ada riwayat kunjungan
            </div>
          ) : (
            <div className="p-3 space-y-3">
              {registrationGroups.map((group) => (
                <div key={group.registrationId} className="space-y-2">
                  {/* Registration Header */}
                  <div className="flex flex-wrap items-center gap-2 px-2">
                    <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-muted-foreground">
                      {group.registrationDate
                        ? format(new Date(group.registrationDate), "dd MMMM yyyy", { locale: localeId })
                        : "-"}
                    </span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {group.visits.length} kunjungan
                    </Badge>
                  </div>

                  {/* Visits in this registration */}
                  <div className="space-y-2">
                    {group.visits.map((visit) => {
                      const isActive = visit.id === currentVisitId;
                      const isExpanded = expandedVisitIds.has(visit.id);
                      const detail = visitDetails[visit.id];
                      const isLoadingDetail = loadingDetails.has(visit.id);
                      const doctorName = visit.doctor?.nama_lengkap || visit.doctor?.name;

                      return (
                        <Collapsible
                          key={visit.id}
                          open={isExpanded}
                          onOpenChange={() => toggleVisitExpand(visit.id, visit.visit_type)}
                        >
                          <div
                            className={cn(
                              "rounded-lg border transition-all",
                              isActive
                                ? "bg-primary/5 border-primary shadow-sm"
                                : "bg-background border-border hover:border-primary/30"
                            )}
                          >
                            {/* Visit Header - Clickable to expand */}
                            <CollapsibleTrigger asChild>
                              <button className="w-full text-left p-3">
                                <div className="flex items-start gap-3">
                                  {/* Icon */}
                                  <div className={cn(
                                    "p-2 rounded-lg",
                                    isActive ? "bg-primary/10" : "bg-muted"
                                  )}>
                                    {getVisitTypeIcon(visit.visit_type)}
                                  </div>

                                  {/* Content */}
                                  <div className="flex-1 min-w-0">
                                    <div className="mb-1 flex flex-wrap items-center gap-2">
                                      <Badge
                                        variant="outline"
                                        className={cn("text-[10px] px-1.5 py-0", getVisitTypeBadgeColor(visit.visit_type))}
                                      >
                                        {visitTypeLabels[visit.visit_type] || visit.visit_type}
                                      </Badge>
                                      {getStatusIcon(visit.status)}
                                      {isActive && (
                                        <Badge className="text-[9px] px-1 py-0 bg-primary">
                                          Aktif
                                        </Badge>
                                      )}
                                    </div>

                                    <p className="text-sm font-medium text-foreground truncate">
                                      {visit.room?.name || "-"}
                                    </p>

                                    {doctorName && (
                                      <p className="text-xs text-muted-foreground truncate">
                                        {doctorName}
                                      </p>
                                    )}

                                    {visit.check_in_time && (
                                      <p className="text-[10px] text-muted-foreground mt-1">
                                        {format(new Date(visit.check_in_time), "HH:mm", { locale: localeId })}
                                      </p>
                                    )}
                                  </div>

                                  {/* Expand Icon */}
                                  <div className="flex-shrink-0 mt-1">
                                    {isExpanded ? (
                                      <ChevronDown className="h-4 w-4 text-muted-foreground" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    )}
                                  </div>
                                </div>
                              </button>
                            </CollapsibleTrigger>

                            {/* Expanded Content */}
                            <CollapsibleContent>
                              <div className="px-3 pb-3 pt-0 border-t bg-muted/20">
                                {isLoadingDetail ? (
                                  <div className="flex items-center justify-center py-4">
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                  </div>
                                ) : (
                                  <div className="space-y-3 pt-3">
                                    {/* For Clinical Visits: Keluhan & Diagnosis */}
                                    {detail?.visitType === "clinical" && (
                                      <>
                                        {/* Keluhan */}
                                        {detail?.anamnesis?.chief_complaint && (
                                          <div>
                                            <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">
                                              Keluhan Utama
                                            </p>
                                            <p className="text-xs text-foreground">
                                              {detail.anamnesis.chief_complaint}
                                            </p>
                                          </div>
                                        )}

                                        {/* Diagnosis */}
                                        {detail?.diagnoses && detail.diagnoses.length > 0 && (
                                          <div>
                                            <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1 flex items-center gap-1">
                                              <Activity className="h-3 w-3" />
                                              Diagnosis
                                            </p>
                                            <div className="space-y-1">
                                              {detail.diagnoses.slice(0, 3).map((dx) => (
                                                <div key={dx.id} className="flex items-start gap-2">
                                                  <Badge variant="outline" className="text-[9px] px-1 py-0 flex-shrink-0">
                                                    {dx.icd_code}
                                                  </Badge>
                                                  <span className="text-xs text-foreground truncate">
                                                    {dx.icd_name}
                                                  </span>
                                                </div>
                                              ))}
                                              {detail.diagnoses.length > 3 && (
                                                <p className="text-[10px] text-muted-foreground">
                                                  +{detail.diagnoses.length - 3} diagnosis lainnya
                                                </p>
                                              )}
                                            </div>
                                          </div>
                                        )}

                                        {/* No data message for clinical */}
                                        {!detail?.anamnesis?.chief_complaint && 
                                         (!detail?.diagnoses || detail.diagnoses.length === 0) && (
                                          <p className="text-xs text-muted-foreground italic py-2">
                                            Belum ada data rekam medis
                                          </p>
                                        )}
                                      </>
                                    )}

                                    {/* For Pharmacy Visits: Medications */}
                                    {detail?.visitType === "pharmacy" && (
                                      <div>
                                        <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">
                                          Daftar Obat
                                        </p>
                                        {detail?.medications && detail.medications.length > 0 ? (
                                          <div className="space-y-1">
                                            {detail.medications.slice(0, 5).map((med) => (
                                              <div key={med.id} className="flex items-start justify-between gap-2 text-xs">
                                                <span className="text-foreground truncate flex-1">
                                                  {med.medicine_name}
                                                </span>
                                                <span className="text-muted-foreground flex-shrink-0">
                                                  {med.quantity} {med.unit}
                                                </span>
                                              </div>
                                            ))}
                                            {detail.medications.length > 5 && (
                                              <p className="text-[10px] text-muted-foreground">
                                                +{detail.medications.length - 5} obat lainnya
                                              </p>
                                            )}
                                          </div>
                                        ) : (
                                          <p className="text-xs text-muted-foreground italic">
                                            Belum ada obat
                                          </p>
                                        )}
                                      </div>
                                    )}

                                    {/* For Lab/Radiology/Surgery Visits: Procedures */}
                                    {(detail?.visitType === "lab" || detail?.visitType === "radiology" || detail?.visitType === "surgery") && (
                                      <div>
                                        <p className="text-[10px] font-medium text-muted-foreground uppercase mb-1">
                                          {detail.visitType === "lab" ? "Pemeriksaan Lab" : 
                                           detail.visitType === "radiology" ? "Pemeriksaan Radiologi" : "Tindakan Operasi"}
                                        </p>
                                        {detail?.procedures && detail.procedures.length > 0 ? (
                                          <div className="space-y-1">
                                            {detail.procedures.slice(0, 5).map((proc) => (
                                              <div key={proc.id} className="flex items-start gap-2 text-xs">
                                                {proc.procedure_code && (
                                                  <Badge variant="outline" className="text-[9px] px-1 py-0 flex-shrink-0">
                                                    {proc.procedure_code}
                                                  </Badge>
                                                )}
                                                <span className="text-foreground truncate">
                                                  {proc.procedure_name}
                                                </span>
                                              </div>
                                            ))}
                                            {detail.procedures.length > 5 && (
                                              <p className="text-[10px] text-muted-foreground">
                                                +{detail.procedures.length - 5} pemeriksaan lainnya
                                              </p>
                                            )}
                                          </div>
                                        ) : (
                                          <p className="text-xs text-muted-foreground italic">
                                            Belum ada pemeriksaan
                                          </p>
                                        )}
                                      </div>
                                    )}

                                    {/* No visit type determined - show generic message */}
                                    {!detail?.visitType && (
                                      <p className="text-xs text-muted-foreground italic py-2">
                                        Belum ada data
                                      </p>
                                    )}

                                    {/* Action Button */}
                                    {!isActive && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="w-full mt-2 text-xs"
                                        onClick={() => handleVisitClick(visit.id)}
                                      >
                                        Buka Kunjungan Ini
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>
                            </CollapsibleContent>
                          </div>
                        </Collapsible>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
