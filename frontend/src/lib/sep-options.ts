// SEP Options - konstanta untuk dropdown di form SEP BPJS
// Sesuai dengan backend models/sep.go

export interface SEPOptionItem {
  kode: string;
  nama: string;
}

export const SEP_OPTIONS = {
  // Jenis Pelayanan
  jenisPelayanan: [
    { kode: "1", nama: "Rawat Inap" },
    { kode: "2", nama: "Rawat Jalan" },
  ] as SEPOptionItem[],

  // Kelas Rawat
  kelasRawat: [
    { kode: "1", nama: "Kelas 1" },
    { kode: "2", nama: "Kelas 2" },
    { kode: "3", nama: "Kelas 3" },
  ] as SEPOptionItem[],

  // Kelas Rawat Naik
  kelasRawatNaik: [
    { kode: "", nama: "- Tidak Naik Kelas -" },
    { kode: "1", nama: "VVIP" },
    { kode: "2", nama: "VIP" },
    { kode: "3", nama: "Kelas 1" },
    { kode: "4", nama: "Kelas 2" },
    { kode: "5", nama: "Kelas 3" },
    { kode: "6", nama: "ICCU" },
    { kode: "7", nama: "ICU" },
    { kode: "8", nama: "Diatas Kelas 1" },
  ] as SEPOptionItem[],

  // Pembiayaan Naik Kelas
  pembiayaanNaikKelas: [
    { kode: "", nama: "- Tidak Ada -" },
    { kode: "1", nama: "Pribadi" },
    { kode: "2", nama: "Pemberi Kerja" },
    { kode: "3", nama: "Asuransi Kesehatan Tambahan" },
  ] as SEPOptionItem[],

  // Asal Rujukan
  asalRujukan: [
    { kode: "1", nama: "Faskes 1 (Puskesmas/Klinik)" },
    { kode: "2", nama: "Faskes 2 (Rumah Sakit)" },
  ] as SEPOptionItem[],

  // Laka Lantas (Kecelakaan Lalu Lintas)
  lakaLantas: [
    { kode: "0", nama: "Bukan Kecelakaan Lalu Lintas (BKLL)" },
    { kode: "1", nama: "KLL dan Bukan Kecelakaan Kerja (BKK)" },
    { kode: "2", nama: "KLL dan Kecelakaan Kerja (KK)" },
    { kode: "3", nama: "Kecelakaan Kerja (KK)" },
  ] as SEPOptionItem[],

  // Tujuan Kunjungan
  tujuanKunjungan: [
    { kode: "0", nama: "Normal" },
    { kode: "1", nama: "Prosedur" },
    { kode: "2", nama: "Konsul Dokter" },
  ] as SEPOptionItem[],

  // Flag Procedure
  flagProcedure: [
    { kode: "", nama: "- Tidak Ada -" },
    { kode: "0", nama: "Prosedur Tidak Berkelanjutan" },
    { kode: "1", nama: "Prosedur dan Terapi Berkelanjutan" },
  ] as SEPOptionItem[],

  // Kode Penunjang
  kdPenunjang: [
    { kode: "", nama: "- Tidak Ada -" },
    { kode: "1", nama: "Radioterapi" },
    { kode: "2", nama: "Kemoterapi" },
    { kode: "3", nama: "Rehabilitasi Medik" },
    { kode: "4", nama: "Rehabilitasi Psikososial" },
    { kode: "5", nama: "Transfusi Darah" },
    { kode: "6", nama: "Pelayanan Gigi" },
    { kode: "7", nama: "Laboratorium" },
    { kode: "8", nama: "USG" },
    { kode: "9", nama: "Farmasi" },
    { kode: "10", nama: "Lain-Lain" },
    { kode: "11", nama: "MRI" },
    { kode: "12", nama: "Hemodialisa" },
  ] as SEPOptionItem[],

  // Assessment Pelayanan
  assesmentPelayanan: [
    { kode: "", nama: "- Tidak Ada -" },
    { kode: "1", nama: "Poli spesialis tidak tersedia pada hari sebelumnya" },
    { kode: "2", nama: "Jam Poli telah berakhir pada hari sebelumnya" },
    { kode: "3", nama: "Dokter Spesialis yang dimaksud tidak praktek pada hari sebelumnya" },
    { kode: "4", nama: "Atas Instruksi RS" },
    { kode: "5", nama: "Tujuan Kontrol" },
  ] as SEPOptionItem[],

  // Ya/Tidak
  yaTidak: [
    { kode: "0", nama: "Tidak" },
    { kode: "1", nama: "Ya" },
  ] as SEPOptionItem[],
};

// Helper functions
export function getOptionLabel(options: SEPOptionItem[], kode: string): string {
  const found = options.find((opt) => opt.kode === kode);
  return found ? found.nama : kode;
}

export function getJenisPelayananLabel(kode: string): string {
  return getOptionLabel(SEP_OPTIONS.jenisPelayanan, kode);
}

export function getKelasRawatLabel(kode: string): string {
  return getOptionLabel(SEP_OPTIONS.kelasRawat, kode);
}

export function getLakaLantasLabel(kode: string): string {
  return getOptionLabel(SEP_OPTIONS.lakaLantas, kode);
}

export function getTujuanKunjunganLabel(kode: string): string {
  return getOptionLabel(SEP_OPTIONS.tujuanKunjungan, kode);
}

export function getAsalRujukanLabel(kode: string): string {
  return getOptionLabel(SEP_OPTIONS.asalRujukan, kode);
}
