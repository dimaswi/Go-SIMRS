import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { employeesApi, masterDataApi, type Employee, type MasterData } from '@/lib/api';
import { usePermission } from '@/hooks/usePermission';
import { useToast } from '@/hooks/use-toast';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { 
  ArrowLeft, 
  Loader2, 
  Pencil, 
  Trash2
} from 'lucide-react';
import { setPageTitle } from '@/lib/page-title';

function formatDate(dateString?: string) {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

// Medical staff types for showing STR/SIP fields
const MEDICAL_STAFF_CODES = ["dokter", "perawat", "bidan", "apoteker", "asisten_apoteker", "radiografer", "analis_kesehatan"];

export default function EmployeeShow() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { toast } = useToast();
  const { hasPermission } = usePermission();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [masterData, setMasterData] = useState<Record<string, MasterData[]>>({});

  useEffect(() => {
    setPageTitle('Detail Pegawai');
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      const [employeeRes, masterDataRes] = await Promise.all([
        employeesApi.getById(Number(id)),
        masterDataApi.getMultiple([
          'gender',
          'religion',
          'marital_status',
          'education_level',
          'employee_type',
          'employment_status',
          'relationship',
          'bank',
        ])
      ]);
      setEmployee(employeeRes.data.data);
      setMasterData(masterDataRes.data.data || {});
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: "Gagal memuat data pegawai.",
      });
    } finally {
      setLoading(false);
    }
  };

  // Helper function to get name from code
  const getMasterDataName = (category: string, code?: string): string => {
    if (!code) return '-';
    const items = masterData[category];
    if (!items) return code;
    const item = items.find(i => i.code === code);
    return item?.name || code;
  };

  const handleDelete = async () => {
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setDeleteDialogOpen(false);
    try {
      await employeesApi.delete(parseInt(id!));
      toast({
        variant: "success",
        title: "Berhasil!",
        description: "Pegawai berhasil dihapus.",
      });
      setTimeout(() => navigate('/employees'), 500);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error!",
        description: error.response?.data?.error || "Gagal menghapus pegawai.",
      });
      setDeleting(false);
    }
  };

  const isMedicalStaff = employee && MEDICAL_STAFF_CODES.includes(employee.tipe_karyawan);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-lg font-semibold">Pegawai tidak ditemukan</p>
          <Button onClick={() => navigate('/employees')} className="mt-4">
            Kembali ke Daftar Pegawai
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
          <div className="space-y-1">
            <h1 className="text-lg font-semibold">
              {employee.nama_lengkap}
            </h1>
            <p className="text-sm text-muted-foreground">
              {employee.nip || employee.nik} â€¢ {getMasterDataName('employee_type', employee.tipe_karyawan)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={employee.is_active ? "default" : "secondary"}>
            {employee.is_active ? 'Aktif' : 'Tidak Aktif'}
          </Badge>
          {hasPermission('employees.update') && (
            <Button 
              variant="outline"
              size="sm"
              onClick={() => navigate(`/employees/${id}/edit`)}
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
          {hasPermission('employees.delete') && (
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
          {/* Data Pribadi */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">DATA PRIBADI</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div>
                <label className="text-xs text-muted-foreground">Nama Lengkap</label>
                <p className="font-medium text-sm">{employee.nama_lengkap}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">NIK</label>
                <p className="font-medium text-sm">{employee.nik}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">NIP</label>
                <p className="font-medium text-sm">{employee.nip || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Tempat, Tanggal Lahir</label>
                <p className="font-medium text-sm">
                  {employee.tempat_lahir || '-'}, {formatDate(employee.tanggal_lahir)}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Jenis Kelamin</label>
                <p className="font-medium text-sm">
                  {getMasterDataName('gender', employee.jenis_kelamin)}
                </p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Agama</label>
                <p className="font-medium text-sm">{getMasterDataName('religion', employee.agama)}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Status Perkawinan</label>
                <p className="font-medium text-sm">{getMasterDataName('marital_status', employee.status_perkawinan)}</p>
              </div>
            </div>
          </div>

          <hr className="border-border/50 my-6" />

          {/* Kontak */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">KONTAK</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div>
                <label className="text-xs text-muted-foreground">No. Telepon</label>
                <p className="font-medium text-sm">{employee.no_telepon || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">No. HP</label>
                <p className="font-medium text-sm">{employee.no_hp || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Email</label>
                <p className="font-medium text-sm">{employee.email || '-'}</p>
              </div>
              <div className="md:col-span-2 lg:col-span-4">
                <label className="text-xs text-muted-foreground">Alamat</label>
                <p className="font-medium text-sm">
                  {employee.alamat || '-'}
                  {employee.kota && `, ${employee.kota}`}
                  {employee.provinsi && `, ${employee.provinsi}`}
                  {employee.kode_pos && ` ${employee.kode_pos}`}
                </p>
              </div>
            </div>
          </div>

          <hr className="border-border/50 my-6" />

          {/* Data Kepegawaian */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">DATA KEPEGAWAIAN</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
              <div>
                <label className="text-xs text-muted-foreground">Tipe Karyawan</label>
                <p className="font-medium text-sm">{getMasterDataName('employee_type', employee.tipe_karyawan)}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Status Kepegawaian</label>
                <Badge variant="outline" className="mt-1">{getMasterDataName('employment_status', employee.status_kepegawaian)}</Badge>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Departemen</label>
                <p className="font-medium text-sm">{employee.departemen || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Jabatan</label>
                <p className="font-medium text-sm">{employee.jabatan || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Tanggal Masuk</label>
                <p className="font-medium text-sm">{formatDate(employee.tanggal_masuk)}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Tanggal Keluar</label>
                <p className="font-medium text-sm">{formatDate(employee.tanggal_keluar)}</p>
              </div>
              {employee.spesialisasi && (
                <div>
                  <label className="text-xs text-muted-foreground">Spesialisasi</label>
                  <p className="font-medium text-sm">{employee.spesialisasi}</p>
                </div>
              )}
            </div>
          </div>

          {/* Surat Izin Praktik (Medical Staff) */}
          {isMedicalStaff && (
            <>
              <hr className="border-border/50 my-6" />
              <div className="mb-6">
                <h3 className="text-sm font-medium text-muted-foreground mb-4">SURAT IZIN PRAKTIK</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  <div>
                    <label className="text-xs text-muted-foreground">No. STR</label>
                    <p className="font-medium text-sm">{employee.no_str || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Tanggal STR</label>
                    <p className="font-medium text-sm">{formatDate(employee.tanggal_str)}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Masa Berlaku STR</label>
                    <p className="font-medium text-sm">{formatDate(employee.masa_berlaku_str)}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">No. SIP</label>
                    <p className="font-medium text-sm">{employee.no_sip || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Tanggal SIP</label>
                    <p className="font-medium text-sm">{formatDate(employee.tanggal_sip)}</p>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Masa Berlaku SIP</label>
                    <p className="font-medium text-sm">{formatDate(employee.masa_berlaku_sip)}</p>
                  </div>
                </div>
              </div>
            </>
          )}

          <hr className="border-border/50 my-6" />

          {/* Pendidikan */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">PENDIDIKAN</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="text-xs text-muted-foreground">Pendidikan Terakhir</label>
                <p className="font-medium text-sm">{getMasterDataName('education_level', employee.pendidikan_terakhir)}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Nama Institusi</label>
                <p className="font-medium text-sm">{employee.nama_institusi || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Tahun Lulus</label>
                <p className="font-medium text-sm">{employee.tahun_lulus || '-'}</p>
              </div>
            </div>
          </div>

          <hr className="border-border/50 my-6" />

          {/* Informasi Bank */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">INFORMASI BANK</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="text-xs text-muted-foreground">Nama Bank</label>
                <p className="font-medium text-sm">{getMasterDataName('bank', employee.nama_bank)}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">No. Rekening</label>
                <p className="font-medium text-sm">{employee.no_rekening || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Atas Nama</label>
                <p className="font-medium text-sm">{employee.atas_nama_rekening || '-'}</p>
              </div>
            </div>
          </div>

          <hr className="border-border/50 my-6" />

          {/* Kontak Darurat */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-muted-foreground mb-4">KONTAK DARURAT</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className="text-xs text-muted-foreground">Nama</label>
                <p className="font-medium text-sm">{employee.nama_kontak_darurat || '-'}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Hubungan</label>
                <p className="font-medium text-sm">{getMasterDataName('relationship', employee.hubungan_kontak_darurat)}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">No. Telepon</label>
                <p className="font-medium text-sm">{employee.telepon_kontak_darurat || '-'}</p>
              </div>
            </div>
          </div>

          <hr className="border-border/50 my-6" />

          {/* Informasi Sistem */}
          <div>
            <h3 className="text-sm font-medium text-muted-foreground mb-4">INFORMASI SISTEM</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="text-xs text-muted-foreground">Dibuat</label>
                <p className="font-medium text-sm">{formatDate(employee.created_at)}</p>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Terakhir Diperbarui</label>
                <p className="font-medium text-sm">{formatDate(employee.updated_at)}</p>
              </div>
            </div>
          </div>
      </div>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete}
        title="Hapus Pegawai"
        description="Apakah Anda yakin ingin menghapus pegawai ini? Tindakan ini tidak dapat dibatalkan."
        confirmText="Hapus"
        cancelText="Batal"
        variant="destructive"
      />
    </div>
  );
}
