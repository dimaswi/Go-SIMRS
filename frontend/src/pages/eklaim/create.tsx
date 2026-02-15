import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { eklaimApi, jenisRawatLabels, caraMasukLabels, jenisKeluarLabels } from '@/lib/api/eklaim';
import type { CreateEKlaimInput } from '@/lib/api/eklaim';
import { useToast } from '@/hooks/use-toast';
import { setPageTitle } from '@/lib/page-title';
import {
  Loader2,
  ArrowLeft,
  Save,
  FileCheck,
  CreditCard,
  Calendar,
} from 'lucide-react';

export default function EKlaimCreate() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [visitId, setVisitId] = useState<number | undefined>();
  const [noSep, setNoSep] = useState('');
  const [noKartu, setNoKartu] = useState('');
  const [jenisRawat, setJenisRawat] = useState<string>('2'); // Default Rawat Inap
  const [caraMasuk, setCaraMasuk] = useState<string>('2'); // Default Poliklinik
  const [jenisKeluar, setJenisKeluar] = useState<string>('1'); // Default Sembuh
  const [tglMasuk, setTglMasuk] = useState<string>('');
  const [tglPulang, setTglPulang] = useState<string>('');
  const [tglLahir, setTglLahir] = useState<string>('');
  const [jenisKelamin, setJenisKelamin] = useState<string>('1'); // 1=Laki, 2=Perempuan
  const [beratBadan, setBeratBadan] = useState<number>(0);
  
  // Tarif RS
  const [tarifRs, setTarifRs] = useState<number>(0);
  const [tarifProsedur, setTarifProsedur] = useState<number>(0);
  const [tarifAlkes, setTarifAlkes] = useState<number>(0);
  const [tarifObat, setTarifObat] = useState<number>(0);
  const [tarifKamar, setTarifKamar] = useState<number>(0);
  const [tarifLainnya, setTarifLainnya] = useState<number>(0);

  // Initialize from URL params
  useEffect(() => {
    setPageTitle('Buat E-Klaim Baru');
    
    const visId = searchParams.get('visit_id');
    const sep = searchParams.get('no_sep');
    const kartu = searchParams.get('no_kartu');
    
    if (visId) setVisitId(Number(visId));
    if (sep) setNoSep(decodeURIComponent(sep));
    if (kartu) setNoKartu(decodeURIComponent(kartu));
    
    // Set default dates to today
    const today = new Date().toISOString().split('T')[0];
    setTglMasuk(today);
    setTglPulang(today);
  }, [searchParams]);

  // Calculate LOS
  const calculateLOS = () => {
    if (!tglMasuk || !tglPulang) return 0;
    const start = new Date(tglMasuk);
    const end = new Date(tglPulang);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  };

  // Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!noSep) {
      toast({
        variant: 'destructive',
        title: 'Validasi Error',
        description: 'Nomor SEP wajib diisi.',
      });
      return;
    }
    
    if (!noKartu) {
      toast({
        variant: 'destructive',
        title: 'Validasi Error',
        description: 'Nomor Kartu BPJS wajib diisi.',
      });
      return;
    }
    
    if (!visitId) {
      toast({
        variant: 'destructive',
        title: 'Validasi Error',
        description: 'Visit ID wajib diisi.',
      });
      return;
    }
    
    if (!tglMasuk || !tglPulang) {
      toast({
        variant: 'destructive',
        title: 'Validasi Error',
        description: 'Tanggal masuk dan keluar wajib diisi.',
      });
      return;
    }
    
    setSaving(true);
    try {
      const payload: CreateEKlaimInput = {
        visit_id: visitId,
        no_sep: noSep,
        no_kartu: noKartu,
        jenis_rawat: jenisRawat,
        cara_masuk: caraMasuk,
        jenis_keluar: jenisKeluar,
        tgl_masuk: tglMasuk,
        tgl_pulang: tglPulang,
        tgl_lahir: tglLahir || undefined,
        jenis_kelamin: jenisKelamin,
        berat_badan: beratBadan,
        tarif_rs: tarifRs,
        tarif_prosedur: tarifProsedur,
        tarif_alkes: tarifAlkes,
        tarif_obat: tarifObat,
        tarif_kamar: tarifKamar,
        tarif_lainnya: tarifLainnya,
      };
      
      const response = await eklaimApi.create(payload);
      toast({
        title: 'Berhasil!',
        description: 'E-Klaim berhasil dibuat.',
      });
      navigate(`/eklaim/bpjs/${response.data.id}`);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error!',
        description: error?.response?.data?.error || 'Gagal membuat E-Klaim.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/eklaim')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-lg font-semibold">Buat E-Klaim Baru</h1>
          <p className="text-sm text-muted-foreground">
            Buat klaim BPJS baru untuk pasien dengan SEP yang valid
          </p>
        </div>
      </div>
      <div className="rounded-lg border p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Visit & SEP Information */}
            <div className="space-y-4">
              <Label className="text-base font-semibold flex items-center gap-2">
                <FileCheck className="h-4 w-4" />
                Informasi SEP & Kunjungan
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="visit_id">Visit ID *</Label>
                  <Input
                    id="visit_id"
                    type="number"
                    value={visitId || ''}
                    onChange={(e) => setVisitId(e.target.value ? Number(e.target.value) : undefined)}
                    placeholder="ID Kunjungan"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="no_sep">Nomor SEP *</Label>
                  <Input
                    id="no_sep"
                    value={noSep}
                    onChange={(e) => setNoSep(e.target.value)}
                    placeholder="Contoh: 0001R0010121K000001"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="no_kartu">No. Kartu BPJS *</Label>
                  <div className="relative">
                    <CreditCard className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="no_kartu"
                      value={noKartu}
                      onChange={(e) => setNoKartu(e.target.value)}
                      placeholder="Nomor kartu BPJS"
                      className="pl-9"
                      required
                    />
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Jenis Pelayanan */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Jenis Pelayanan</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="jenis_rawat">Jenis Rawat *</Label>
                  <Select value={jenisRawat} onValueChange={setJenisRawat}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih jenis rawat" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(jenisRawatLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cara_masuk">Cara Masuk</Label>
                  <Select value={caraMasuk} onValueChange={setCaraMasuk}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih cara masuk" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(caraMasukLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="jenis_keluar">Jenis Keluar</Label>
                  <Select value={jenisKeluar} onValueChange={setJenisKeluar}>
                    <SelectTrigger>
                      <SelectValue placeholder="Pilih jenis keluar" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(jenisKeluarLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* Dates */}
            <div className="space-y-4">
              <Label className="text-base font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Tanggal Perawatan
              </Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Tanggal Masuk *</Label>
                  <Input
                    type="date"
                    value={tglMasuk}
                    onChange={(e) => setTglMasuk(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tanggal Keluar *</Label>
                  <Input
                    type="date"
                    value={tglPulang}
                    onChange={(e) => setTglPulang(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Length of Stay (LOS)</Label>
                  <div className="h-10 px-3 py-2 rounded-md border bg-muted/50 flex items-center">
                    <span className="font-medium">{calculateLOS()} hari</span>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Patient Info */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Informasi Pasien</Label>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label>Tanggal Lahir</Label>
                  <Input
                    type="date"
                    value={tglLahir}
                    onChange={(e) => setTglLahir(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Jenis Kelamin</Label>
                  <Select value={jenisKelamin} onValueChange={setJenisKelamin}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Laki-laki</SelectItem>
                      <SelectItem value="2">Perempuan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Berat Badan (kg)</Label>
                  <Input
                    type="number"
                    value={beratBadan || ''}
                    onChange={(e) => setBeratBadan(Number(e.target.value))}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Tarif RS */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Tarif Rumah Sakit</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Tarif RS</Label>
                  <Input
                    type="number"
                    value={tarifRs || ''}
                    onChange={(e) => setTarifRs(Number(e.target.value))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tarif Prosedur</Label>
                  <Input
                    type="number"
                    value={tarifProsedur || ''}
                    onChange={(e) => setTarifProsedur(Number(e.target.value))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tarif Alkes</Label>
                  <Input
                    type="number"
                    value={tarifAlkes || ''}
                    onChange={(e) => setTarifAlkes(Number(e.target.value))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tarif Obat</Label>
                  <Input
                    type="number"
                    value={tarifObat || ''}
                    onChange={(e) => setTarifObat(Number(e.target.value))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tarif Kamar</Label>
                  <Input
                    type="number"
                    value={tarifKamar || ''}
                    onChange={(e) => setTarifKamar(Number(e.target.value))}
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Tarif Lainnya</Label>
                  <Input
                    type="number"
                    value={tarifLainnya || ''}
                    onChange={(e) => setTarifLainnya(Number(e.target.value))}
                    placeholder="0"
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Actions */}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => navigate('/eklaim')}>
                Batal
              </Button>
              <Button type="submit" disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Buat E-Klaim
              </Button>
            </div>
          </form>
      </div>
    </div>
  );
}
