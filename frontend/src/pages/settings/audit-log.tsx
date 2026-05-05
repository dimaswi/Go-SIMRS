import { useState, useEffect } from "react";
import { format } from "date-fns";
import { id as localeID } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { usersApi, signatureApi, DOCUMENT_TYPE_LABELS, type SignatureLog, type MedicalRecordEditLog } from "@/lib/api";
import { Loader2, ShieldCheck, FileEdit, SlidersHorizontal, RefreshCw, ArrowLeft } from "lucide-react";
import { PageShell, PageHeader, PageContent } from "@/components/layout/page-shell";
import { useNavigate } from "react-router-dom";
import { Label } from "@/components/ui/label";

export default function AuditLogPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("signature");

  // Common filters
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [users, setUsers] = useState<{ id: number; full_name: string; email: string }[]>([]);

  // Signature logs
  const [signatureLogs, setSignatureLogs] = useState<SignatureLog[]>([]);
  const [signatureLoading, setSignatureLoading] = useState(false);
  const [signaturePage, setSignaturePage] = useState(1);
  const [signatureTotal, setSignatureTotal] = useState(0);
  const [signatureDocType, setSignatureDocType] = useState<string>("");

  // Medical record edit logs
  const [editLogs, setEditLogs] = useState<MedicalRecordEditLog[]>([]);
  const [editLoading, setEditLoading] = useState(false);
  const [editPage, setEditPage] = useState(1);
  const [editTotal, setEditTotal] = useState(0);
  const [recordType, setRecordType] = useState<string>("");

  const pageSize = 20;

  useEffect(() => {
    document.title = "Audit Log - Rekam Medis & Tanda Tangan";
    loadUsers();
    loadSignatureLogs();
    loadEditLogs();
  }, []);

  const loadUsers = async () => {
    try {
      const response = await usersApi.getAll();
      setUsers(response.data.data || []);
    } catch (error) {
      console.error("Failed to load users:", error);
    }
  };

  const loadSignatureLogs = async (page = 1) => {
    setSignatureLoading(true);
    try {
      const response = await signatureApi.getSignatureLogs({
        user_id: selectedUserId ? parseInt(selectedUserId) : undefined,
        document_type: signatureDocType || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        page,
        page_size: pageSize,
      });
      setSignatureLogs(response.data.data || []);
      setSignatureTotal(response.data.total || 0);
      setSignaturePage(page);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat log tanda tangan",
      });
    } finally {
      setSignatureLoading(false);
    }
  };

  const loadEditLogs = async (page = 1) => {
    setEditLoading(true);
    try {
      const response = await signatureApi.getMedicalRecordEditLogs({
        user_id: selectedUserId ? parseInt(selectedUserId) : undefined,
        record_type: recordType || undefined,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
        page,
        page_size: pageSize,
      });
      setEditLogs(response.data.data || []);
      setEditTotal(response.data.total || 0);
      setEditPage(page);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat log perubahan rekam medis",
      });
    } finally {
      setEditLoading(false);
    }
  };

  const handleSearch = () => {
    loadSignatureLogs(1);
    loadEditLogs(1);
  };

  const handleReset = () => {
    setStartDate("");
    setEndDate("");
    setSelectedUserId("");
    setSignatureDocType("");
    setRecordType("");
    setTimeout(() => {
      loadSignatureLogs(1);
      loadEditLogs(1);
    }, 0);
  };

  const formatDateTime = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "dd MMM yyyy, HH:mm", { locale: localeID });
    } catch {
      return dateStr;
    }
  };

  const getActionBadge = (action: string) => {
    const variants: Record<string, "default" | "destructive" | "secondary"> = {
      sign: "default",
      revoke: "destructive",
      countersign: "secondary",
      edit: "secondary",
      create: "default",
      delete: "destructive",
    };
    return <Badge variant={variants[action] || "secondary"} className="text-[10px] uppercase font-normal">{action}</Badge>;
  };

  const recordTypeLabels: Record<string, string> = {
    triage: "Triage",
    anamnesis: "Anamnesis",
    physical_exam: "Pemeriksaan Fisik",
    diagnosis: "Diagnosis",
    assessment_plan: "Asesmen & Rencana",
    cppt: "CPPT",
    vital_sign: "Tanda Vital",
    nursing_care: "Asuhan Keperawatan",
    prescription: "Resep",
  };

  const hasActiveFilters = !!(startDate || endDate || selectedUserId || signatureDocType || recordType);

  return (
    <PageShell>
      <PageHeader
        title="Audit Log Sistem"
        description="Pantau riwayat aktivitas tanda tangan digital dan perubahan data rekam medis"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="h-8">
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              Kembali
            </Button>
            <Button variant="outline" size="sm" onClick={handleSearch} className="h-8">
              <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", (signatureLoading || editLoading) && "animate-spin")} />
              Refresh
            </Button>
            <Button
              variant={filterOpen ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterOpen(!filterOpen)}
              className="h-8"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
              Filter
              {hasActiveFilters && (
                <span className="ml-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary-foreground text-[10px] text-primary">
                  !
                </span>
              )}
            </Button>
          </div>
        }
      />

      <PageContent>
        <div className="space-y-4">
          <Collapsible open={filterOpen} onOpenChange={setFilterOpen}>
            <CollapsibleContent>
              <div className="rounded-lg border bg-card p-4 shadow-sm mb-4">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground ml-1">Dari Tanggal</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-8 w-40 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground ml-1">Sampai Tanggal</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-8 w-40 text-xs"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase text-muted-foreground ml-1">User</Label>
                    <Select value={selectedUserId || "all"} onValueChange={(v) => setSelectedUserId(v === "all" ? "" : v)}>
                      <SelectTrigger className="h-8 w-48 text-xs">
                        <SelectValue placeholder="Semua User" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Semua User</SelectItem>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id.toString()} className="text-xs">
                            {user.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {activeTab === "signature" && (
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground ml-1">Dokumen</Label>
                      <Select value={signatureDocType || "all"} onValueChange={(v) => setSignatureDocType(v === "all" ? "" : v)}>
                        <SelectTrigger className="h-8 w-48 text-xs">
                          <SelectValue placeholder="Jenis Dokumen" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua Dokumen</SelectItem>
                          {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value} className="text-xs">{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {activeTab === "edit" && (
                    <div className="space-y-1">
                      <Label className="text-[10px] uppercase text-muted-foreground ml-1">Record</Label>
                      <Select value={recordType || "all"} onValueChange={(v) => setRecordType(v === "all" ? "" : v)}>
                        <SelectTrigger className="h-8 w-48 text-xs">
                          <SelectValue placeholder="Jenis Record" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Semua Record</SelectItem>
                          {Object.entries(recordTypeLabels).map(([value, label]) => (
                            <SelectItem key={value} value={value} className="text-xs">{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="flex items-end gap-2 pt-5">
                    <Button size="sm" onClick={handleSearch} className="h-8 text-xs px-4">
                      Terapkan
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleReset} className="h-8 text-xs">
                      Reset
                    </Button>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Tabs value={activeTab} onValueChange={setActiveTab} variant="inline" className="w-full">
            <div className="bg-card rounded-xl border shadow-sm p-1 inline-flex mb-4">
              <TabsList className="bg-transparent h-8">
                <TabsTrigger value="signature" className="h-7 text-xs gap-2">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Log Tanda Tangan
                  <Badge variant="secondary" className="h-4 px-1.5 text-[9px] bg-muted">{signatureTotal}</Badge>
                </TabsTrigger>
                <TabsTrigger value="edit" className="h-7 text-xs gap-2">
                  <FileEdit className="h-3.5 w-3.5" />
                  Perubahan Rekam Medis
                  <Badge variant="secondary" className="h-4 px-1.5 text-[9px] bg-muted">{editTotal}</Badge>
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
              <TabsContent value="signature" className="m-0 border-0">
                {signatureLoading ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary/40 mb-2" />
                    <p className="text-xs text-muted-foreground">Memuat data log...</p>
                  </div>
                ) : signatureLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <ShieldCheck className="h-12 w-12 opacity-10 mb-3" />
                    <p className="text-sm font-medium">Tidak ada log tanda tangan ditemukan</p>
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-[10px] uppercase font-bold tracking-wider py-3">Waktu</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold tracking-wider py-3">User / Penandatangan</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold tracking-wider py-3">Dokumen</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold tracking-wider py-3">Pasien</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold tracking-wider py-3">Aksi</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold tracking-wider py-3">IP Address</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {signatureLogs.map((log) => (
                          <TableRow key={log.id} className="group transition-colors">
                            <TableCell className="whitespace-nowrap text-xs font-mono text-muted-foreground">
                              {formatDateTime(log.signed_at)}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col min-w-0">
                                <span className="text-sm font-semibold text-foreground leading-tight">{log.signer_name}</span>
                                {log.signer_nip && (
                                  <span className="text-[10px] text-muted-foreground mt-0.5">NIP: {log.signer_nip}</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-xs font-medium">
                              {DOCUMENT_TYPE_LABELS[log.document_type] || log.document_type}
                            </TableCell>
                            <TableCell>
                              {log.visit?.registration?.patient ? (
                                <div className="flex flex-col">
                                  <span className="text-xs font-medium">{log.visit.registration.patient.nama_lengkap}</span>
                                  <span className="text-[10px] text-muted-foreground">RM: {log.visit.registration.patient.no_rm}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs italic">N/A</span>
                              )}
                            </TableCell>
                            <TableCell>{getActionBadge(log.action)}</TableCell>
                            <TableCell className="text-[10px] font-mono text-muted-foreground">
                              {log.ip_address || "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {/* Pagination */}
                    {signatureTotal > pageSize && (
                      <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/10">
                        <p className="text-[11px] text-muted-foreground">
                          Menampilkan <span className="font-semibold">{(signaturePage - 1) * pageSize + 1} - {Math.min(signaturePage * pageSize, signatureTotal)}</span> dari <span className="font-semibold">{signatureTotal}</span> data
                        </p>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={signaturePage === 1}
                            onClick={() => loadSignatureLogs(signaturePage - 1)}
                            className="h-7 text-[10px]"
                          >
                            Sebelumnya
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={signaturePage >= Math.ceil(signatureTotal / pageSize)}
                            onClick={() => loadSignatureLogs(signaturePage + 1)}
                            className="h-7 text-[10px]"
                          >
                            Selanjutnya
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>

              <TabsContent value="edit" className="m-0 border-0">
                {editLoading ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-primary/40 mb-2" />
                    <p className="text-xs text-muted-foreground">Memuat data log...</p>
                  </div>
                ) : editLogs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                    <FileEdit className="h-12 w-12 opacity-10 mb-3" />
                    <p className="text-sm font-medium">Tidak ada log perubahan rekam medis ditemukan</p>
                  </div>
                ) : (
                  <>
                    <Table>
                      <TableHeader className="bg-muted/40">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-[10px] uppercase font-bold tracking-wider py-3">Waktu</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold tracking-wider py-3">User</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold tracking-wider py-3">Record</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold tracking-wider py-3">Pasien</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold tracking-wider py-3">Aksi</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold tracking-wider py-3">Alasan</TableHead>
                          <TableHead className="text-[10px] uppercase font-bold tracking-wider py-3">IP Address</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {editLogs.map((log) => (
                          <TableRow key={log.id} className="group">
                            <TableCell className="whitespace-nowrap text-xs font-mono text-muted-foreground">
                              {formatDateTime(log.edited_at)}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col">
                                <span className="text-sm font-semibold">{log.edited_by?.full_name || "-"}</span>
                                <span className="text-[10px] text-muted-foreground">{log.edited_by?.email}</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs font-medium">
                              {recordTypeLabels[log.record_type] || log.record_type}
                            </TableCell>
                            <TableCell>
                              {log.visit?.registration?.patient ? (
                                <div className="flex flex-col">
                                  <span className="text-xs font-medium">{log.visit.registration.patient.nama_lengkap}</span>
                                  <span className="text-[10px] text-muted-foreground font-mono">RM: {log.visit.registration.patient.no_rm}</span>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-xs italic">N/A</span>
                              )}
                            </TableCell>
                            <TableCell>{getActionBadge(log.action)}</TableCell>
                            <TableCell className="max-w-[180px] text-xs text-muted-foreground italic leading-tight" title={log.reason}>
                              {log.reason || "-"}
                            </TableCell>
                            <TableCell className="text-[10px] font-mono text-muted-foreground">
                              {log.ip_address || "-"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {/* Pagination */}
                    {editTotal > pageSize && (
                      <div className="flex items-center justify-between px-4 py-3 border-t bg-muted/10">
                        <p className="text-[11px] text-muted-foreground">
                          Menampilkan <span className="font-semibold">{(editPage - 1) * pageSize + 1} - {Math.min(editPage * pageSize, editTotal)}</span> dari <span className="font-semibold">{editTotal}</span> data
                        </p>
                        <div className="flex gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={editPage === 1}
                            onClick={() => loadEditLogs(editPage - 1)}
                            className="h-7 text-[10px]"
                          >
                            Sebelumnya
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={editPage >= Math.ceil(editTotal / pageSize)}
                            onClick={() => loadEditLogs(editPage + 1)}
                            className="h-7 text-[10px]"
                          >
                            Selanjutnya
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </PageContent>
    </PageShell>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
