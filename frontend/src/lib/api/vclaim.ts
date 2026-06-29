import { api } from './client';

// ==================== VClaim Types ====================

// Peserta BPJS Response - sesuai response BPJS API
export interface VClaimPeserta {
  noKartu: string;
  nik: string;
  nama: string;
  pisa?: string; // Kode prioritas
  sex: string;
  mr?: {
    noMR?: string;
    noTelepon?: string;
  };
  noMr?: string; // Alternative field from API
  tglLahir: string;
  tglTAT: string;
  tglTMT?: string;
  tglCetakKartu?: string;
  umur?: {
    umurSekarang: string;
    umurSaatPelayanan: string;
  };
  statusPeserta: {
    kode: string;
    keterangan: string;
  };
  jenisPeserta: {
    kode: string;
    keterangan: string;
  };
  hakKelas: {
    kode: string;
    keterangan: string;
  };
  provUmum?: {
    kdProvider: string | null;
    nmProvider: string | null;
  };
  cob?: {
    noAsuransi: string | null;
    nmAsuransi: string | null;
    tglTAT: string | null;
    tglTMT: string | null;
  };
  tunggakan?: {
    status: string;
  };
  informasi?: {
    dinsos?: string | null;
    prolanisPRB?: string | null;
    noSKTM?: string | null;
    eSEP?: string | null;
  };
}

// Rujukan BPJS Response (nested structure)
export interface VClaimRujukan {
  noKunjungan: string;
  tglKunjungan: string;
  provPerujuk: {
    kode: string;
    nama: string;
  };
  diagnosa: {
    kode: string;
    nama: string;
  };
  keluhan: string;
  poliRujukan: {
    kode: string;
    nama: string;
  };
  pelayanan: {
    kode: string;
    nama: string;
  };
  peserta: VClaimPeserta;
  tglRujukanBerakhir?: string;
}

// Wrapper for rujukan response from API (has nested .rujukan field)
export interface VClaimRujukanWrapper {
  rujukan: VClaimRujukan;
  asalFaskes?: string;
}

export interface VClaimReferralLocal {
  id: number;
  no_rujukan: string;
  no_sep?: string;
  version?: string;
  tgl_rujukan?: string;
  tgl_rencana_kunjungan?: string;
  ppk_dirujuk?: string;
  nama_ppk_dirujuk?: string;
  jns_pelayanan?: string;
  catatan?: string;
  diag_rujukan?: string;
  diag_rujukan_nama?: string;
  tipe_rujukan?: string;
  poli_rujukan?: string;
  poli_rujukan_nama?: string;
  no_kartu?: string;
  nama_peserta?: string;
  status?: string;
  is_khusus?: boolean;
  khusus_id_rujukan?: string;
  khusus_diagnosa_codes?: string;
  khusus_procedure_codes?: string;
  visit_id?: number;
  registration_id?: number;
  patient_id?: number;
  sep_id?: number;
}

export interface VClaimCreateRujukanV1Request {
  no_sep: string;
  visit_id?: number;
  registration_id?: number;
  patient_id?: number;
  sep_id?: number;
  tgl_rujukan: string;
  ppk_dirujuk: string;
  jns_pelayanan: string;
  catatan?: string;
  diag_rujukan: string;
  tipe_rujukan: string;
  poli_rujukan?: string;
}

export interface VClaimCreateRujukanV2Request extends VClaimCreateRujukanV1Request {
  tgl_rencana_kunjungan: string;
}

export interface VClaimRujukanKhususRequest {
  no_rujukan: string;
  diagnosa_codes: string[];
  procedure_codes?: string[];
}

export interface VClaimDeleteRujukanKhususRequest {
  id_rujukan: string;
  no_rujukan: string;
}

