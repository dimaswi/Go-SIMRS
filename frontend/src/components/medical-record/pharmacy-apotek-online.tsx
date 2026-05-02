import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Package,
  CheckCircle2,
  Send,
  Search,
  FilePlus,
  History,
  Trash2,
  XCircle,
} from "lucide-react";
import { medicineOrdersApi, visitsApi } from "@/lib/api";
import { bpjsApi } from "@/lib/api/bpjs";
import type { MedicineOrder } from "@/lib/api";

interface PharmacyApotekOnlineProps {
  visitId: number;
  readOnly?: boolean;
}

export function PharmacyApotekOnline({
  visitId,
  readOnly = false,
}: PharmacyApotekOnlineProps) {
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [orders, setOrders] = useState<MedicineOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<MedicineOrder | null>(null);


  // BPJS Apotek State
  const [sepNo, setSepNo] = useState("");
  const [sjpNo, setSjpNo] = useState("");
  const [jenisObat, setJenisObat] = useState("1"); // 0: Non-DPHO/Umum, 1: PRB, dll
  const [iterasi, setIterasi] = useState("0"); // 0: Non-Iterasi, 1: Iterasi
  const [noResep, setNoResep] = useState("");
  const [tglResep] = useState(new Date().toISOString().slice(0, 10));
  const [tglPelayanan] = useState(new Date().toISOString().slice(0, 10));
  const [kdDokter, setKdDokter] = useState("");
  const [poliInfo, setPoliInfo] = useState("");
  const [noKartu, setNoKartu] = useState("");

  const [dispenseItems, setDispenseItems] = useState<any[]>([]);

  // Riwayat Pelayanan Modal State
  const [riwayatOpen, setRiwayatOpen] = useState(false);
  const [riwayatLoading, setRiwayatLoading] = useState(false);
  const [riwayatData, setRiwayatData] = useState<any[]>([]);
  const [riwayatTglAwal, setRiwayatTglAwal] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [riwayatTglAkhir, setRiwayatTglAkhir] = useState(() => new Date().toISOString().slice(0, 10));
  const [deletingRiwayat, setDeletingRiwayat] = useState<string | null>(null);

  // Kirim Modal State
  const [kirimModalOpen, setKirimModalOpen] = useState(false);
  const [kirimItem, setKirimItem] = useState<any>(null);
  const [kirimForm, setKirimForm] = useState<any>({});
  const [sendingObat, setSendingObat] = useState(false);

  // Status Modal State
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [statusItem, setStatusItem] = useState<any>(null);

  useEffect(() => {
    loadOrders();
  }, [visitId]);

  useEffect(() => {
    if (selectedOrder) {
      initializeItems(selectedOrder);
    }
  }, [selectedOrder]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      // Get visit data to extract SEP if available
      const visitRes = await visitsApi.getById(visitId);
      const visitData = visitRes.data;
      if (visitData.registration?.sep_number) {
        setSepNo(visitData.registration.sep_number);
      }
      const bpjsNum = visitData.registration?.bpjs_number || visitData.registration?.patient?.no_bpjs;
      if (bpjsNum) {
        setNoKartu(bpjsNum);
      }

      const sep = visitData.registration?.sep;
      
      if (sep) {
        if (sep.kode_dpjp && sep.nama_dpjp) {
          setKdDokter(`${sep.kode_dpjp} - ${sep.nama_dpjp}`);
        } else if (sep.kode_dpjp) {
          setKdDokter(sep.kode_dpjp);
        }
        
        if (sep.kode_poli && sep.nama_poli) {
          setPoliInfo(`${sep.kode_poli} - ${sep.nama_poli}`);
        } else if (sep.kode_poli) {
          setPoliInfo(sep.kode_poli);
        }
      }

      // Load orders
      const res = await medicineOrdersApi.getAll({ pharmacy_visit_id: visitId });
      const data = res.data || [];
      setOrders(data);

      const eligibleOrder = data.find((o: MedicineOrder) =>
        ["reviewed", "preparing", "partial", "ready", "delivered"].includes(o.status)
      ) || data[0];

      if (eligibleOrder) {
        setSelectedOrder(eligibleOrder);
        setNoResep(eligibleOrder.order_number || `RX${Date.now()}`);
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Gagal memuat data order",
      });
    } finally {
      setLoading(false);
    }
  };

  const initializeItems = (order: MedicineOrder) => {
    setNoResep(order.order_number || `RX${Date.now()}`);
    const items = (order.items || [])
      .filter((item) => item.status !== "cancelled")
      .map((item) => ({
        ...item,
        selected: true,
        bpjs_status: "pending", // pending, sent, failed
      }));
    setDispenseItems(items);
  };


  useEffect(() => {
    const numIterasi = parseInt(iterasi);
    if (isNaN(numIterasi)) return;

    const totalPortions = numIterasi + 1;

    setDispenseItems((prev) =>
      prev.map((item) => {
        // We do not auto split anymore, start with empty values for user to fill
        const portions = [];

        for (let i = 0; i < totalPortions; i++) {
          portions.push({
            id: i + 1,
            date: i === 0 ? tglPelayanan : "",
            qty: "",
          });
        }

        return { ...item, portions };
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iterasi]); // Excluded tglPelayanan to prevent wiping user edits when changing date

  const handleUpdatePortionDate = (itemId: number, portionId: number, date: string) => {
    setDispenseItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const portions = item.portions?.map((p: any) =>
          p.id === portionId ? { ...p, date } : p
        );
        return { ...item, portions };
      })
    );
  };

  const handleUpdatePortionQty = (itemId: number, portionId: number, qtyStr: string) => {
    setDispenseItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const portions = item.portions?.map((p: any) =>
          p.id === portionId ? { ...p, qty: qtyStr } : p
        );
        return { ...item, portions };
      })
    );
  };

  // Mock API Call for checking SEP
  const handleCheckSEP = async () => {
    if (!sepNo) {
      toast({ variant: "destructive", title: "Error", description: "Nomor SEP kosong" });
      return;
    }
    setSubmitting(true);
    // Simulate API Call
    setTimeout(() => {
      setSubmitting(false);
      toast({ title: "Validasi SEP", description: "SEP Valid di sistem BPJS" });
    }, 1000);
  };

  // Mock API Call for Simpan Resep (Generate SJP)
  const handleGenerateSJP = async () => {
    if (!sepNo) {
      toast({ variant: "destructive", title: "Error", description: "Nomor SEP wajib diisi untuk membuat SJP" });
      return;
    }
    setSubmitting(true);
    // Simulate API Call
    setTimeout(() => {
      setSjpNo("SJP" + Math.floor(Math.random() * 1000000));
      setSubmitting(false);
      toast({ title: "Simpan Resep", description: "SJP berhasil digenerate" });
    }, 1000);
  };

  const openKirimModal = (item: any) => {
    setKirimItem(item);

    const isRacikan = item.item_type === "racikan" || item.is_racikan;
    const quantity = parseFloat(item.quantity) || 1;
    let signa1 = 1, signa2 = 1;
    if (item.dosage) {
      const parts = String(item.dosage).split(/x|X|\*/);
      if (parts.length >= 2) {
        signa1 = parseInt(parts[0].trim()) || 1;
        signa2 = parseInt(parts[1].trim()) || 1;
      }
    }

    setKirimForm({
      NOSJP: sjpNo,
      NORESEP: noResep,
      KDOBT: item.medicine?.bpjs_kode_obat || "",
      NMOBAT: item.medicine?.name || item.name || "",
      SIGNA1OBT: signa1,
      SIGNA2OBT: signa2,
      JMLOBT: quantity,
      JHO: parseInt(item.duration) || 1,
      CatKhsObt: item.instructions || item.notes || "",
      JNSROBT: isRacikan ? "R.01" : "",
      PERMINTAAN: isRacikan ? 1 : "",
      SISA_STOK: 100
    });
    setKirimModalOpen(true);
  };

  const handleKirimSubmit = async () => {
    if (!kirimItem) return;
    setSendingObat(true);
    const isRacikan = kirimItem.item_type === "racikan" || kirimItem.is_racikan;

    try {
      const payload = { ...kirimForm };
      const sisaStok = parseInt(payload.SISA_STOK) || 0;
      delete payload.SISA_STOK;

      // Clean empty fields
      if (!isRacikan) {
        delete payload.JNSROBT;
        delete payload.PERMINTAAN;
      }

      if (isRacikan) {
        await bpjsApi.apotekInsertObatRacikan(payload);
      } else {
        await bpjsApi.apotekInsertObatNonRacikan(payload);
      }

      // Update stok
      await bpjsApi.apotekUpdateStokObat({
        KDOBAT: kirimForm.KDOBT,
        STOK: sisaStok
      });

      setDispenseItems(prev => prev.map(p =>
        p.id === kirimItem.id ? {
          ...p,
          bpjs_status: "sent",
          bpjs_msg: `Berhasil dikirim. Stok BPJS dikurangi sejumlah ${kirimForm.JMLOBT}, Sisa: ${sisaStok}`
        } : p
      ));
      toast({ title: "Berhasil", description: "Obat berhasil dikirim dan stok diupdate" });
      setKirimModalOpen(false);
    } catch (error: any) {
      const msg = error.response?.data?.error || "Terjadi kesalahan API BPJS";
      setDispenseItems(prev => prev.map(p =>
        p.id === kirimItem.id ? { ...p, bpjs_status: "failed", bpjs_msg: msg } : p
      ));
      toast({ variant: "destructive", title: "Gagal Mengirim Obat", description: msg });
      setKirimModalOpen(false);
    } finally {
      setSendingObat(false);
    }
  };

  const openStatusModal = (item: any) => {
    setStatusItem(item);
    setStatusModalOpen(true);
  };

  const handleLoadRiwayat = async () => {
    if (!noKartu) {
      toast({ variant: "destructive", title: "Error", description: "Nomor kartu BPJS tidak ditemukan" });
      return;
    }
    setRiwayatLoading(true);
    setRiwayatData([]);
    try {
      const res = await bpjsApi.apotekGetRiwayatPelayananObat(riwayatTglAwal, riwayatTglAkhir, noKartu);
      const data = res.data?.data as any;
      if (Array.isArray(data)) {
        setRiwayatData(data);
      } else if (data?.list && Array.isArray(data.list)) {
        setRiwayatData(data.list);
      } else if (data) {
        setRiwayatData([data]);
      } else {
        toast({ title: "Info", description: "Data riwayat kosong" });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal memuat riwayat",
        description: error.response?.data?.error || "Terjadi kesalahan",
      });
    } finally {
      setRiwayatLoading(false);
    }
  };

  const handleDeleteRiwayat = async (nosjp: string, noresep: string, obat: any) => {
    setDeletingRiwayat(nosjp + noresep + obat.kodeobat);
    try {
      await bpjsApi.apotekHapusPelayananObat({
        nosjp,
        noresep,
        kodeobat: obat.kodeobat,
      });
      toast({ title: "Berhasil", description: `Riwayat pelayanan obat ${obat.namaobat} berhasil dihapus` });
      handleLoadRiwayat();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal menghapus",
        description: error.response?.data?.error || "Terjadi kesalahan",
      });
    } finally {
      setDeletingRiwayat(null);
    }
  };

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center py-8 gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-muted-foreground">Memuat data...</span>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="p-4 flex flex-col items-center justify-center py-8 text-muted-foreground">
        <Package className="h-12 w-12 mb-4 opacity-50" />
        <p>Tidak ada order obat untuk visit ini</p>
      </div>
    );
  }

  const allSent = dispenseItems.length > 0 && dispenseItems.every((item) => item.bpjs_status === "sent");

  return (
    <div className="space-y-6">
      {/* Form Simpan Resep (Generate SJP) */}
      <div className="border border-border/70">
        <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Formulir Pembuatan SJP Resep Apotek Online
        </div>

        <div className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-border/70">
                <td className="w-1/3 py-2 px-3 sm:px-4 bg-muted/10 font-medium border-r border-border/70 align-middle">Nomor SEP</td>
                <td className="w-2/3 py-2 px-3 sm:px-4">
                  <div className="flex items-center gap-2 w-full">
                    <Input
                      value={sepNo}
                      onChange={(e) => setSepNo(e.target.value)}
                      placeholder="Masukkan No SEP"
                      className="h-8 flex-1"
                      readOnly
                    />
                    <Button
                      size="sm"
                      className="h-8"
                      variant="secondary"
                      onClick={handleCheckSEP}
                      disabled={submitting || !sepNo || readOnly || !!sjpNo}
                    >
                      Cek SEP
                    </Button>
                  </div>
                </td>
              </tr>

              <tr className="border-b border-border/70">
                <td className="w-1/3 py-2 px-3 sm:px-4 bg-muted/10 font-medium border-r border-border/70 align-middle">Nomor Resep</td>
                <td className="w-2/3 py-2 px-3 sm:px-4">
                  <Input
                    value={noResep}
                    readOnly
                    className="h-8 w-full bg-muted/50"
                  />
                </td>
              </tr>

              <tr className="border-b border-border/70">
                <td className="w-1/3 py-2 px-3 sm:px-4 bg-muted/10 font-medium border-r border-border/70 align-middle">Poli / Unit</td>
                <td className="w-2/3 py-2 px-3 sm:px-4">
                  <Input
                    value={poliInfo}
                    readOnly
                    className="h-8 w-full bg-muted/50"
                  />
                </td>
              </tr>

              <tr className="border-b border-border/70">
                <td className="w-1/3 py-2 px-3 sm:px-4 bg-muted/10 font-medium border-r border-border/70 align-middle">Dokter BPJS</td>
                <td className="w-2/3 py-2 px-3 sm:px-4">
                  <Input
                    value={kdDokter}
                    readOnly
                    className="h-8 w-full bg-muted/50"
                  />
                </td>
              </tr>

              <tr className="border-b border-border/70">
                <td className="w-1/3 py-2 px-3 sm:px-4 bg-muted/10 font-medium border-r border-border/70 align-middle">Tanggal Resep & Pelayanan</td>
                <td className="w-2/3 py-2 px-3 sm:px-4">
                  <div className="flex items-center gap-2 w-full">
                    <Input
                      type="date"
                      value={tglResep}
                      readOnly
                      className="h-8 text-xs w-full bg-muted/50"
                    />
                    <span className="text-muted-foreground">-</span>
                    <Input
                      type="date"
                      value={tglPelayanan}
                      readOnly
                      className="h-8 text-xs w-full bg-muted/50"
                    />
                  </div>
                </td>
              </tr>

              <tr className="border-b border-border/70">
                <td className="w-1/3 py-2 px-3 sm:px-4 bg-muted/10 font-medium border-r border-border/70 align-middle">Jenis Resep</td>
                <td className="w-2/3 py-2 px-3 sm:px-4">
                  <Select value={jenisObat} onValueChange={setJenisObat} disabled={readOnly || !!sjpNo}>
                    <SelectTrigger className="h-8 text-xs w-full">
                      <SelectValue placeholder="Pilih Jenis" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">PRB</SelectItem>
                      <SelectItem value="2">Kronis Belum PRB</SelectItem>
                      <SelectItem value="3">Kemoterapi</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
              </tr>

              <tr>
                <td className="w-1/3 py-2 px-3 sm:px-4 bg-muted/10 font-medium border-r border-border/70 align-middle">Iterasi</td>
                <td className="w-2/3 py-2 px-3 sm:px-4">
                  <Select value={iterasi} onValueChange={setIterasi} disabled={readOnly || !!sjpNo}>
                    <SelectTrigger className="h-8 text-xs w-full">
                      <SelectValue placeholder="Status Iterasi" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Non-Iterasi</SelectItem>
                      <SelectItem value="1">Iterasi 1x (Total 2x Ambil)</SelectItem>
                      <SelectItem value="2">Iterasi 2x (Total 3x Ambil)</SelectItem>
                      <SelectItem value="3">Iterasi 3x (Total 4x Ambil)</SelectItem>
                    </SelectContent>
                  </Select>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-border/70 p-3 sm:p-4 bg-muted/10">
          <Button
            onClick={handleGenerateSJP}
            disabled={submitting || !sepNo || !!sjpNo || readOnly}
            className="w-[200px] text-xs"
            variant="outline"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FilePlus className="h-4 w-4 mr-2" />}
            Generate SJP
          </Button>
          <Button
            onClick={() => setRiwayatOpen(true)}
            className="w-[200px] text-xs"
            variant="secondary"
          >
            <History className="h-4 w-4 mr-2" />
            Riwayat Obat
          </Button>
          {sjpNo && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">SJP Berhasil Digenerate:</span>
              <Badge variant="default" className="text-sm px-3 py-1">
                {sjpNo}
              </Badge>
            </div>
          )}
        </div>
      </div>

      {/* Patient & Order Info Table */}
      {selectedOrder && (
        <div className="border border-border/70">
          <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            Daftar Obat dan Status Pengiriman
          </div>

          {allSent && (
            <div className="flex items-center gap-2 text-green-600 bg-green-50 dark:bg-green-950 p-3 border-b border-green-200">
              <CheckCircle2 className="h-5 w-5" />
              <span className="font-medium text-sm">Semua obat telah dikirim ke BPJS</span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-xs">
              <thead className="bg-muted/50 border-b border-border/70">
                <tr>
                    <th className="py-1.5 px-2 text-left w-[35%]">Obat (SIMRS)</th>
                    <th className="py-1.5 px-2 text-left w-[30%]">Mapping DPHO</th>
                    <th className="py-1.5 px-2 text-center w-[15%]">Jumlah</th>
                    <th className="py-1.5 px-2 text-center w-[20%]">Aksi / Status</th>
                  </tr>
                </thead>
                <tbody>
                  {dispenseItems.map((item) => {
                    const isSent = item.bpjs_status === "sent";
                    const isFailed = item.bpjs_status === "failed";
                    const isMapped = !!item.medicine?.bpjs_kode_obat;

                    return (
                      <React.Fragment key={item.id}>
                        <tr className={`border-t ${isSent ? "bg-green-50/60 dark:bg-green-950/20" : isFailed ? "bg-red-50/60 dark:bg-red-950/20" : ""}`}>
                          <td className="py-2 px-2 align-top">
                            <p className="font-medium break-words">{item.medicine?.name || "-"}</p>
                            <p className="text-[11px] text-muted-foreground">{item.dosage || "-"} {item.frequency || "-"}</p>
                          </td>
                          <td className="py-2 px-2 align-top">
                            {isMapped ? (
                              <div>
                                <Badge variant="outline" className="mb-1">{item.medicine.bpjs_kode_obat}</Badge>
                                <p className="text-[11px] text-muted-foreground">Jenis: {item.medicine.bpjs_jenis_obat || "Umum"}</p>
                              </div>
                            ) : (
                              <Badge variant="destructive" className="text-[10px]">Belum Di-mapping</Badge>
                            )}
                          </td>
                          <td className="py-2 px-2 align-top text-center font-medium">
                            {item.quantity} {item.unit}
                          </td>
                          <td className="py-2 px-2 align-top text-center">
                            {isSent ? (
                              <Button variant="ghost" size="sm" onClick={() => openStatusModal(item)} className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-100 dark:hover:bg-green-900 rounded-full">
                                <CheckCircle2 className="h-5 w-5" />
                              </Button>
                            ) : isFailed ? (
                              <Button variant="ghost" size="sm" onClick={() => openStatusModal(item)} className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900 rounded-full">
                                <XCircle className="h-5 w-5" />
                              </Button>
                            ) : (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => openKirimModal(item)}
                                disabled={!sjpNo || !isMapped || readOnly}
                                className="h-7 text-[10px] w-full"
                              >
                                <Send className="h-3 w-3 mr-1" /> Kirim
                              </Button>
                            )}
                          </td>
                        </tr>
                        {item.portions && item.portions.length > 1 && (
                          <tr className="bg-muted/5 border-t">
                            <td colSpan={4} className="p-0">
                              <table className="w-full text-xs bg-muted/10">
                                <thead>
                                  <tr>
                                    <th className="py-1.5 px-4 text-left font-medium text-muted-foreground bg-muted/20 w-[20%] border-b border-border/50">Iterasi</th>
                                    <th className="py-1.5 px-2 text-left font-medium text-muted-foreground bg-muted/20 w-[40%] border-b border-border/50">Tanggal</th>
                                    <th className="py-1.5 px-2 text-left font-medium text-muted-foreground bg-muted/20 w-[40%] border-b border-border/50">Jumlah</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {item.portions.map((p: any, idx: number) => (
                                    <tr key={p.id} className="border-b border-border/50 last:border-b-0">
                                      <td className="py-1.5 px-4 font-medium text-muted-foreground">
                                        Pengambilan {p.id}
                                      </td>
                                      <td className="py-1.5 px-2">
                                        <Input
                                          type="date"
                                          value={p.date}
                                          onChange={(e) => handleUpdatePortionDate(item.id, p.id, e.target.value)}
                                          className="h-6 w-32 text-xs rounded-none border-border/70"
                                          disabled={readOnly || !!sjpNo}
                                        />
                                      </td>
                                      <td className="py-1.5 px-2">
                                        <div className="flex items-center gap-2">
                                          <Input
                                            type="number"
                                            value={p.qty}
                                            onChange={(e) => handleUpdatePortionQty(item.id, p.id, e.target.value)}
                                            className="h-6 w-16 text-xs text-center rounded-none border-border/70"
                                            disabled={readOnly || !!sjpNo}
                                          />
                                          <span className="text-muted-foreground">{item.unit}</span>
                                          {idx === 0 && <Badge variant="secondary" className="ml-auto text-[10px] rounded-none">Hari Ini</Badge>}
                                        </div>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                  {dispenseItems.length === 0 && (
                    <tr>
                      <td colSpan={4} className="py-4 text-center text-xs text-muted-foreground">
                        Tidak ada item obat
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
        </div>
      )}
      {/* Riwayat Modal */}
      <Dialog open={riwayatOpen} onOpenChange={setRiwayatOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4" />
              Riwayat Pelayanan Obat BPJS ({noKartu})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="flex items-center gap-2">
              <Input
                type="date"
                value={riwayatTglAwal}
                onChange={(e) => setRiwayatTglAwal(e.target.value)}
                className="w-40 text-xs h-8"
              />
              <span className="text-muted-foreground text-xs">s/d</span>
              <Input
                type="date"
                value={riwayatTglAkhir}
                onChange={(e) => setRiwayatTglAkhir(e.target.value)}
                className="w-40 text-xs h-8"
              />
              <Button size="sm" onClick={handleLoadRiwayat} disabled={riwayatLoading} className="h-8 text-xs">
                {riwayatLoading ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Search className="h-3 w-3 mr-2" />}
                Cari Riwayat
              </Button>
            </div>

            <div className="border rounded-md overflow-hidden bg-background">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50 text-left">
                      <th className="p-2 border-b">No. SJP</th>
                      <th className="p-2 border-b">No. Resep</th>
                      <th className="p-2 border-b">Tgl Pelayanan</th>
                      <th className="p-2 border-b">Obat</th>
                      <th className="p-2 border-b text-center">Jml</th>
                      <th className="p-2 border-b">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {riwayatLoading ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-muted-foreground">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                          Memuat riwayat...
                        </td>
                      </tr>
                    ) : riwayatData.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-muted-foreground">
                          Tidak ada riwayat pelayanan obat pada periode tersebut.
                        </td>
                      </tr>
                    ) : (
                      riwayatData.map((item: any, i: number) => {
                        const rowKey = `${item.nosjp}-${item.noresep}-${item.kodeobat}-${i}`;
                        const isDeleting = deletingRiwayat === item.nosjp + item.noresep + item.kodeobat;
                        return (
                          <tr key={rowKey} className="border-b last:border-0 hover:bg-muted/10">
                            <td className="p-2 font-mono">{item.nosjp}</td>
                            <td className="p-2 font-mono">{item.noresep}</td>
                            <td className="p-2">{item.tglpelayanan}</td>
                            <td className="p-2">
                              <span className="font-medium block">{item.namaobat}</span>
                              <span className="text-[10px] text-muted-foreground block">{item.kodeobat}</span>
                            </td>
                            <td className="p-2 text-center">{item.jumlah}</td>
                            <td className="p-2">
                              <Button
                                variant="destructive"
                                size="sm"
                                className="h-6 px-2 text-[10px]"
                                disabled={isDeleting}
                                onClick={() => handleDeleteRiwayat(item.nosjp, item.noresep, item)}
                              >
                                {isDeleting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Trash2 className="h-3 w-3 mr-1" />}
                                Hapus
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Kirim Obat Form Modal */}
      <Dialog open={kirimModalOpen} onOpenChange={setKirimModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              Kirim Obat ke BPJS
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Nomor SJP</Label>
                <Input value={kirimForm.NOSJP || ""} disabled className="h-8 text-xs bg-muted/50" />
              </div>
              <div>
                <Label className="text-xs">Nomor Resep</Label>
                <Input value={kirimForm.NORESEP || ""} disabled className="h-8 text-xs bg-muted/50" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <Label className="text-xs">Kode Obat</Label>
                <Input value={kirimForm.KDOBT || ""} disabled className="h-8 text-xs bg-muted/50" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Nama Obat</Label>
                <Input value={kirimForm.NMOBAT || ""} disabled className="h-8 text-xs bg-muted/50" />
              </div>
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div>
                <Label className="text-xs">Signa 1</Label>
                <Input type="number" value={kirimForm.SIGNA1OBT || ""} onChange={e => setKirimForm({ ...kirimForm, SIGNA1OBT: e.target.value })} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Signa 2</Label>
                <Input type="number" value={kirimForm.SIGNA2OBT || ""} onChange={e => setKirimForm({ ...kirimForm, SIGNA2OBT: e.target.value })} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Jumlah</Label>
                <Input type="number" value={kirimForm.JMLOBT || ""} onChange={e => setKirimForm({ ...kirimForm, JMLOBT: e.target.value })} className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Hari</Label>
                <Input type="number" value={kirimForm.JHO || ""} onChange={e => setKirimForm({ ...kirimForm, JHO: e.target.value })} className="h-8 text-xs" />
              </div>
            </div>

            {(kirimItem?.item_type === "racikan" || kirimItem?.is_racikan) && (
              <div className="grid grid-cols-2 gap-3 p-3 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 rounded">
                <div>
                  <Label className="text-xs">Jenis Racikan</Label>
                  <Input value={kirimForm.JNSROBT || ""} onChange={e => setKirimForm({ ...kirimForm, JNSROBT: e.target.value })} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Permintaan</Label>
                  <Input type="number" value={kirimForm.PERMINTAAN || ""} onChange={e => setKirimForm({ ...kirimForm, PERMINTAAN: e.target.value })} className="h-8 text-xs" />
                </div>
              </div>
            )}

            <div>
              <Label className="text-xs">Catatan Khusus</Label>
              <Input value={kirimForm.CatKhsObt || ""} onChange={e => setKirimForm({ ...kirimForm, CatKhsObt: e.target.value })} className="h-8 text-xs" placeholder="Misal: Diminum sesudah makan" />
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 rounded">
              <Label className="text-xs font-semibold text-amber-800 dark:text-amber-500">Update Stok BPJS</Label>
              <p className="text-[10px] text-amber-700/80 dark:text-amber-600/80 mb-2">Setelah kirim obat, stok di DPHO akan diperbarui. Masukkan SISA STOK obat saat ini.</p>
              <Input type="number" value={kirimForm.SISA_STOK || ""} onChange={e => setKirimForm({ ...kirimForm, SISA_STOK: e.target.value })} className="h-8 text-xs font-mono" placeholder="Jumlah Sisa Stok" />
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" className="h-8 text-xs" onClick={() => setKirimModalOpen(false)}>Batal</Button>
              <Button type="button" size="sm" className="h-8 text-xs" disabled={sendingObat} onClick={handleKirimSubmit}>
                {sendingObat ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <Send className="h-3 w-3 mr-2" />}
                Simpan & Update Stok
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Status Modal */}
      <Dialog open={statusModalOpen} onOpenChange={setStatusModalOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              {statusItem?.bpjs_status === "sent" ? (
                <><CheckCircle2 className="h-4 w-4 text-green-500" /> Informasi Pengiriman</>
              ) : (
                <><XCircle className="h-4 w-4 text-red-500" /> Kesalahan Pengiriman</>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2 text-sm">
            <p className="text-muted-foreground text-xs leading-relaxed">
              {statusItem?.bpjs_msg || "Tidak ada detail yang tersedia."}
            </p>
            <div className="flex justify-end pt-2">
              <Button type="button" size="sm" className="h-8 text-xs" onClick={() => setStatusModalOpen(false)}>Tutup</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
