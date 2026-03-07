import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { eklaimLocalApi, eklaimLocalStatusLabels, eklaimLocalStatusColors } from '@/lib/api/eklaim-local';
import type { SEPData, EKlaimLocal, EKlaimLocalStatus } from '@/lib/api/eklaim-local';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import { Loader2, ArrowLeft, Copy, FileText, Send, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { id as localeId } from 'date-fns/locale';

interface Diagnosis {
  id: number;
  icd10_code: string;
  icd10_name: string;
  type: string;
}

interface VisitProcedure {
  id: number;
  procedure?: {
    name: string;
    icd9cm_code: string;
  };
  status: string;
}

export default function SEPDetailPage() {
  const { sepId } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [sep, setSep] = useState<SEPData | null>(null);
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>([]);
  const [visitProcedures, setVisitProcedures] = useState<VisitProcedure[]>([]);
  const [eklaimLocal, setEklaimLocal] = useState<EKlaimLocal | null>(null);

  // New Claim Modal state
  const [claimDialogOpen, setClaimDialogOpen] = useState(false);
  const [claimNomorKartu, setClaimNomorKartu] = useState('');
  const [claimNomorSEP, setClaimNomorSEP] = useState('');
  const [claimNomorRM, setClaimNomorRM] = useState('');
  const [claimNamaPasien, setClaimNamaPasien] = useState('');
  const [claimTglLahir, setClaimTglLahir] = useState('');
  const [claimGender, setClaimGender] = useState('0');

  const loadData = useCallback(async () => {
    if (!sepId) return;
    setLoading(true);
    try {
      const response = await eklaimLocalApi.getSEPDetail(Number(sepId));
      setSep(response.sep);
      setDiagnoses(response.diagnoses || []);
      setVisitProcedures(response.visit_procedures || []);
      setEklaimLocal(response.eklaim_local || null);
    } catch {
      toast({ variant: 'destructive', title: 'Error!', description: 'Gagal memuat detail SEP.' });
    } finally {
      setLoading(false);
    }
  }, [sepId, toast]);

  useEffect(() => {
    setPageTitle('Detail SEP');
    loadData();
  }, [loadData]);

  const handleOpenClaimDialog = () => {
    if (!sep) return;
    // Pre-fill from SEP data
    setClaimNomorKartu(sep.no_kartu || '');
    setClaimNomorSEP(sep.no_sep || '');
    setClaimNomorRM(sep.no_mr || '');
    setClaimNamaPasien(sep.nama_pasien || '');
    // Format tgl_lahir: API wants "yyyy-mm-dd hh:mm:ss"
    const tgl = sep.tgl_lahir || '';
    setClaimTglLahir(tgl.length === 10 ? tgl + ' 00:00:00' : tgl);
    // Gender: L=1, P=2
    setClaimGender(sep.jenis_kelamin === 'L' ? '1' : sep.jenis_kelamin === 'P' ? '2' : '0');
    setClaimDialogOpen(true);
  };

  const handleCreateClaim = async () => {
    if (!sepId) return;
    setSubmitting(true);
    try {
      const response = await eklaimLocalApi.createClaim(Number(sepId), {
        nomor_kartu: claimNomorKartu,
        nomor_sep: claimNomorSEP,
        nomor_rm: claimNomorRM,
        nama_pasien: claimNamaPasien,
        tgl_lahir: claimTglLahir,
        gender: Number(claimGender),
      });
      setClaimDialogOpen(false);
      toast({ variant: 'success', title: 'Berhasil!', description: 'Klaim baru berhasil dikirim ke server E-Klaim.' });
      // Navigate to the eklaim local detail
      if (response.eklaim_local?.id) {
        navigate(`/eklaim/data-klaim/${response.eklaim_local.id}`);
      }
    } catch (err: any) {
      const msg = err?.response?.data?.error || 'Gagal membuat klaim baru.';
      toast({ variant: 'destructive', title: 'Error!', description: msg });
      // If 409 conflict, reload to see existing data
      if (err?.response?.status === 409) {
        setClaimDialogOpen(false);
        loadData();
      }
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return format(new Date(dateString), 'dd MMM yyyy', { locale: localeId });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!sep) {
    return (
      <div className="flex flex-1 flex-col p-4">
        <p className="text-muted-foreground">SEP tidak ditemukan.</p>
        <Button variant="outline" onClick={() => window.history.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Kembali
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Detail SEP
            </h1>
            <p className="text-sm text-muted-foreground font-mono">{sep.no_sep}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {eklaimLocal ? (
            <Button onClick={() => navigate(`/eklaim/data-klaim/${eklaimLocal.id}`)}>
              <Send className="mr-2 h-4 w-4" />
              Buka E-Klaim
            </Button>
          ) : (
            <Button onClick={handleOpenClaimDialog} disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Copy className="mr-2 h-4 w-4" />
              )}
                Buat Klaim
            </Button>
          )}
        </div>
      </div>

      {/* Status Klaim */}
      {eklaimLocal && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <span className="text-sm">Status Klaim:</span>
          <Badge className={eklaimLocalStatusColors[eklaimLocal.status as EKlaimLocalStatus] || ''}>
            {eklaimLocalStatusLabels[eklaimLocal.status as EKlaimLocalStatus] || eklaimLocal.status}
          </Badge>
          {eklaimLocal.cbg_code && (
            <span className="text-sm font-mono ml-2">CBG: {eklaimLocal.cbg_code}</span>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {/* Info SEP */}
        <div className="rounded-lg border p-4 space-y-3">
          <div>
            <h3 className="text-sm font-medium">Data SEP</h3>
            <p className="text-xs text-muted-foreground">Informasi Surat Eligibilitas Peserta</p>
          </div>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-muted-foreground">No. SEP</span>
            <span className="font-mono font-medium">{sep.no_sep}</span>
            <span className="text-muted-foreground">No. Kartu BPJS</span>
            <span className="font-mono">{sep.no_kartu || '-'}</span>
            <span className="text-muted-foreground">Tgl SEP</span>
            <span>{formatDate(sep.tgl_sep)}</span>
            <span className="text-muted-foreground">Jenis Pelayanan</span>
            <span>{sep.jns_pelayanan === '1' ? 'Rawat Inap' : sep.jns_pelayanan === '2' ? 'Rawat Jalan' : sep.jns_pelayanan || '-'}</span>
            <span className="text-muted-foreground">Kelas Rawat</span>
            <span>Kelas {sep.kls_rawat_hak || '-'}</span>
            <span className="text-muted-foreground">Status</span>
            <Badge variant="outline" className="w-fit">{sep.status || '-'}</Badge>
          </div>
        </div>

        {/* Info Pasien */}
        <div className="rounded-lg border p-4 space-y-3">
          <div>
            <h3 className="text-sm font-medium">Data Pasien</h3>
            <p className="text-xs text-muted-foreground">Informasi pasien</p>
          </div>
          <div className="grid grid-cols-2 gap-y-2 text-sm">
            <span className="text-muted-foreground">Nama</span>
            <span className="font-medium">{sep.nama_pasien || '-'}</span>
            <span className="text-muted-foreground">No. RM</span>
            <span className="font-mono">{sep.no_mr || '-'}</span>
            <span className="text-muted-foreground">Tgl Lahir</span>
            <span>{formatDate(sep.tgl_lahir)}</span>
            <span className="text-muted-foreground">Jenis Kelamin</span>
            <span>{sep.jenis_kelamin === 'L' ? 'Laki-laki' : sep.jenis_kelamin === 'P' ? 'Perempuan' : sep.jenis_kelamin || '-'}</span>
            <span className="text-muted-foreground">Poli</span>
            <span>{sep.nama_poli || '-'}</span>
            <span className="text-muted-foreground">DPJP</span>
            <span>{sep.nama_dpjp || '-'}</span>
          </div>
        </div>
      </div>

      {/* Diagnosa dari RM */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">Diagnosa (Rekam Medis)</h3>
          <p className="text-xs text-muted-foreground">Data diagnosa dari rekam medis asli</p>
        </div>
        {diagnoses.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Belum ada diagnosa.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">#</TableHead>
                <TableHead className="w-[120px]">Kode ICD-10</TableHead>
                <TableHead>Nama Diagnosa</TableHead>
                <TableHead className="w-[120px]">Tipe</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {diagnoses.map((d, i) => (
                <TableRow key={d.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-mono font-medium">{d.icd10_code}</TableCell>
                  <TableCell>{d.icd10_name}</TableCell>
                  <TableCell>
                    <Badge variant={d.type === 'primary' ? 'default' : 'outline'}>
                      {d.type === 'primary' ? 'Primer' : d.type === 'secondary' ? 'Sekunder' : d.type}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Separator />

      {/* Prosedur dari RM */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">Prosedur / Tindakan (Rekam Medis)</h3>
          <p className="text-xs text-muted-foreground">Data prosedur dari rekam medis asli</p>
        </div>
        {visitProcedures.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Belum ada prosedur.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">#</TableHead>
                <TableHead className="w-[120px]">Kode ICD-9-CM</TableHead>
                <TableHead>Nama Prosedur</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visitProcedures.map((vp, i) => (
                <TableRow key={vp.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell className="font-mono font-medium">{vp.procedure?.icd9cm_code || '-'}</TableCell>
                  <TableCell>{vp.procedure?.name || '-'}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{vp.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* New Claim Dialog */}
      <Dialog open={claimDialogOpen} onOpenChange={setClaimDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5" />
              Buat Klaim Baru (new_claim)
            </DialogTitle>
            <DialogDescription>
              Data berikut akan dikirim ke server E-Klaim untuk membuat klaim baru. Periksa dan edit jika diperlukan.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="claimNomorKartu" className="text-xs font-medium">Nomor Kartu BPJS</Label>
                <Input
                  id="claimNomorKartu"
                  value={claimNomorKartu}
                  onChange={(e) => setClaimNomorKartu(e.target.value)}
                  placeholder="Nomor kartu peserta"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="claimNomorSEP" className="text-xs font-medium">Nomor SEP</Label>
                <Input
                  id="claimNomorSEP"
                  value={claimNomorSEP}
                  onChange={(e) => setClaimNomorSEP(e.target.value)}
                  placeholder="Nomor SEP"
                  className="font-mono"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="claimNomorRM" className="text-xs font-medium">Nomor Rekam Medis</Label>
                <Input
                  id="claimNomorRM"
                  value={claimNomorRM}
                  onChange={(e) => setClaimNomorRM(e.target.value)}
                  placeholder="Nomor RM"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="claimNamaPasien" className="text-xs font-medium">Nama Pasien</Label>
                <Input
                  id="claimNamaPasien"
                  value={claimNamaPasien}
                  onChange={(e) => setClaimNamaPasien(e.target.value)}
                  placeholder="Nama lengkap pasien"
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="claimTglLahir" className="text-xs font-medium">Tanggal Lahir</Label>
                <Input
                  id="claimTglLahir"
                  value={claimTglLahir}
                  onChange={(e) => setClaimTglLahir(e.target.value)}
                  placeholder="1990-01-01 00:00:00"
                  className="font-mono"
                />
                <p className="text-xs text-muted-foreground">Format: yyyy-mm-dd hh:mm:ss</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="claimGender" className="text-xs font-medium">Jenis Kelamin</Label>
                <Select value={claimGender} onValueChange={setClaimGender}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih jenis kelamin" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Laki-laki (1)</SelectItem>
                    <SelectItem value="2">Perempuan (2)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-md border border-blue-200 bg-blue-50 p-3">
              <p className="text-xs text-blue-800">
                Setelah klaim berhasil dibuat, data rekam medis (diagnosa &amp; prosedur) akan diduplikasi
                untuk keperluan E-Klaim dan Anda akan diarahkan ke halaman detail klaim.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setClaimDialogOpen(false)} disabled={submitting}>
              Batal
            </Button>
            <Button onClick={handleCreateClaim} disabled={submitting}>
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Kirim Klaim Baru
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