// SEP Request Body
export interface VClaimSEPRequest {
  noKartu: string;
  tglSep: string; // Format: yyyy-mm-dd
  ppkPelayanan: string;
  jnsPelayanan: string; // 1=Ranap, 2=Rajal
  klsRawat: {
    klsRawatHak: string;
    klsRawatNaik: string;
    pembiayaan: string;
    penanggungJawab: string;
  };
  noMR: string;
  rujukan: {
    asalRujukan: string; // 1=FKTP, 2=FKRTL
    tglRujukan: string;
    noRujukan: string;
    ppkRujukan: string;
  };
  catatan: string;
  diagAwal: string;
  poli: {
    tujuan: string;
    eksekutif: string; // 0=Tidak, 1=Ya
  };
  cob: {
    cob: string; // 0=Tidak, 1=Ya
  };
  katarak: {
    katarak: string; // 0=Tidak, 1=Ya
  };
  jaminan: {
    lakaLantas: string; // 0=BKLL, 1=KLL&BKK, 2=KLL&KK, 3=KK
    noLP: string;
    penjamin: {
      tglKejadian: string;
      keterangan: string;
      suplesi: {
        suplesi: string; // 0=Tidak, 1=Ya
        noSepSuplesi: string;
        lokasiLaka: {
          kdPropinsi: string;
          kdKabupaten: string;
          kdKecamatan: string;
        };
      };
    };
  };
  tujuanKunj: {
    tujuan: string; // 0=Normal, 1=Prosedur, 2=Konsul
    flagProcedure: string;
    kdPenunjang: string;
    assesmentPel: string;
  };
  dpjpLayan: string;
  noTelp: string;
  user: string;
}

// SEP Response
export interface VClaimSEP {
  noSep: string;
  tglSep: string;
  peserta: {
    noKartu: string;
    nama: string;
    nik: string;
    tglLahir: string;
    jnsKelamin: string;
    hakKelas: {
      kode: string;
      keterangan: string;
    };
    jnsPeserta: {
      kode: string;
      keterangan: string;
    };
    noMr: string;
    klsRawat: {
      klsRawatHak: string;
      klsRawatNaik: string;
    };
  };
  poli: string;
  diagnosa: string;
  keluhan: string;
  penjamin: {
    tglKejadian: string;
    noLp: string;
    lakaLantas: string;
    lokasiLaka: string;
    penjamin: string;
    tglPertama: string;
  };
  catatan: string;
  jnsPelayanan: string;
  kontrol: {
    poliKontrol: string;
    tglRencanaKontrol: string;
  };
}

// Referensi Poli BPJS
export interface VClaimRefPoli {
  kode: string;
  nama: string;
}

// Referensi Dokter DPJP
export interface VClaimRefDokter {
  kode: string;
  nama: string;
}

// Referensi Diagnosa
export interface VClaimRefDiagnosa {
  kode: string;
  nama: string;
}

export interface VClaimRujukanSpesialistik {
  kode: string;
  nama: string;
  kapasitas?: string;
  jumlah_rujukan?: string;
  persentase?: string;
}

export interface VClaimRujukanSarana {
  kode: string;
  nama: string;
}

// Referensi Faskes
export interface VClaimRefFaskes {
  kode: string;
  nama: string;
}

// Referensi Propinsi
export interface VClaimRefPropinsi {
  kode: string;
  nama: string;
}

// Referensi Kabupaten
export interface VClaimRefKabupaten {
  kode: string;
  nama: string;
}

// Referensi Kecamatan
export interface VClaimRefKecamatan {
  kode: string;
  nama: string;
}

// Rencana Kontrol by SEP Response
export interface VClaimRencanaKontrolBySEP {
  noSep: string;
  tglSep: string;
  jnsPelayanan: string;
  poli: string;
  diagnosa: string;
  peserta: {
    noKartu: string;
    nama: string;
    tglLahir: string;
    kelamin: string;
    hakKelas: string;
  };
  provUmum: {
    kdProvider: string;
    nmProvider: string;
  };
  provPerujuk: {
    kdProviderPerujuk: string;
    nmProviderPerujuk: string;
    asalRujukan: string;
    noRujukan: string;
    tglRujukan: string;
  };
}

// List Rencana Kontrol / SKDP Item
export interface VClaimListRencanaKontrolItem {
  noSuratKontrol: string;
  jnsPelayanan: string;      // "Rawat Inap" / "Rawat Jalan"
  jnsKontrol: string;        // Kode jenis kontrol
  namaJnsKontrol: string;    // "Surat Kontrol"
  tglRencanaKontrol: string;
  tglTerbitKontrol: string;
  noSepAsalKontrol: string;
  poliAsal: string;
  namaPoliAsal: string;
  poliTujuan: string;
  namaPoliTujuan: string;
  tglSEP: string;
  kodeDokter: string;
  namaDokter: string;
  noKartu: string;
  nama: string;
  terbitSEP: string;         // "Belum" / "Sudah"
}

// Persetujuan SEP Item (untuk approval backdate/fingerprint)
export interface VClaimPersetujuanSEPItem {
  noKartu: string;
  nama: string;
  tglsep: string;
  jnspelayanan: string;  // "RJ" atau "RI"
  persetujuan: string;   // "Pengajuan"
  status: string;        // "Tgl.SEP Backdate"
}

