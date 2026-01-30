import { useState, useEffect } from "react";
import { format } from "date-fns";
import { id } from "date-fns/locale";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Search,
  Send,
  CheckCircle,
  AlertCircle,
  ClipboardList,
  Calendar,
  RefreshCw,
  FileText,
  Stethoscope,
} from "lucide-react";
import { satuSehatApi } from "@/lib/api/integrations";

interface CarePlanItem {
  id: number;
  source: "cppt" | "disposition";
  visit_id: number;
  visit_number: string;
  patient_name: string;
  patient_mrn: string;
  room_name: string;
  title: string;
  description: string;
  created_at: string;
  has_encounter: boolean;
}

export function CarePlanTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<string | null>(null);
  const [items, setItems] = useState<CarePlanItem[]>([]);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "cppt" | "disposition">("all");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  useEffect(() => {
    loadData();
  }, [startDate, endDate, sourceFilter]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await satuSehatApi.getCarePlanMonitoring(
        startDate, 
        endDate, 
        sourceFilter === "all" ? undefined : sourceFilter
      );
      setItems(response.data.data || []);
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data rencana rawat",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (item: CarePlanItem) => {
    if (!item.has_encounter) {
      toast({
        variant: "destructive",
        title: "Tidak Bisa Kirim",
        description: "Encounter harus dikirim terlebih dahulu",
      });
      return;
    }

    const sendingKey = `${item.source}-${item.id}`;
    setSending(sendingKey);
    try {
      let response;
      if (item.source === "cppt") {
        response = await satuSehatApi.sendCarePlanFromCPPT(item.id);
      } else {
        response = await satuSehatApi.sendCarePlanFromDisposition(item.id);
      }
      toast({
        variant: "success",
        title: "Berhasil!",
        description: response.data.message || "CarePlan terkirim ke SatuSehat",
      });
      loadData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Gagal",
        description: err.response?.data?.error || "Gagal mengirim CarePlan",
      });
    } finally {
      setSending(null);
    }
  };

  const filteredItems = items.filter(
    (item) =>
      item.patient_name.toLowerCase().includes(search.toLowerCase()) ||
      item.patient_mrn.toLowerCase().includes(search.toLowerCase()) ||
      item.visit_number.toLowerCase().includes(search.toLowerCase()) ||
      item.title.toLowerCase().includes(search.toLowerCase()) ||
      item.description.toLowerCase().includes(search.toLowerCase())
  );

  const getSourceIcon = (source: string) => {
    if (source === "cppt") return <Stethoscope className="h-3 w-3" />;
    return <FileText className="h-3 w-3" />;
  };

  const getSourceLabel = (source: string) => {
    if (source === "cppt") return "CPPT";
    return "RTL";
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              CarePlan - Rencana Rawat
            </CardTitle>
            <CardDescription>
              Kirim rencana perawatan (dari CPPT) atau rencana tindak lanjut (dari Disposisi) ke SatuSehat
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-[150px]"
            />
            <span className="text-muted-foreground">s/d</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-[150px]"
            />
          </div>
          <Select value={sourceFilter} onValueChange={(v) => setSourceFilter(v as typeof sourceFilter)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Sumber" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Semua Sumber</SelectItem>
              <SelectItem value="cppt">CPPT (Rawat Inap)</SelectItem>
              <SelectItem value="disposition">RTL (Disposisi)</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari pasien, MRN, atau deskripsi..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-4 text-sm text-muted-foreground">
          <span>Total: {items.length}</span>
          <span>•</span>
          <span>CPPT: {items.filter((i) => i.source === "cppt").length}</span>
          <span>•</span>
          <span>RTL: {items.filter((i) => i.source === "disposition").length}</span>
          <span>•</span>
          <span>
            Siap Kirim: {items.filter((i) => i.has_encounter).length}
          </span>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <ClipboardList className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Tidak ada data rencana rawat dalam periode ini</p>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[80px]">Sumber</TableHead>
                  <TableHead className="w-[120px]">No. Kunjungan</TableHead>
                  <TableHead>Pasien</TableHead>
                  <TableHead>Judul</TableHead>
                  <TableHead className="min-w-[200px]">Deskripsi</TableHead>
                  <TableHead className="w-[120px]">Tanggal</TableHead>
                  <TableHead className="w-[80px]">Status</TableHead>
                  <TableHead className="w-[100px] text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={`${item.source}-${item.id}`}>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={item.source === "cppt" ? "text-blue-600 border-blue-600" : "text-purple-600 border-purple-600"}
                      >
                        {getSourceIcon(item.source)}
                        <span className="ml-1">{getSourceLabel(item.source)}</span>
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {item.visit_number}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{item.patient_name}</p>
                        <p className="text-xs text-muted-foreground">{item.patient_mrn}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm font-medium">{item.title}</TableCell>
                    <TableCell>
                      <p className="text-sm line-clamp-2" title={item.description}>
                        {item.description}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {format(new Date(item.created_at), "dd MMM yyyy HH:mm", { locale: id })}
                    </TableCell>
                    <TableCell>
                      {item.has_encounter ? (
                        <Badge variant="outline" className="text-green-600 border-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Ready
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          No Enc
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={!item.has_encounter || sending === `${item.source}-${item.id}`}
                        onClick={() => handleSend(item)}
                      >
                        {sending === `${item.source}-${item.id}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Send className="h-3 w-3 mr-1" />
                            Kirim
                          </>
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
