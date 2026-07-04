import type { LucideIcon } from "lucide-react";
import {
  TrendingUp,
  Building2,
  DollarSign,
  HeartPulse,
  Pill,
  FlaskConical,
  Boxes,
  UserCheck,
  Landmark,
} from "lucide-react";

export interface ReportCategory {
  path: string;
  title: string;
  description: string;
  icon: LucideIcon;
  count: number;
  auditFocus: string;
}

export const reportCategories: ReportCategory[] = [
  {
    path: "/reports/visits",
    title: "Kunjungan & Pasien",
    description: "Harian, mix layanan, per poli, per dokter, demografi, diagnosa, wilayah, rujukan",
    icon: TrendingUp,
    count: 10,
    auditFocus: "hitung per pendaftaran",
  },
  {
    path: "/reports/bpjs",
    title: "BPJS",
    description: "Kunjungan BPJS, SEP, Surat Kontrol, Antrean Mobile JKN, E-Klaim",
    icon: Building2,
    count: 6,
    auditFocus: "sinkron bridge BPJS",
  },
  {
    path: "/reports/billing",
    title: "Keuangan",
    description: "Pendapatan harian, metode bayar, ruangan, dokter, piutang, aging, tipe billing",
    icon: DollarSign,
    count: 7,
    auditFocus: "normalisasi sumber billing",
  },
  {
    path: "/reports/inpatient",
    title: "Rawat Inap",
    description: "Indikator BOR/ALOS/BTO/TOI, sensus, daftar pasien, cara bayar, per ruangan",
    icon: HeartPulse,
    count: 5,
    auditFocus: "validasi okupansi dan sensus",
  },
  {
    path: "/reports/pharmacy",
    title: "Farmasi",
    description: "Resep harian, mix resep, obat terbanyak, per dokter, per depo, waktu tunggu",
    icon: Pill,
    count: 6,
    auditFocus: "akurasi transaksi resep",
  },
  {
    path: "/reports/penunjang",
    title: "Penunjang",
    description: "Order harian, mix order, pemeriksaan terbanyak, hasil kritis, TAT",
    icon: FlaskConical,
    count: 6,
    auditFocus: "order dan turnaround time",
  },
  {
    path: "/reports/services",
    title: "Layanan",
    description: "Volume tindakan, cara bayar, kelas pasien, pasien operasi, jadwal operasi",
    icon: HeartPulse,
    count: 6,
    auditFocus: "volume tindakan dan jadwal operasi",
  },
  {
    path: "/reports/inventory",
    title: "Inventaris & Stok",
    description: "Stok obat, obat kadaluarsa, stok inventaris, mutasi stok",
    icon: Boxes,
    count: 4,
    auditFocus: "stok aktual dan mutasi",
  },
  {
    path: "/reports/hr",
    title: "SDM",
    description: "Rekap pegawai, daftar dokter, spesialisasi, STR/SIP, beban kerja dokter",
    icon: UserCheck,
    count: 5,
    auditFocus: "masa berlaku dan workload",
  },
  {
    path: "/reports/kemenkes",
    title: "Kemenkes / RL",
    description: "Indikator mutu, RL 1.2 TT, ringkasan TT, RL 3.1, RL 3.2, RL 4A, RL 5.1",
    icon: Landmark,
    count: 7,
    auditFocus: "mapping RL dan istilah user-facing",
  },
];

export const reportPriorityNotes = [
  {
    title: "Kualitas data dulu",
    description: "Laporan harus mengambil data dari query SIMRS yang sama dengan transaksi operasional, bukan dari kalkulasi lepas yang bisa meleset.",
  },
  {
    title: "Per pendaftaran",
    description: "Untuk kunjungan, cara bayar, poli, dokter, dan demografi sebaiknya dihitung dari entri pendaftaran yang valid.",
  },
  {
    title: "Sinkron BPJS",
    description: "Laporan BPJS perlu membaca SEP, surat kontrol, dan antrean dari sumber yang sudah dipakai modul BPJS dan Antrol.",
  },
];

export const reportQuickStats = [
  { label: "Kategori", value: String(reportCategories.length), hint: "modul laporan aktif" },
  { label: "Fokus audit", value: "3", hint: "kunjungan, BPJS, Kemenkes" },
  { label: "Jalur ekspor", value: "Excel", hint: "disiapkan per modul" },
];