// Approval SEP Request
export interface VClaimApprovalSEPRequest {
  no_kartu: string;
  tgl_sep: string;
  jns_pelayanan: string;  // "1" = Rawat Inap, "2" = Rawat Jalan
  jns_pengajuan: string;  // "1" = backdate, "2" = finger print
  keterangan: string;
}

// Surat Kontrol Detail from BPJS (response from GetSuratKontrolDetail)
export interface VClaimSuratKontrolDetail {
  noSuratKontrol: string;
  jnsKontrol?: string;
  namaJnsKontrol?: string;
  tglRencanaKontrol: string;
  tglTerbitKontrol?: string;
  noKartu: string;
  nama?: string;
  kelamin?: string;
  tglLahir?: string;
  namaDiagnosa?: string;
  poli?: {
    kode?: string;
    nama?: string;
  };
  dokter?: {
    kode?: string;
    nama?: string;
  };
  // API returns these fields directly instead of inside poli/dokter
  poliTujuan?: string;
  namaPoliTujuan?: string;
  kodeDokter?: string;
  namaDokter?: string;
  sep?: {
    noSep?: string;
    tglSep?: string;
    provPerujuk?: {
      kdProviderPerujuk?: string;
      nmProviderPerujuk?: string;
    };
    ppkPelayanan?: string;
    jnsPelayanan?: string;
    poli?: string;
    klsRawat?: string;
  };
  statusKontrol?: string;
  terbitSEP?: string;
  // PRB Data
  formPRB?: {
    kdStatusPRB?: string;
    data?: PRBFormData;
  };
}

// SEP Kontrol Request (using Surat Kontrol for check-in)
export interface VClaimSEPKontrolRequest {
  noKartu: string;
  tglSep: string;
  noSuratKontrol: string;
  noSEPAsal: string;
  tglSEPAsal: string;
  kodePoli: string;
  kodeDokter: string;
  jnsPelayanan: string;
  catatan?: string;
  diagAwal: string;
  klsRawatHak: string;
  klsRawatNaik?: string;
  pembiayaan?: string;
  penanggungJawab?: string;
  lakaLantas?: string;
  noTelp: string;
  userBuat: string;
  // For SIMRS registration update
  registrationId?: number;
}

// SEP Options for Dropdowns
export interface VClaimSEPOptions {
  jenisPelayanan: { kode: string; nama: string }[];
  kelasRawat: { kode: string; nama: string }[];
  kelasRawatNaik: { kode: string; nama: string }[];
  pembiayaanNaikKelas: { kode: string; nama: string }[];
  asalRujukan: { kode: string; nama: string }[];
  lakaLantas: { kode: string; nama: string }[];
  tujuanKunjungan: { kode: string; nama: string }[];
  flagProcedure: { kode: string; nama: string }[];
  kdPenunjang: { kode: string; nama: string }[];
  assesmentPelayanan: { kode: string; nama: string }[];
  yaTidak: { kode: string; nama: string }[];
}

// Local SEP model (from database)
// Patient relation for SEP
interface SEPPatient {
  id: number;
  no_telepon?: string;
  no_hp?: string;
}

export interface SEPLocal {
  id: number;
  no_sep: string;
  registration_id: number;
  patient_id: number;
  visit_id?: number;
  no_kartu: string;
  nama_pasien: string;
  nik: string;
  tgl_lahir: string;
  jenis_kelamin: string;
  tgl_sep: string;
  jns_pelayanan: string;
  kls_rawat_hak: string;
  kls_rawat_naik: string;
  pembiayaan: string;
  no_mr: string;
  asal_rujukan: string;
  no_rujukan: string;
  tgl_rujukan: string;
  ppk_rujukan: string;
  nama_rujukan: string;
  kode_poli: string;
  nama_poli: string;
  poli_eks: string;
  kode_dpjp: string;
  nama_dpjp: string;
  ppk_pelayanan: string;
  diag_awal: string;
  nama_diagnosa: string;
  laka_lantas: string;
  no_lp_laka: string;
  tgl_kejadian: string;
  keterangan_laka: string;
  suplesi: string;
  no_sep_suplesi: string;
  kd_propinsi: string;
  kd_kabupaten: string;
  kd_kecamatan: string;
  cob: string;
  katarak: string;
  tujuan_kunj: string;
  flag_procedure: string;
  kd_penunjang: string;
  assesment_pel: string;
  no_surat_kontrol: string;
  catatan: string;
  no_telp: string;
  user_buat: string;
  status: string;
  created_at: string;
  updated_at: string;
  // Patient relation (from Preload)
  patient?: SEPPatient;
}

