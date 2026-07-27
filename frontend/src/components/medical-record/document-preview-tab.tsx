import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, PenTool, CheckCircle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { visitsApi, type Visit } from "@/lib/api/visits";
import { medicalRecordsApi, type MedicalRecordSummary, type SickLetter } from "@/lib/api/medical-records";
import { buildMRPrintEntries, type MRPrintEntry } from "@/components/medical-record/mr-print-registry";
import { ResumeMedisPreview } from "./html-previews/resume-medis-preview";
import { SickLetterPreview } from "./html-previews/sick-letter-preview";

interface DocumentPreviewTabProps {
  visitId: number;
  readOnly?: boolean;
}

export function DocumentPreviewTab({ visitId, readOnly }: DocumentPreviewTabProps) {
  const [documents, setDocuments] = useState<MRPrintEntry[]>([]);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Data cache for previews
  const [visit, setVisit] = useState<Visit | null>(null);
  const [summary, setSummary] = useState<MedicalRecordSummary | null>(null);
  const [sickLetters, setSickLetters] = useState<SickLetter[]>([]);

  useEffect(() => {
    let isMounted = true;
    
    const loadData = async () => {
      setLoading(true);
      try {
        const visitRes = await visitsApi.getById(visitId);
        const v = visitRes.data;
        if (isMounted) setVisit(v);

        let mrSummary: MedicalRecordSummary | undefined;
        try {
          const mrRes = await medicalRecordsApi.get(visitId);
          mrSummary = mrRes.data;
          if (isMounted) setSummary(mrSummary);
        } catch {}

        let sls: SickLetter[] = [];
        try {
          const slRes = await medicalRecordsApi.getSickLetters(visitId);
          sls = slRes.data || [];
          if (isMounted) setSickLetters(sls);
        } catch {}

        if (!isMounted) return;

        // Build available documents based on context
        const entries = buildMRPrintEntries({
          visitId,
          visit: v,
          medicalRecord: mrSummary as any,
          medicineOrders: [],
          procedureOrders: [],
          sickLetters: sls,
          healthCertificates: [],
          birthCertificates: [],
          leaveCertificates: [],
          mcuCertificates: [],
          deathCertificates: [],
          unitTransfers: [],
          spriDoc: null,
          suratKontrolDoc: null,
          isUGDVisit: v.visit_type === "emergency",
          isInpatientVisit: v.visit_type === "inpatient",
          isPharmacyVisit: false,
          hasAnamnesis: !!mrSummary?.anamnesis,
          hasDiagnosis: !!mrSummary?.diagnosis,
          hasAnyMedicalData: !!mrSummary,
          hasTriage: !!mrSummary?.triage,
          hasReferral: false,
          completedLabOrders: [],
          completedRadiologyOrders: [],
          completedSurgeryOrders: [],
          completedConsultationOrders: [],
          completedMedicineOrders: [],
          pharmacyMedicineOrders: [],
          hasBersalin: false,
        });

        // For this proof of concept, we only show supported HTML preview forms
        const supportedDocs = entries.filter(e => 
          e.mrCode === "MR.35" || e.mrCode === "MR.39"
        );

        setDocuments(supportedDocs);
        if (supportedDocs.length > 0) {
          setSelectedDocId(supportedDocs[0].key);
        }

      } catch (err) {
        console.error("Failed to load documents", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [visitId]);

  const selectedDoc = documents.find(d => d.key === selectedDocId);

  return (
    <div className="flex h-[calc(100vh-140px)] gap-4">
      {/* Left Sidebar: Document List */}
      <Card className="w-80 flex flex-col shrink-0 overflow-hidden border-r bg-muted/20">
        <div className="p-4 border-b bg-muted/50">
          <h3 className="font-semibold text-sm">Daftar Dokumen</h3>
          <p className="text-xs text-muted-foreground mt-1">Pilih dokumen untuk melihat preview HTML dan status TTD.</p>
        </div>
        <ScrollArea className="flex-1">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Memuat dokumen...</div>
          ) : documents.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Tidak ada dokumen yang tersedia untuk preview HTML.</div>
          ) : (
            <div className="p-2 space-y-1">
              {documents.map(doc => (
                <button
                  key={doc.key}
                  onClick={() => setSelectedDocId(doc.key)}
                  className={cn(
                    "w-full text-left p-3 rounded-md transition-colors flex items-start gap-3",
                    selectedDocId === doc.key 
                      ? "bg-primary text-primary-foreground shadow-sm" 
                      : "hover:bg-muted bg-background border border-transparent"
                  )}
                >
                  <FileText className={cn("h-5 w-5 shrink-0 mt-0.5", selectedDocId === doc.key ? "text-primary-foreground/80" : "text-muted-foreground")} />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm truncate">{doc.title}</div>
                    <div className={cn("text-[11px] mt-1 truncate", selectedDocId === doc.key ? "text-primary-foreground/80" : "text-muted-foreground")}>
                      {doc.description}
                    </div>
                  </div>
                  {doc.status === "ready" ? (
                    <CheckCircle className={cn("h-4 w-4 shrink-0 mt-0.5", selectedDocId === doc.key ? "text-green-300" : "text-green-500")} />
                  ) : (
                    <Clock className={cn("h-4 w-4 shrink-0 mt-0.5", selectedDocId === doc.key ? "text-amber-300" : "text-amber-500")} />
                  )}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </Card>

      {/* Right Content: Document HTML Preview & Signature */}
      <Card className="flex-1 flex flex-col overflow-hidden bg-white shadow-sm border">
        {selectedDoc && visit ? (
          <>
            <div className="p-4 border-b flex items-center justify-between bg-muted/10">
              <div>
                <h2 className="text-lg font-semibold">{selectedDoc.title}</h2>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-xs">{selectedDoc.category}</Badge>
                  {selectedDoc.status === "ready" ? (
                    <Badge variant="default" className="text-xs bg-green-100 text-green-700 hover:bg-green-100 border-green-200 border">Siap Cetak</Badge>
                  ) : (
                    <Badge variant="default" className="text-xs bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200 border">Belum Lengkap</Badge>
                  )}
                </div>
              </div>
              {!readOnly && selectedDoc.status !== "ready" && (
                <Button size="sm" className="gap-2">
                  <PenTool className="h-4 w-4" />
                  Tanda Tangani
                </Button>
              )}
            </div>
            
            <ScrollArea className="flex-1 p-6 bg-gray-50">
              {/* Document specific HTML rendering goes here */}
              <div className="max-w-4xl mx-auto border rounded-lg p-8 shadow-sm bg-white min-h-[800px]">
                {selectedDoc.mrCode === "MR.35" ? (
                  <ResumeMedisPreview visit={visit} summary={summary || undefined} />
                ) : selectedDoc.mrCode === "MR.39" ? (
                  <SickLetterPreview 
                    visit={visit} 
                    data={sickLetters.find(l => l.id === selectedDoc.documentId) as SickLetter} 
                  />
                ) : (
                  <div className="text-center text-muted-foreground py-40">
                    <FileText className="h-16 w-16 mx-auto mb-4 opacity-20" />
                    <p>Preview HTML belum tersedia untuk dokumen ini.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center bg-gray-50">
            <FileText className="h-16 w-16 mb-4 opacity-20" />
            <h3 className="text-lg font-medium text-foreground">Tidak Ada Dokumen Terpilih</h3>
            <p className="mt-2 max-w-md">Silakan pilih dokumen dari daftar di sebelah kiri untuk melihat preview HTML dan status tanda tangannya.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
