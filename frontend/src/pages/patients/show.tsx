import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
    <div className="flex flex-1 flex-col p-4">
      <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => window.history.back()}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  {patient.foto ? (
                    <img 
                      src={`/${patient.foto}`} 
                      alt={patient.nama_lengkap}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <User className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-semibold">
                      {formatPatientName(patient.nama_lengkap, patient.jenis_kelamin, patient.status_perkawinan, patient.tanggal_lahir)}
                    </h1>
                    {patient.registration_source === 'mjkn' && (
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800 gap-1">
                        <Smartphone className="h-3 w-3" />
                        Mobile JKN
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    No. RM: {patient.no_rm} â€¢ {patient.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'} â€¢ {calculateAge(patient.tanggal_lahir)}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
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
      </div>
      <div className="rounded-lg border p-6">
          {/* Identitas Pasien */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
              <User className="h-4 w-4" />
              IDENTITAS PASIEN
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div>
                <label className="text-xs text-muted-foreground">NIK</label>
                <p className="font-medium text-sm">{patient.nik || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Nama Lengkap</label>
                <p className="font-medium text-sm">{formatPatientName(patient.nama_lengkap, patient.jenis_kelamin, patient.status_perkawinan, patient.tanggal_lahir)}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Nama Panggilan</label>
                <p className="font-medium text-sm">{patient.nama_panggilan || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Jenis Kelamin</label>
                <p className="font-medium text-sm">{patient.jenis_kelamin === 'L' ? 'Laki-laki' : 'Perempuan'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Tempat, Tanggal Lahir</label>
                <p className="font-medium text-sm">{patient.tempat_lahir || '-'}, {formatDate(patient.tanggal_lahir)}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Umur</label>
                <p className="font-medium text-sm">{calculateAge(patient.tanggal_lahir)}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Golongan Darah</label>
                <p className="font-medium text-sm">{patient.golongan_darah || '-'} ({patient.rhesus || '-'})</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Agama</label>
                <p className="font-medium text-sm">{patient.agama || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Status Perkawinan</label>
                <p className="font-medium text-sm">{patient.status_perkawinan || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Pendidikan</label>
                <p className="font-medium text-sm">{patient.pendidikan_terakhir || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Pekerjaan</label>
                <p className="font-medium text-sm">{patient.pekerjaan || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Kewarganegaraan</label>
                <p className="font-medium text-sm">{patient.kewarganegaraan || 'WNI'}</p>
              </div>
            </div>
          </div>

          <hr className="border-border/50 my-6" />

          {/* Alamat */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              ALAMAT
            </h3>
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

          <hr className="border-border/50 my-6" />

          {/* Kontak */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
              <Phone className="h-4 w-4" />
              KONTAK
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div>
                <label className="text-xs text-muted-foreground">No. Telepon</label>
                <p className="font-medium text-sm">{patient.no_telepon || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">No. HP</label>
                <p className="font-medium text-sm">{patient.no_hp || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">No. HP Alternatif</label>
                <p className="font-medium text-sm">{patient.no_hp_alternatif || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Email</label>
                <p className="font-medium text-sm">{patient.email || '-'}</p>
              </div>
            </div>
          </div>

          <hr className="border-border/50 my-6" />

          {/* Penanggung Jawab */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
              <Users className="h-4 w-4" />
              PENANGGUNG JAWAB
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div>
                <label className="text-xs text-muted-foreground">Nama</label>
                <p className="font-medium text-sm">{patient.nama_penanggung_jawab || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Hubungan</label>
                <p className="font-medium text-sm">{patient.hubungan_penanggung_jawab || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">NIK</label>
                <p className="font-medium text-sm">{patient.nik_penanggung_jawab || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Telepon</label>
                <p className="font-medium text-sm">{patient.telepon_penanggung_jawab || '-'}</p>
              </div>
            </div>
          </div>

          <hr className="border-border/50 my-6" />

          {/* Jaminan */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
              <Shield className="h-4 w-4" />
              JAMINAN KESEHATAN
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div>
                <label className="text-xs text-muted-foreground">Jenis Jaminan</label>
                <p className="font-medium text-sm">
                  <Badge variant="outline">{patient.jenis_jaminan}</Badge>
                </p>
              </div>
              {(patient.jenis_jaminan === 'BPJS' || patient.jenis_jaminan === 'JKN') && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground">No. BPJS</label>
                    <p className="font-medium text-sm">{patient.no_bpjs || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Kelas BPJS</label>
                    <p className="font-medium text-sm">Kelas {patient.kelas_bpjs || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Faskes Tingkat 1</label>
                    <p className="font-medium text-sm">{patient.faskes_tingkat_1 || '-'}</p>
                  </div>
                </>
              )}
              {patient.jenis_jaminan === 'Asuransi Swasta' && (
                <>
                  <div>
                    <label className="text-xs text-muted-foreground">Nama Asuransi</label>
                    <p className="font-medium text-sm">{patient.nama_asuransi || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">No. Polis</label>
                    <p className="font-medium text-sm">{patient.no_polis_asuransi || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Masa Berlaku</label>
                    <p className="font-medium text-sm">{formatDate(patient.masa_berlaku_asuransi)}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          <hr className="border-border/50 my-6" />

          {/* Riwayat Medis */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4 flex items-center gap-2">
              <Heart className="h-4 w-4" />
              RIWAYAT MEDIS PENTING
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-xs text-muted-foreground">Alergi Obat</label>
                <p className="font-medium text-sm">{patient.alergi_obat || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Alergi Makanan</label>
                <p className="font-medium text-sm">{patient.alergi_makanan || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Alergi Lainnya</label>
                <p className="font-medium text-sm">{patient.alergi_lainnya || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Penyakit Kronis</label>
                <p className="font-medium text-sm">{patient.penyakit_kronis || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Riwayat Operasi</label>
                <p className="font-medium text-sm">{patient.riwayat_operasi || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Obat Rutin</label>
                <p className="font-medium text-sm">{patient.obat_rutin || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Disabilitas</label>
                <p className="font-medium text-sm">{patient.disabilitas || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Catatan Khusus</label>
                <p className="font-medium text-sm">{patient.catatan_khusus || '-'}</p>
              </div>
            </div>
          </div>

          <hr className="border-border/50 my-6" />

          {/* Informasi Sistem */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-4">INFORMASI SISTEM</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
              <div>
                <label className="text-xs text-muted-foreground">ID Pasien</label>
                <p className="font-medium text-sm">#{patient.id}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Tanggal Registrasi</label>
                <p className="font-medium text-sm">{formatDateTime(patient.tanggal_registrasi)}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Kunjungan Terakhir</label>
                <p className="font-medium text-sm">{formatDateTime(patient.tanggal_kunjungan_terakhir)}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Terakhir Diperbarui</label>
                <p className="font-medium text-sm">{formatDateTime(patient.updated_at)}</p>
              </div>
            </div>
          </div>
      </div>

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
    </div>
  );
}