// SPRI Request
export interface VClaimSPRIRequest {
  no_kartu: string;
  kode_dokter: string;
  nama_dokter?: string;
  poli_kontrol: string;
  nama_poli?: string;
  tgl_rencana_kontrol: string; // yyyy-mm-dd
  visit_id?: number;
  registration_id?: number;
  sep_id?: number;
}

// SPRI Response
export interface VClaimSPRIResponse {
  noSPRI: string;
  tglRencanaKontrol: string;
  namaDokter: string;
  noKartu: string;
  nama: string;
  kelamin: string;
  tglLahir: string;
  namaDiagnosa: string | null;
}

// SPRI Local (from database)
export interface SPRILocal {
  id: number;
  no_spri: string;
  is_bpjs: boolean;
  no_kartu: string;
  nama: string;
  kelamin: string;
  tgl_lahir: string;
  tgl_rencana_kontrol: string;
  kode_poli: string;
  nama_poli: string;
  kode_dokter: string;
  nama_dokter: string;
  nama_diagnosa: string;
  registration_id?: number;
  visit_id?: number;
  patient_id: number;
  sep_id?: number;
  user_buat: string;
  status: string;
  created_at: string;
  updated_at: string;
  // Enrichment: info pendaftaran rawat inap terkait
  inpatient_sep_id?: number;
  inpatient_sep_number?: string;
  inpatient_registration_id?: number;
  inpatient_registration_number?: string;
}

// ==================== Surat Kontrol (SKDP Rawat Jalan) ====================

// PRB Status Options
export interface PRBStatusOption {
  kode: string;
  nama: string;
}

// PRB Form Data - sesuai dokumentasi BPJS
export interface PRBFormData {
  // Diabetes Melitus (01), Stroke (07)
  HBA1C?: number | null;
  GDP?: number | null;
  GD2JPP?: number | null;
  eGFR?: number | null;
  TD_Sistolik?: number | null;
  TD_Diastolik?: number | null;
  LDL?: number | null;
  // Hipertensi (02), Penyakit Jantung (04)
  Rata_TD_Sistolik?: number | null;
  Rata_TD_Diastolik?: number | null;
  JantungKoroner?: number | null;
  Stroke?: number | null;
  VaskularPerifer?: number | null;
  Aritmia?: number | null;
  AtrialFibrilasi?: number | null;
  // Penyakit Jantung (04)
  NadiIstirahat?: number | null;
  SesakNapas3Bulan?: number | null;
  NyeriDada3Bulan?: number | null;
  SesakNapasAktivitas?: number | null;
  NyeriDadaAktivitas?: number | null;
  // Asma (03)
  Terkontrol?: number | null;
  Gejala2xMinggu?: number | null;
  BangunMalam?: number | null;
  KeterbatasanFisik?: number | null;
  FungsiParu?: number | null;
  // PPOK (05)
  SkorMMRC?: number | null;
  Eksaserbasi1Tahun?: number | null;
  MampuAktivitas?: number | null;
  // Epilepsi (08)
  Epileptik6Bulan?: number | null;
  EfekSampingOAB?: number | null;
  HamilMenyusui?: number | null;
  // Skizofrenia (06)
  Remisi?: number | null;
  TerapiRumatan?: number | null;
  Usia?: number | null;
  // Stroke (07)
  AsamUrat?: number | null;
  // SLE (09)
  RemisiSLE?: number | null;
  Hamil?: number | null;
}

// Surat Kontrol Request
export interface SuratKontrolRequest {
  no_sep: string;
  registration_id?: number;
  visit_id?: number;
  patient_id: number;
  sep_id?: number;
  tgl_rencana_kontrol: string; // yyyy-mm-dd
  kode_poli: string;
  nama_poli?: string;
  kode_dokter: string;
  nama_dokter?: string;
  is_prb?: boolean;
  kd_status_prb?: string;
  data_prb?: PRBFormData;
  version?: 'v1' | 'v2'; // v1 = tanpa PRB, v2 = dengan PRB (default)
  buatkan_antrean?: boolean; // Opsional: Buatkan antrean MJKN sekaligus
}

