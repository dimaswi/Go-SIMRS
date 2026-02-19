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
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { usersApi, signatureApi, DOCUMENT_TYPE_LABELS, type SignatureLog, type MedicalRecordEditLog } from "@/lib/api";
import { Loader2, ShieldCheck, FileEdit, SlidersHorizontal, RefreshCw } from "lucide-react";

export default function AuditLogPage() {
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
    return <Badge variant={variants[action] || "secondary"}>{action}</Badge>;
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

  const hasActiveFilters = startDate || endDate || selectedUserId || signatureDocType || recordType;

  return (
    <div className="flex flex-1 flex-col p-4">
      <Collapsible open={filterOpen} onOpenChange={setFilterOpen}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold">Audit Log</h1>
            <p className="text-sm text-muted-foreground">
              Pantau aktivitas tanda tangan digital dan perubahan rekam medis
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSearch}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" className="h-9">
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                Filter
                {hasActiveFilters && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5">
                    {[startDate, endDate, selectedUserId, signatureDocType, recordType].filter(Boolean).length}
                  </Badge>
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
        </div>

        {/* Collapsible Filter */}
        <CollapsibleContent>
          <div className="flex items-center gap-2 flex-wrap pt-4">
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="h-9 w-40"
              placeholder="Tanggal Mulai"
            />
            <span className="text-muted-foreground">-</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="h-9 w-40"
              placeholder="Tanggal Akhir"
            />
            <Select value={selectedUserId || "all"} onValueChange={(v) => setSelectedUserId(v === "all" ? "" : v)}>
              <SelectTrigger className="h-9 w-48">
                <SelectValue placeholder="Semua User" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua User</SelectItem>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {user.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {activeTab === "signature" && (
              <Select value={signatureDocType || "all"} onValueChange={(v) => setSignatureDocType(v === "all" ? "" : v)}>
                <SelectTrigger className="h-9 w-48">
                  <SelectValue placeholder="Jenis Dokumen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Dokumen</SelectItem>
                  {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {activeTab === "edit" && (
              <Select value={recordType || "all"} onValueChange={(v) => setRecordType(v === "all" ? "" : v)}>
                <SelectTrigger className="h-9 w-48">
                  <SelectValue placeholder="Jenis Record" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Record</SelectItem>
                  {Object.entries(recordTypeLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button size="sm" onClick={handleSearch} className="h-9">
              Terapkan
            </Button>
            <Button variant="ghost" size="sm" onClick={handleReset} className="h-9">
              Reset
            </Button>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} variant="inline" className="w-full">
        <TabsList>
          <TabsTrigger value="signature">
            <ShieldCheck className="h-4 w-4 mr-2" />
            Tanda Tangan ({signatureTotal})
          </TabsTrigger>
          <TabsTrigger value="edit">
            <FileEdit className="h-4 w-4 mr-2" />
            Perubahan RM ({editTotal})
          </TabsTrigger>
        </TabsList>

        {/* Signature Logs Tab */}
        <TabsContent value="signature" className="mt-4">
          {signatureLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : signatureLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ShieldCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Tidak ada data log tanda tangan</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Waktu</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Jenis Dokumen</TableHead>
                      <TableHead>Pasien</TableHead>
                      <TableHead>Aksi</TableHead>
                      <TableHead>IP Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {signatureLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatDateTime(log.signed_at)}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{log.signer_name}</p>
                            {log.signer_nip && (
                              <p className="text-xs text-muted-foreground">NIP: {log.signer_nip}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {DOCUMENT_TYPE_LABELS[log.document_type] || log.document_type}
                        </TableCell>
                        <TableCell>
                          {log.visit?.registration?.patient ? (
                            <div>
                              <p className="font-medium text-sm">{log.visit.registration.patient.nama_lengkap}</p>
                              <p className="text-xs text-muted-foreground">
                                RM: {log.visit.registration.patient.no_rm}
                              </p>
                              {log.visit.visit_number && (
                                <p className="text-xs text-muted-foreground">
                                  {log.visit.visit_number}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>{getActionBadge(log.action)}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {log.ip_address || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {signatureTotal > pageSize && (
                <div className="flex justify-between items-center mt-4">
                  <p className="text-sm text-muted-foreground">
                    Menampilkan {(signaturePage - 1) * pageSize + 1} - {Math.min(signaturePage * pageSize, signatureTotal)} dari {signatureTotal}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={signaturePage === 1}
                      onClick={() => loadSignatureLogs(signaturePage - 1)}
                    >
                      Sebelumnya
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={signaturePage >= Math.ceil(signatureTotal / pageSize)}
                      onClick={() => loadSignatureLogs(signaturePage + 1)}
                    >
                      Selanjutnya
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* Edit Logs Tab */}
        <TabsContent value="edit" className="mt-4">
          {editLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : editLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileEdit className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Tidak ada data log perubahan rekam medis</p>
            </div>
          ) : (
            <>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Waktu</TableHead>
                      <TableHead>User</TableHead>
                      <TableHead>Jenis Record</TableHead>
                      <TableHead>Pasien</TableHead>
                      <TableHead>No. Kunjungan</TableHead>
                      <TableHead>Aksi</TableHead>
                      <TableHead>Alasan</TableHead>
                      <TableHead>IP Address</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="whitespace-nowrap text-sm">
                          {formatDateTime(log.edited_at)}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{log.edited_by?.full_name || "-"}</p>
                            <p className="text-xs text-muted-foreground">{log.edited_by?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {recordTypeLabels[log.record_type] || log.record_type}
                        </TableCell>
                        <TableCell>
                          {log.visit?.registration?.patient ? (
                            <div>
                              <p className="font-medium text-sm">{log.visit.registration.patient.nama_lengkap}</p>
                              <p className="text-xs text-muted-foreground">
                                RM: {log.visit.registration.patient.no_rm}
                              </p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {log.visit?.visit_number || "-"}
                        </TableCell>
                        <TableCell>{getActionBadge(log.action)}</TableCell>
                        <TableCell className="max-w-[200px] truncate text-sm" title={log.reason}>
                          {log.reason || "-"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {log.ip_address || "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {editTotal > pageSize && (
                <div className="flex justify-between items-center mt-4">
                  <p className="text-sm text-muted-foreground">
                    Menampilkan {(editPage - 1) * pageSize + 1} - {Math.min(editPage * pageSize, editTotal)} dari {editTotal}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={editPage === 1}
                      onClick={() => loadEditLogs(editPage - 1)}
                    >
                      Sebelumnya
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={editPage >= Math.ceil(editTotal / pageSize)}
                      onClick={() => loadEditLogs(editPage + 1)}
                    >
                      Selanjutnya
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
