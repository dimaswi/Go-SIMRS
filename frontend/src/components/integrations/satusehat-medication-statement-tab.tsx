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
  Pill,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { satuSehatApi } from "@/lib/api/integrations";

interface MedicationStatementItem {
  id: number;
  visit_id: number;
  visit_number: string;
  patient_name: string;
  patient_mrn: string;
  room_name: string;
  current_medications: string;
  created_at: string;
  has_encounter: boolean;
}

export function MedicationStatementTab() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState<number | null>(null);
  const [items, setItems] = useState<MedicationStatementItem[]>([]);
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);

  useEffect(() => {
    loadData();
  }, [startDate, endDate]);

  const loadData = async () => {
    setLoading(true);
    try {
      const response = await satuSehatApi.getMedicationStatementMonitoring(startDate, endDate);
      setItems(response.data.data || []);
    } catch {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data riwayat obat",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async (item: MedicationStatementItem) => {
    if (!item.has_encounter) {
      toast({
        variant: "destructive",
        title: "Tidak Bisa Kirim",
        description: "Encounter harus dikirim terlebih dahulu",
      });
      return;
    }

    setSending(item.id);
    try {
      const response = await satuSehatApi.sendMedicationStatement(item.id);
      toast({
        variant: "success",
        title: "Berhasil!",
        description: response.data.message || "MedicationStatement terkirim",
      });
      loadData();
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast({
        variant: "destructive",
        title: "Gagal",
        description: err.response?.data?.error || "Gagal mengirim MedicationStatement",
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
      item.current_medications.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Pill className="h-5 w-5" />
              MedicationStatement - Riwayat Pengobatan
            </CardTitle>
            <CardDescription>
              Kirim riwayat obat yang dikonsumsi pasien (dari Anamnesis) ke SatuSehat
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
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Cari pasien, MRN, atau nomor kunjungan..."
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
            <Pill className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Tidak ada data riwayat obat dalam periode ini</p>
          </div>
        ) : (
          <div className="border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[120px]">No. Kunjungan</TableHead>
                  <TableHead>Pasien</TableHead>
                  <TableHead>Ruangan</TableHead>
                  <TableHead className="min-w-[200px]">Riwayat Obat</TableHead>
                  <TableHead className="w-[120px]">Tanggal</TableHead>
                  <TableHead className="w-[80px]">Status</TableHead>
                  <TableHead className="w-[100px] text-center">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">
                      {item.visit_number}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{item.patient_name}</p>
                        <p className="text-xs text-muted-foreground">{item.patient_mrn}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{item.room_name || "-"}</TableCell>
                    <TableCell>
                      <p className="text-sm line-clamp-2" title={item.current_medications}>
                        {item.current_medications}
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
                        disabled={!item.has_encounter || sending === item.id}
                        onClick={() => handleSend(item)}
                      >
                        {sending === item.id ? (
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