// Surat Kontrol Response from BPJS
export interface SuratKontrolResponse {
  noSuratKontrol: string;
  tglRencanaKontrol: string;
  namaDokter: string;
  noKartu: string;
  nama: string;
  kelamin: string;
  tglLahir: string;
  namaDiagnosa: string;
  formPRB?: {
    kdStatusPRB: string;
    data: PRBFormData;
  };
}

// Surat Kontrol Local (from database)
export interface SuratKontrolLocal {
  id: number;
  source_type?: "bpjs" | "simrs";
  no_surat_kontrol: string;
  no_sep: string;
  registration_id?: number;
  visit_id?: number;
  patient_id: number;
  sep_id?: number;
  no_kartu: string;
  nama: string;
  kelamin: string;
  tgl_lahir: string;
  tgl_rencana_kontrol: string;
  kode_poli: string;
  nama_poli: string;
  kode_dokter: string;
  nama_dokter: string;
  nama_diagnosa: string;
  is_prb: boolean;
  kd_status_prb: string;
  nama_status_prb: string;
  data_prb: string; // JSON string
  user_buat: string;
  status: string;
  created_at: string;
  updated_at: string;
}

// ==================== VClaim API ====================
export const vclaimApi = {
  // Peserta
  getPesertaByNoKartu: (noKartu: string, tglSEP: string) =>
    api.get<{ data: VClaimPeserta; message: string }>(`/bpjs/vclaim/peserta/nokartu/${noKartu}`, {
      params: { tglSEP }
    }),

  getPesertaByNIK: (nik: string, tglSEP: string) =>
    api.get<{ data: VClaimPeserta; message: string }>(`/bpjs/vclaim/peserta/nik/${nik}`, {
      params: { tglSEP }
    }),

  // Rujukan
  getRujukanByNomor: (noRujukan: string) =>
    api.get<{ data: VClaimRujukan; message: string }>(`/bpjs/vclaim/rujukan/nomor/${noRujukan}`),

  getRujukanByPeserta: (noKartu: string, asalFaskes: string = "1") =>
    api.get<{ data: VClaimRujukanWrapper[]; message: string }>(`/bpjs/vclaim/rujukan/peserta/${noKartu}`, {
      params: { asalFaskes }
    }),

  getRujukanByVisit: (visitId: number) =>
    api.get<{ data: VClaimReferralLocal }>(`/bpjs/vclaim/rujukan/visit/${visitId}`),

  createRujukanV1: (payload: VClaimCreateRujukanV1Request) =>
    api.post<{ data: { noRujukan?: string }; message: string }>('/bpjs/vclaim/rujukan/v1', payload),

  updateRujukanV1: (noRujukan: string, payload: VClaimCreateRujukanV1Request) =>
    api.put<{ data: { no_rujukan?: string }; message: string }>(`/bpjs/vclaim/rujukan/v1/${noRujukan}`, payload),

  createRujukanV2: (payload: VClaimCreateRujukanV2Request) =>
    api.post<{ data: { noRujukan?: string }; message: string }>('/bpjs/vclaim/rujukan/v2', payload),

  updateRujukanV2: (noRujukan: string, payload: VClaimCreateRujukanV2Request) =>
    api.put<{ data: { no_rujukan?: string }; message: string }>(`/bpjs/vclaim/rujukan/v2/${noRujukan}`, payload),

  deleteRujukan: (noRujukan: string) =>
    api.delete<{ data?: { no_rujukan?: string }; message: string }>(`/bpjs/vclaim/rujukan/${noRujukan}`),

  createRujukanKhusus: (payload: VClaimRujukanKhususRequest) =>
    api.post<{ data: { norujukan?: string }; message: string }>('/bpjs/vclaim/rujukan/khusus', payload),

  deleteRujukanKhusus: (payload: VClaimDeleteRujukanKhususRequest) =>
    api.delete<{ data?: { id_rujukan?: string }; message: string }>('/bpjs/vclaim/rujukan/khusus', { data: payload }),

  getRujukanSpesialistik: (ppkRujukan: string, tglRujukan: string, keyword?: string) =>
    api.get<{ data: VClaimRujukanSpesialistik[] }>('/bpjs/vclaim/rujukan/spesialistik', {
      params: { ppk_rujukan: ppkRujukan, tgl_rujukan: tglRujukan, keyword }
    }),

  getRujukanSarana: (ppkRujukan: string, keyword?: string) =>
    api.get<{ data: VClaimRujukanSarana[] }>('/bpjs/vclaim/rujukan/sarana', {
      params: { ppk_rujukan: ppkRujukan, keyword }
    }),

  // SEP
  createSEP: (data: VClaimSEPRequest) =>
    api.post<{ data: { noSep: string }; message: string }>('/bpjs/vclaim/sep', data),

  getSEP: (noSEP: string) =>
    api.get<{ data: VClaimSEP; message: string }>(`/bpjs/vclaim/sep/${noSEP}`),

  deleteSEP: (noSEP: string, user: string) =>
    api.delete<{ message: string }>(`/bpjs/vclaim/sep/${noSEP}`, {
      data: { user }
    }),

  // Approval SEP (backdate/finger print)
  approvalSEP: (data: {
    no_kartu: string;
    tgl_sep: string;           // yyyy-mm-dd
    jns_pelayanan: string;     // 1=Rawat Inap, 2=Rawat Jalan
    jns_pengajuan?: string;    // 1=Backdate, 2=Finger Print (default: 1)
    keterangan: string;
  }) =>
    api.post<{ data: { metadata: { code: string; message: string }; response: string }; message: string }>('/bpjs/vclaim/sep/approval', data),

  // Options for form
  getOptions: () =>
    api.get<{ data: VClaimSEPOptions }>('/bpjs/vclaim/options'),

  // Local SEP by Visit
  getSEPByVisit: (visitId: number) =>
    api.get<{ data: SEPLocal }>(`/bpjs/vclaim/sep/visit/${visitId}`),

  // Local SEP by Registration
  getSEPByRegistration: (registrationId: number) =>
    api.get<{ data: SEPLocal }>(`/bpjs/vclaim/sep/registration/${registrationId}`),

  getSEPList: (params?: { registration_id?: number; patient_id?: number; status?: string; limit?: number; no_sep?: string }) =>
    api.get<{ data: SEPLocal[] }>('/bpjs/vclaim/sep/list', { params }),

  importSEP: (data: {
    no_sep: string;
    no_kartu?: string;
    nama_pasien?: string;
    nik?: string;
    tgl_lahir?: string;
    jenis_kelamin?: string;
    tgl_sep?: string;
    jns_pelayanan?: string;
    kls_rawat_hak?: string;
    no_mr?: string;
    asal_rujukan?: string;
    no_rujukan?: string;
    tgl_rujukan?: string;
    ppk_rujukan?: string;
    nama_rujukan?: string;
    kode_poli?: string;
    nama_poli?: string;
    kode_dpjp?: string;
    nama_dpjp?: string;
    ppk_pelayanan?: string;
    diag_awal?: string;
    nama_diagnosa?: string;
    catatan?: string;
    patient_id?: number;
    registration_id?: number;
    visit_id?: number;
  }) =>
    api.post<{ data: SEPLocal; message: string }>('/bpjs/vclaim/sep/import', data),

  deleteSEPLocal: (noSEP: string) =>
    api.delete<{ message: string }>(`/bpjs/vclaim/sep/${noSEP}/local`),

  // SPRI (Surat Perintah Rawat Inap)
  createSPRI: (data: VClaimSPRIRequest) =>
    api.post<{ data: VClaimSPRIResponse; message: string }>('/bpjs/vclaim/spri', data),

  createLocalSPRI: (data: {
    no_kartu: string;
    nama?: string;
    kelamin?: string;
    tgl_lahir?: string;
    kode_dokter: string;
    nama_dokter?: string;
    poli_kontrol: string;
    nama_poli?: string;
    tgl_rencana_kontrol: string;
    nama_diagnosa?: string;
    visit_id?: number;
    registration_id?: number;
    sep_id?: number;
  }) =>
    api.post<{ data: SPRILocal; message: string }>('/bpjs/vclaim/spri/local', data),

  importSPRI: (data: {
    no_spri: string;
    no_kartu?: string;
    nama?: string;
    kelamin?: string;
    tgl_lahir?: string;
    tgl_rencana_kontrol?: string;
    kode_poli?: string;
    nama_poli?: string;
    kode_dokter?: string;
    nama_dokter?: string;
    nama_diagnosa?: string;
    patient_id?: number;
    registration_id?: number;
    visit_id?: number;
    sep_id?: number;
  }) =>
    api.post<{ data: SPRILocal; message: string }>('/bpjs/vclaim/spri/import', data),

  getSPRIByVisit: (visitId: number) =>
    api.get<{ data: SPRILocal }>(`/bpjs/vclaim/spri/visit/${visitId}`),

  getSPRIByRegistration: (registrationId: number) =>
    api.get<{ data: SPRILocal }>(`/bpjs/vclaim/spri/registration/${registrationId}`),

  getSPRIList: (params?: { status?: string; tgl_terbit_from?: string; tgl_terbit_to?: string; tgl_kontrol_from?: string; tgl_kontrol_to?: string; search?: string; limit?: number }) =>
    api.get<{ data: SPRILocal[] }>('/bpjs/vclaim/spri/list', { params }),

  deleteSPRI: (noSPRI: string) =>
    api.delete<{ message: string }>(`/bpjs/vclaim/spri/${noSPRI}`),

  updateSPRI: (noSPRI: string, data: { kode_dokter: string; nama_dokter: string; poli_kontrol: string; nama_poli: string; tgl_rencana_kontrol: string }) =>
    api.put<{ data: VClaimSPRIResponse; message: string }>(`/bpjs/vclaim/spri/${noSPRI}`, data),

  searchPoliSPRI: (nama: string) =>
    api.get<{ data: VClaimRefPoli[] }>('/bpjs/vclaim/spri/poli', {
      params: { nama }
    }),

  searchDokterSPRI: (kodePoli: string, tglPelayanan?: string) =>
    api.get<{ data: VClaimRefDokter[] }>('/bpjs/vclaim/spri/dokter', {
      params: { kode_poli: kodePoli, tgl_pelayanan: tglPelayanan }
    }),

  // Referensi (searchable)
  searchPoli: (nama: string) =>
    api.get<{ data: VClaimRefPoli[] }>('/bpjs/vclaim/referensi/poli', {
      params: { nama }
    }),

  searchDokterDPJP: (jnsPelayanan: string, tglPelayanan: string, spesialis: string) =>
    api.get<{ data: VClaimRefDokter[] }>('/bpjs/vclaim/referensi/dokter-dpjp', {
      params: { jnsPelayanan, tglPelayanan, spesialis }
    }),

  searchDiagnosa: (kode: string) =>
    api.get<{ data: VClaimRefDiagnosa[] }>('/bpjs/vclaim/referensi/diagnosa', {
      params: { kode }
    }),

  searchFaskes: (nama: string, jenis?: string) =>
    api.get<{ data: VClaimRefFaskes[] }>('/bpjs/vclaim/referensi/faskes', {
      params: { nama, jenis }
    }),

  getPropinsi: () =>
    api.get<{ data: VClaimRefPropinsi[] }>('/bpjs/vclaim/referensi/propinsi'),

  getKabupaten: (kdPropinsi: string) =>
    api.get<{ data: VClaimRefKabupaten[] }>(`/bpjs/vclaim/referensi/kabupaten/${kdPropinsi}`),

  getKecamatan: (kdKabupaten: string) =>
    api.get<{ data: VClaimRefKecamatan[] }>(`/bpjs/vclaim/referensi/kecamatan/${kdKabupaten}`),

  // Rencana Kontrol / SKDP
  getRencanaKontrolBySEP: (noSEP: string) =>
    api.get<{ data: VClaimRencanaKontrolBySEP }>(`/bpjs/vclaim/rencana-kontrol/sep/${noSEP}`),

  getListRencanaKontrol: (noKartu: string, params?: { bulan?: string; tahun?: string; filter?: string }) =>
    api.get<{ data: VClaimListRencanaKontrolItem[] }>(`/bpjs/vclaim/rencana-kontrol/peserta/${noKartu}`, { params }),

  // Surat Kontrol (SKDP Rawat Jalan) - untuk disposisi pulang
  createSuratKontrol: (data: SuratKontrolRequest) =>
    api.post<{ data: SuratKontrolResponse; message: string; surat_kontrol_id: number; antrean?: { success: boolean; message: string; kode_booking?: string; nomor_antrean?: string } }>('/bpjs/vclaim/surat-kontrol', data),

  deleteSuratKontrol: (noSuratKontrol: string) =>
    api.delete<{ message: string }>(`/bpjs/vclaim/surat-kontrol/${noSuratKontrol}`),

  deleteSuratKontrolLocal: (noSuratKontrol: string) =>
    api.delete<{ message: string }>(`/bpjs/vclaim/surat-kontrol/${noSuratKontrol}/local`),

  updateSuratKontrol: (noSuratKontrol: string, data: { kode_dokter: string; nama_dokter?: string; poli_kontrol: string; nama_poli?: string; tgl_rencana_kontrol: string; is_prb?: boolean; kd_status_prb?: string; data_prb?: any; version?: string }) =>
    api.put<{ data: SuratKontrolResponse; message: string }>(`/bpjs/vclaim/surat-kontrol/${noSuratKontrol}`, data),

  getSuratKontrolByVisit: (visitId: number) =>
    api.get<{ data: SuratKontrolLocal }>(`/bpjs/vclaim/surat-kontrol/visit/${visitId}`),

  getSuratKontrolByRegistration: (registrationId: number) =>
    api.get<{ data: SuratKontrolLocal }>(`/bpjs/vclaim/surat-kontrol/registration/${registrationId}`),

  getSuratKontrolList: (params?: { patient_id?: number; visit_id?: number; status?: string; tgl_terbit_from?: string; tgl_terbit_to?: string; tgl_kontrol_from?: string; tgl_kontrol_to?: string; search?: string; limit?: number }) =>
    api.get<{ data: SuratKontrolLocal[] }>('/bpjs/vclaim/surat-kontrol/list', { params }),

  getSuratKontrolLocal: (noSuratKontrol: string) =>
    api.get<{ data: SuratKontrolLocal }>(`/bpjs/vclaim/surat-kontrol/local/${noSuratKontrol}`),

  // Get Surat Kontrol Detail from BPJS by No Surat Kontrol
  getSuratKontrolDetail: (noSuratKontrol: string) =>
    api.get<{ data: VClaimSuratKontrolDetail }>(`/bpjs/vclaim/surat-kontrol/detail/${noSuratKontrol}`),

  // Search Surat Kontrol by No Kartu from BPJS
  searchSuratKontrolByNoKartu: (noKartu: string, params?: { bulan?: string; tahun?: string; filter?: string }) =>
    api.get<{ data: VClaimListRencanaKontrolItem[] }>(`/bpjs/vclaim/surat-kontrol/cari/${noKartu}`, { params }),

  // Create SEP for Kontrol (using Surat Kontrol)
  createSEPKontrol: (data: VClaimSEPKontrolRequest) =>
    api.post<{ data: { noSep: string; sepId: number }; message: string }>('/bpjs/vclaim/sep/kontrol', {
      registration_id: data.registrationId,
      no_surat_kontrol: data.noSuratKontrol,
      no_sep_asal: data.noSEPAsal,
      tgl_sep_asal: data.tglSEPAsal,
      diag_awal: data.diagAwal,
      no_telp: data.noTelp,
      catatan: data.catatan,
      kode_dokter: data.kodeDokter,
      kode_poli: data.kodePoli,
      no_kartu: data.noKartu,
      kls_rawat_hak: data.klsRawatHak,
      kls_rawat_naik: data.klsRawatNaik,
      pembiayaan: data.pembiayaan,
      penanggung_jawab: data.penanggungJawab,
      jns_pelayanan: data.jnsPelayanan,
    }),

  searchPoliSuratKontrol: (nama: string) =>
    api.get<{ data: VClaimRefPoli[] }>('/bpjs/vclaim/surat-kontrol/poli', {
      params: { nama }
    }),

  searchDokterSuratKontrol: (kodePoli: string, tglPelayanan?: string) =>
    api.get<{ data: VClaimRefDokter[] }>('/bpjs/vclaim/surat-kontrol/dokter', {
      params: { kode_poli: kodePoli, tgl_pelayanan: tglPelayanan }
    }),

  getPRBOptions: () =>
    api.get<{ data: PRBStatusOption[] }>('/bpjs/vclaim/surat-kontrol/prb-options'),

  // Cancel SPRI (update local status only - BPJS delete done via deleteSuratKontrol with noSPRI)
  cancelSPRILocal: (visitId: number) =>
    api.put<{ message: string }>(`/bpjs/vclaim/spri/visit/${visitId}/cancel`, {}),

  // Persetujuan / Approval SEP (untuk SEP backdate atau fingerprint)
  getListPersetujuanSEP: (bulan: string, tahun: string) =>
    api.get<{ data: VClaimPersetujuanSEPItem[] }>('/bpjs/vclaim/sep/persetujuan', {
      params: { bulan, tahun }
    }),

  pengajuanSEP: (data: VClaimApprovalSEPRequest) =>
    api.post<{ message: string }>('/bpjs/vclaim/sep/pengajuan', data),
};
