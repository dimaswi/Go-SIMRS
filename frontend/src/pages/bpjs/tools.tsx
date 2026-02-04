import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2,
  Search,
  Save,
  FileText,
  User,
  Stethoscope,
  Calendar,
  CreditCard,
  ClipboardList,
  UserSearch,
  FileCheck,
  History,
  Settings2,
} from "lucide-react";
import { vclaimApi } from "@/lib/api/vclaim";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

// Sidebar menu items
const menuItems = [
  {
    id: "get-sep",
    label: "Get SEP",
    icon: FileText,
    description: "Ambil data SEP dari BPJS",
  },
  {
    id: "get-peserta",
    label: "Cek Peserta",
    icon: UserSearch,
    description: "Cek kepesertaan BPJS",
    disabled: true,
  },
  {
    id: "get-rujukan",
    label: "Cek Rujukan",
    icon: ClipboardList,
    description: "Cek rujukan peserta",
    disabled: true,
  },
  {
    id: "history-sep",
    label: "History SEP",
    icon: History,
    description: "Riwayat SEP peserta",
    disabled: true,
  },
  {
    id: "surat-kontrol",
    label: "Surat Kontrol",
    icon: FileCheck,
    description: "Kelola surat kontrol",
    disabled: true,
  },
  {
    id: "settings",
    label: "Pengaturan",
    icon: Settings2,
    description: "Konfigurasi VClaim",
    disabled: true,
  },
];

// Form schema for Get SEP
const getSEPSchema = z.object({
  noSEP: z.string().min(1, "Nomor SEP wajib diisi"),
});

type GetSEPForm = z.infer<typeof getSEPSchema>;

