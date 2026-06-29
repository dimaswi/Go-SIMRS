import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PageShell, PageHeader, PageContent } from '@/components/layout/page-shell';
import { patientsApi } from '@/lib/api';
import type { Patient } from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { setPageTitle } from '@/lib/page-title';
import {
  ArrowLeft,
  Loader2,
  Pencil,
  Trash2,
  User,
  MapPin,
  Phone,
  Users,
  Shield,
  Heart,
  CheckCircle,
  XCircle,
  Smartphone,
} from 'lucide-react';
import { format, parseISO, differenceInYears } from 'date-fns';
import { id } from 'date-fns/locale';
import { formatPatientName } from '@/lib/print-utils';

export default function PatientShow() {
  const navigate = useNavigate();
  const { id: patientId } = useParams();
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [unfinalizing, setUnfinalizing] = useState(false);

  useEffect(() => {
    setPageTitle('Detail Pasien');
    loadPatient();
  }, [patientId]);

  const loadPatient = async () => {
    try {
      const response = await patientsApi.getById(Number(patientId));
      setPatient(response.data);
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data pasien.",
      });
      navigate('/patients');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteDialogOpen(true);
  };

  const handleFinalize = async () => {
    if (!patientId) return;
    setFinalizing(true);
    try {
      await patientsApi.finalize(Number(patientId));
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Data pasien berhasil difinalisasi.",
      });
      loadPatient();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal memfinalisasi data pasien.",
      });
    } finally {
      setFinalizing(false);
    }
  };

  const handleUnfinalize = async () => {
    if (!patientId) return;
    setUnfinalizing(true);
    try {
      await patientsApi.unfinalize(Number(patientId));
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Finalisasi data pasien berhasil dibuka.",
      });
      loadPatient();
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal membuka finalisasi data pasien.",
      });
    } finally {
      setUnfinalizing(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteDialogOpen(false);
    try {
      await patientsApi.delete(Number(patientId));
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Data pasien berhasil dihapus.",
      });
      setTimeout(() => navigate('/patients'), 500);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus data pasien.",
      });
      setDeleting(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return format(parseISO(dateString), 'dd MMMM yyyy', { locale: id });
    } catch {
      return '-';
    }
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      return format(parseISO(dateString), 'dd MMMM yyyy HH:mm', { locale: id });
    } catch {
      return '-';
    }
  };

  const calculateAge = (birthDate?: string) => {
    if (!birthDate) return '-';
    try {
      const age = differenceInYears(new Date(), parseISO(birthDate));
      return `${age} tahun`;
    } catch {
      return '-';
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'Aktif':
        return 'default';
      case 'Tidak Aktif':
        return 'secondary';
      case 'Meninggal':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-lg font-semibold">Pasien tidak ditemukan</p>
          <Button onClick={() => navigate('/patients')} className="mt-4">
            Kembali ke Daftar Pasien
          </Button>
        </div>
      </div>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title={formatPatientName(patient.nama_lengkap, patient.jenis_kelamin, patient.status_perkawinan, patient.tanggal_lahir)}
        description={`No. RM: ${patient.no_rm} • ${patient.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'} • ${calculateAge(patient.tanggal_lahir)}`}
        icon={User}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.history.back()}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Kembali
            </Button>
            {/* Tombol Finalisasi */}
            {!patient.is_final && hasPermission('patients.finalize') && (
              <Button
                variant="default"
                size="sm"
                onClick={handleFinalize}
                disabled={finalizing}
              >
                {finalizing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                Finalisasi
              </Button>
            )}
            {/* Tombol Buka Finalisasi */}
            {patient.is_final && hasPermission('patients.finalize') && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleUnfinalize}
                disabled={unfinalizing}
              >
                {unfinalizing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="mr-2 h-4 w-4" />
                )}
                Buka Finalisasi
              </Button>
            )}
            {hasPermission('patients.update') && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/patients/${patientId}/edit`)}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit
              </Button>
            )}
            {hasPermission('patients.delete') && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Hapus
              </Button>
            )}
          </div>
        }
      >
        <div className="flex items-center gap-2 pb-4">
          {patient.registration_source === 'mjkn' && (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 gap-1">
              <Smartphone className="h-3 w-3" />
              Mobile JKN
            </Badge>
          )}
          {patient.is_final ? (
            <Badge variant="default" className="bg-green-600">
              <CheckCircle className="mr-1 h-3 w-3" />
              Final
            </Badge>
          ) : (
            <Badge variant="secondary">
              <XCircle className="mr-1 h-3 w-3" />
              Belum Final
            </Badge>
          )}
          <Badge variant={getStatusVariant(patient.status)}>
            {patient.status}
          </Badge>
        </div>
      </PageHeader>

      <PageContent>
        <div className="mx-auto w-full max-w-full flex-1 space-y-6 pb-6">
          {/* Identitas Pasien */}
          <div className="border border-border/70 bg-background">
            <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
              <User className="h-3 w-3" />
              IDENTITAS PASIEN
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                <div>
                  <label className="text-xs text-muted-foreground">NIK</label>
                  <p className="font-medium text-sm mt-1">{patient.nik || '-'}</p>
                </div>
                <div className="sm:col-span-2 lg:col-span-2">
                  <label className="text-xs text-muted-foreground">Nama Lengkap</label>
                  <p className="font-medium text-sm mt-1">{formatPatientName(patient.nama_lengkap, patient.jenis_kelamin, patient.status_perkawinan, patient.tanggal_lahir)}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Nama Panggilan</label>
                  <p className="font-medium text-sm mt-1">{patient.nama_panggilan || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Jenis Kelamin</label>
                  <p className="font-medium text-sm mt-1">{patient.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</p>
                </div>
                <div className="sm:col-span-2 lg:col-span-2">
                  <label className="text-xs text-muted-foreground">Tempat, Tanggal Lahir</label>
                  <p className="font-medium text-sm mt-1">{patient.tempat_lahir || '-'}, {formatDate(patient.tanggal_lahir)}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Umur</label>
                  <p className="font-medium text-sm mt-1">{calculateAge(patient.tanggal_lahir)}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Golongan Darah</label>
                  <p className="font-medium text-sm mt-1">{patient.golongan_darah || '-'} {patient.rhesus ? `(${patient.rhesus})` : ''}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Agama</label>
                  <p className="font-medium text-sm mt-1">{patient.agama || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Status Perkawinan</label>
                  <p className="font-medium text-sm mt-1">{patient.status_perkawinan || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Pendidikan</label>
                  <p className="font-medium text-sm mt-1">{patient.pendidikan_terakhir || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Pekerjaan</label>
                  <p className="font-medium text-sm mt-1">{patient.pekerjaan || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Kewarganegaraan</label>
                  <p className="font-medium text-sm mt-1">{patient.kewarganegaraan || 'WNI'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Alamat */}
          <div className="border border-border/70 bg-background">
            <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
              <MapPin className="h-3 w-3" />
              ALAMAT
            </div>
            <div className="p-3 sm:p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-xs font-semibold mb-3">Alamat KTP</h4>
                  <p className="text-sm">{patient.alamat_ktp || '-'}</p>
                  <p className="text-sm text-muted-foreground">
                    RT/RW: {patient.rt_ktp || '-'}/{patient.rw_ktp || '-'},
                    Kel. {patient.kelurahan_ktp || '-'},
                    Kec. {patient.kecamatan_ktp || '-'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {patient.kota_ktp || '-'}, {patient.provinsi_ktp || '-'} {patient.kode_pos_ktp || ''}
                  </p>
                </div>
                <div>
                  <h4 className="text-xs font-semibold mb-3">Alamat Domisili</h4>
                  <p className="text-sm">{patient.alamat_domisili || patient.alamat_ktp || '-'}</p>
                  <p className="text-sm text-muted-foreground">
                    RT/RW: {patient.rt_domisili || patient.rt_ktp || '-'}/{patient.rw_domisili || patient.rw_ktp || '-'},
                    Kel. {patient.kelurahan_domisili || patient.kelurahan_ktp || '-'},
                    Kec. {patient.kecamatan_domisili || patient.kecamatan_ktp || '-'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {patient.kota_domisili || patient.kota_ktp || '-'}, {patient.provinsi_domisili || patient.provinsi_ktp || '-'} {patient.kode_pos_domisili || patient.kode_pos_ktp || ''}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Kontak */}
          <div className="border border-border/70 bg-background">
            <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
              <Phone className="h-3 w-3" />
              KONTAK
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className="text-xs text-muted-foreground">No. Telepon</label>
                  <p className="font-medium text-sm mt-1">{patient.no_telepon || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">No. HP</label>
                  <p className="font-medium text-sm mt-1">{patient.no_hp || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">No. HP Alternatif</label>
                  <p className="font-medium text-sm mt-1">{patient.no_hp_alternatif || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Email</label>
                  <p className="font-medium text-sm mt-1">{patient.email || '-'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Penanggung Jawab */}
          <div className="border border-border/70 bg-background">
            <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
              <Users className="h-3 w-3" />
              PENANGGUNG JAWAB
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className="text-xs text-muted-foreground">Nama</label>
                  <p className="font-medium text-sm mt-1">{patient.nama_penanggung_jawab || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Hubungan</label>
                  <p className="font-medium text-sm mt-1">{patient.hubungan_penanggung_jawab || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">NIK</label>
                  <p className="font-medium text-sm mt-1">{patient.nik_penanggung_jawab || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Telepon</label>
                  <p className="font-medium text-sm mt-1">{patient.telepon_penanggung_jawab || '-'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Jaminan */}
          <div className="border border-border/70 bg-background">
            <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
              <Shield className="h-3 w-3" />
              JAMINAN KESEHATAN
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className="text-xs text-muted-foreground">Jenis Jaminan</label>
                  <p className="font-medium text-sm mt-1">
                    <Badge variant="outline">{patient.jenis_jaminan}</Badge>
                  </p>
                </div>
                {(patient.jenis_jaminan === 'BPJS' || patient.jenis_jaminan === 'JKN') && (
                  <>
                    <div>
                      <label className="text-xs text-muted-foreground">No. BPJS</label>
                      <p className="font-medium text-sm mt-1">{patient.no_bpjs || '-'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Kelas BPJS</label>
                      <p className="font-medium text-sm mt-1">Kelas {patient.kelas_bpjs || '-'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Faskes Tingkat 1</label>
                      <p className="font-medium text-sm mt-1">{patient.faskes_tingkat_1 || '-'}</p>
                    </div>
                  </>
                )}
                {patient.jenis_jaminan === 'Asuransi Swasta' && (
                  <>
                    <div>
                      <label className="text-xs text-muted-foreground">Nama Asuransi</label>
                      <p className="font-medium text-sm mt-1">{patient.nama_asuransi || '-'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">No. Polis</label>
                      <p className="font-medium text-sm mt-1">{patient.no_polis_asuransi || '-'}</p>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Masa Berlaku</label>
                      <p className="font-medium text-sm mt-1">{formatDate(patient.masa_berlaku_asuransi)}</p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Riwayat Medis */}
          <div className="border border-border/70 bg-background">
            <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-2">
              <Heart className="h-3 w-3" />
              RIWAYAT MEDIS PENTING
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className="text-xs text-muted-foreground">Alergi Obat</label>
                  <p className="font-medium text-sm mt-1">{patient.alergi_obat || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Alergi Makanan</label>
                  <p className="font-medium text-sm mt-1">{patient.alergi_makanan || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Alergi Lainnya</label>
                  <p className="font-medium text-sm mt-1">{patient.alergi_lainnya || '-'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Penyakit Kronis</label>
                  <p className="font-medium text-sm mt-1">{patient.penyakit_kronis || '-'}</p>
                </div>
                <div className="sm:col-span-2 lg:col-span-2">
                  <label className="text-xs text-muted-foreground">Riwayat Operasi</label>
                  <p className="font-medium text-sm mt-1">{patient.riwayat_operasi || '-'}</p>
                </div>
                <div className="sm:col-span-2 lg:col-span-2">
                  <label className="text-xs text-muted-foreground">Obat Rutin</label>
                  <p className="font-medium text-sm mt-1">{patient.obat_rutin || '-'}</p>
                </div>
                <div className="sm:col-span-2 lg:col-span-2">
                  <label className="text-xs text-muted-foreground">Disabilitas</label>
                  <p className="font-medium text-sm mt-1">{patient.disabilitas || '-'}</p>
                </div>
                <div className="sm:col-span-2 lg:col-span-2">
                  <label className="text-xs text-muted-foreground">Catatan Khusus</label>
                  <p className="font-medium text-sm mt-1">{patient.catatan_khusus || '-'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Informasi Sistem */}
          <div className="border border-border/70 bg-background">
            <div className="border-b border-border/70 bg-muted/30 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              INFORMASI SISTEM
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className="text-xs text-muted-foreground">ID Pasien</label>
                  <p className="font-medium text-sm mt-1">#{patient.id}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Tanggal Registrasi</label>
                  <p className="font-medium text-sm mt-1">{formatDateTime(patient.tanggal_registrasi)}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Kunjungan Terakhir</label>
                  <p className="font-medium text-sm mt-1">{formatDateTime(patient.tanggal_kunjungan_terakhir)}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Terakhir Diperbarui</label>
                  <p className="font-medium text-sm mt-1">{formatDateTime(patient.updated_at)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </PageContent>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Hapus Data Pasien"
        description={`Apakah Anda yakin ingin menghapus data pasien "${patient.nama_lengkap}" (${patient.no_rm})? Tindakan ini tidak dapat dibatalkan.`}
        confirmText="Hapus"
        cancelText="Batal"
        variant="destructive"
      />
    </PageShell>
  );
}