export default function BPJSToolsPage() {
  const { toast } = useToast();
  const [activeMenu, setActiveMenu] = useState("get-sep");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [sepData, setSepData] = useState<any>(null);

  const form = useForm<GetSEPForm>({
    resolver: zodResolver(getSEPSchema),
    defaultValues: {
      noSEP: "",
    },
  });

  // Fetch SEP from BPJS
  const handleGetSEP = async (data: GetSEPForm) => {
    setLoading(true);
    setSepData(null);
    try {
      const res = await vclaimApi.getSEP(data.noSEP);
      // Response structure langsung objek: { noSep, tglSep, peserta: {...}, dpjp: {...}, ... }
      const sep = res.data.data as any;
      
      if (sep?.noSep) {
        setSepData(sep);
        toast({
          title: "SEP Ditemukan",
          description: `No. SEP: ${sep.noSep} - ${sep.peserta?.nama || ""}`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "SEP Tidak Ditemukan",
          description: "Data SEP tidak ditemukan di BPJS",
        });
      }
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal",
        description: error.response?.data?.error || "Gagal mengambil data SEP",
      });
    } finally {
      setLoading(false);
    }
  };

  // Save SEP to local database
  const handleSaveSEP = async () => {
    if (!sepData) return;

    setSaving(true);
    try {
      // Full GetSEP response structure dengan nested objects
      const sep = sepData as any;
      
      const sepPayload = {
        no_sep: sep.noSep || "",
        no_kartu: sep.peserta?.noKartu || "",
        nama_pasien: sep.peserta?.nama || "",
        nik: sep.peserta?.nik || "",
        tgl_lahir: sep.peserta?.tglLahir || "",
        jenis_kelamin: sep.peserta?.kelamin || "",
        tgl_sep: sep.tglSep || "",
        jns_pelayanan: sep.jnsPelayanan || "",
        kls_rawat_hak: sep.klsRawat?.klsRawatHak || sep.kelasRawat || "",
        no_mr: sep.peserta?.noMr || "",
        asal_rujukan: "",
        no_rujukan: sep.noRujukan || "",
        tgl_rujukan: "",
        ppk_rujukan: "",
        nama_rujukan: "",
        kode_poli: "",
        nama_poli: sep.poli || "",
        kode_dpjp: sep.dpjp?.kdDPJP || "",
        nama_dpjp: sep.dpjp?.nmDPJP || "",
        ppk_pelayanan: "",
        diag_awal: sep.diagnosa || "",
        nama_diagnosa: sep.diagnosa || "",
        catatan: sep.catatan || "",
        patient_id: 0,
      };

      await api.post("/bpjs/vclaim/sep/import", sepPayload);
      
      toast({
        title: "SEP Tersimpan",
        description: `SEP ${sep.noSep} berhasil disimpan ke database lokal`,
      });
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Gagal Menyimpan",
        description: error.response?.data?.error || "Gagal menyimpan SEP",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <div className="w-64 border-r bg-muted/30 flex flex-col">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            BPJS Tools
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Utilitas VClaim & Antrian
          </p>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {menuItems.map((item) => (
              <button
                key={item.id}
                onClick={() => !item.disabled && setActiveMenu(item.id)}
                disabled={item.disabled}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors",
                  activeMenu === item.id
                    ? "bg-primary text-primary-foreground"
                    : item.disabled
                    ? "text-muted-foreground/50 cursor-not-allowed"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{item.label}</div>
                  <div className="text-xs opacity-70 truncate">
                    {item.description}
                  </div>
                </div>
                {item.disabled && (
                  <Badge variant="outline" className="text-[10px] px-1">
                    Soon
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </ScrollArea>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto">
        <div className="p-6">
          {activeMenu === "get-sep" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold">Get SEP dari BPJS</h1>
                <p className="text-muted-foreground">
                  Ambil data SEP dari server BPJS VClaim dan simpan ke database lokal
                </p>
              </div>

              {/* Search Form - Simple inline tanpa card */}
              <form
                onSubmit={form.handleSubmit(handleGetSEP)}
                className="flex gap-3"
              >
                <div className="flex-1">
                  <Input
                    placeholder="Masukkan Nomor SEP (contoh: 0202S0010226V000001)"
                    {...form.register("noSEP")}
                  />
                  {form.formState.errors.noSEP && (
                    <p className="text-xs text-destructive mt-1">
                      {form.formState.errors.noSEP.message}
                    </p>
                  )}
                </div>
                <Button type="submit" disabled={loading}>
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <Search className="h-4 w-4 mr-2" />
                  )}
                  Cari
                </Button>
              </form>

              {/* SEP Result */}
              {sepData && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Data SEP
                      </CardTitle>
                      <CardDescription className="font-mono">
                        {sepData.noSep}
                      </CardDescription>
                    </div>
                    <Button onClick={handleSaveSEP} disabled={saving}>
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Save className="h-4 w-4 mr-2" />
                      )}
                      Simpan ke Database
                    </Button>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Peserta Info */}
                    <div>
                      <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
                        <User className="h-4 w-4" />
                        Data Peserta
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <Label className="text-xs text-muted-foreground">Nama</Label>
                          <p className="font-medium">{sepData.peserta?.nama || "-"}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">No. Kartu</Label>
                          <p className="font-medium font-mono">{sepData.peserta?.noKartu || "-"}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">No. MR</Label>
                          <p className="font-medium font-mono">{sepData.peserta?.noMr || "-"}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Jenis Peserta</Label>
                          <p className="font-medium">{sepData.peserta?.jnsPeserta || "-"}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Tanggal Lahir</Label>
                          <p className="font-medium">{sepData.peserta?.tglLahir || "-"}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Jenis Kelamin</Label>
                          <p className="font-medium">
                            {sepData.peserta?.kelamin === "L" ? "Laki-laki" : 
                             sepData.peserta?.kelamin === "P" ? "Perempuan" : "-"}
                          </p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Hak Kelas</Label>
                          <p className="font-medium">{sepData.peserta?.hakKelas || sepData.klsRawat?.klsRawatHak || "-"}</p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* SEP Info */}
                    <div>
                      <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
                        <Calendar className="h-4 w-4" />
                        Data SEP
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <Label className="text-xs text-muted-foreground">Tanggal SEP</Label>
                          <p className="font-medium">{sepData.tglSep || "-"}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Jenis Pelayanan</Label>
                          <p className="font-medium">{sepData.jnsPelayanan || "-"}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Kelas Rawat</Label>
                          <p className="font-medium">{sepData.kelasRawat || "-"}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Poli</Label>
                          <p className="font-medium">{sepData.poli || "-"}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Tujuan Kunjungan</Label>
                          <p className="font-medium">{sepData.tujuanKunj?.nama || "-"}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Status Kecelakaan</Label>
                          <p className="font-medium">{sepData.nmstatusKecelakaan || "-"}</p>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* Diagnosa & DPJP */}
                    <div>
                      <h4 className="text-sm font-medium flex items-center gap-2 mb-3">
                        <Stethoscope className="h-4 w-4" />
                        Diagnosa & DPJP
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <Label className="text-xs text-muted-foreground">Diagnosa</Label>
                          <p className="font-medium">{sepData.diagnosa || "-"}</p>
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">DPJP</Label>
                          <p className="font-medium">
                            {sepData.dpjp?.nmDPJP || "-"}
                            {sepData.dpjp?.kdDPJP && (
                              <span className="text-muted-foreground ml-1">({sepData.dpjp.kdDPJP})</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    {sepData.catatan && (
                      <>
                        <Separator />
                        <div>
                          <Label className="text-xs text-muted-foreground">Catatan</Label>
                          <p className="text-sm">{sepData.catatan}</p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
