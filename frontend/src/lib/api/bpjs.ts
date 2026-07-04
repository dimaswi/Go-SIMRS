import { api } from './client';

// BPJS Config Types
export interface BPJSConfigValue {
  value: string;
  has_value: boolean;
  description: string;
  is_secret: boolean;
  is_encrypted: boolean;
}

export interface BPJSConfigMap {
  bpjs_cons_id?: BPJSConfigValue;
  bpjs_secret_key?: BPJSConfigValue;
  bpjs_user_key?: BPJSConfigValue;
  bpjs_kode_ppk?: BPJSConfigValue;
  bpjs_nama_ppk?: BPJSConfigValue;
  bpjs_environment?: BPJSConfigValue;
  bpjs_base_url_dev?: BPJSConfigValue;
  bpjs_base_url_prod?: BPJSConfigValue;
  bpjs_sync_interval_minutes?: BPJSConfigValue;
  bpjs_auto_sync_enabled?: BPJSConfigValue;
  [key: string]: BPJSConfigValue | undefined;
}

export interface BPJSConnectionTestResult {
  success: boolean;
  message?: string;
  error?: string;
  environment?: string;
  base_url?: string;
  response_code?: number;
  response_time?: string;
  response_body?: string;
  duration?: number;
  poli_count?: number;
}

export interface BPJSFingerprintLaunchRequest {
  executable_path?: string;
  username?: string;
  password?: string;
  auto_submit?: boolean;
  bpjs_card_number?: string;
  patient_nik?: string;
}

export interface BPJSFingerprintLaunchResponse {
  message: string;
  data: {
    executable_path: string;
    auto_submit: boolean;
    bpjs_card_number?: string;
    patient_nik?: string;
  };
}

export interface BPJSSyncLog {
  id: number;
  endpoint: string;
  method: string;
  request_body: string;
  response_code: number;
  response_body: string;
  status: 'success' | 'failed' | 'timeout';
  error_message: string;
  request_at: string;
  response_at: string;
  duration_ms: number;
  reference_type: string;
  reference_id: number;
  created_at: string;
}

export interface BPJSSyncStats {
  total_requests: number;
  success_requests: number;
  failed_requests: number;
  avg_duration_ms: number;
}

export interface BPJSApotekDPHOItem {
  kodeobat: string;
  namaobat: string;
  prb?: string | boolean | number | null;
  kronis?: string | boolean | number | null;
  kemo?: string | boolean | number | null;
  harga?: string | null;
  restriksi?: string | null;
  generik?: string | null;
  aktif?: string | null;
  sedia?: string | null;
  stok?: string | null;
  [key: string]: unknown;
}

export interface BPJSApotekDPHOData {
  list?: BPJSApotekDPHOItem[];
}

// Referensi BPJS Types
export interface BPJSReferensiPoli {
  kdpoli: string;
  nmpoli: string;
}

export interface BPJSReferensiDokter {
  kodedokter: number;
  namadokter: string;
}

export interface BPJSJadwalDokter {
  kodedokter: number;
  namadokter: string;
  kodepoli: string;
  namapoli: string;
  hari: number;
  namahari: string;
  jadwal: string;
  libur: number;
  kapasitaspasien: number;
}

// Mapping Types
export interface BPJSPoliMapping {
  id: number;
  room_id: number;
  room_code: string;
  room_name: string;
  kode_poli_bpjs: string;
  nama_poli_bpjs: string;
  is_active: boolean;
  room?: {
    id: number;
    code: string;
    name: string;
  };
  doctor_mappings?: BPJSDoctorMapping[];
  created_at: string;
  updated_at: string;
}

export interface BPJSDoctorMapping {
  id: number;
  poli_mapping_id: number;
  poli_mapping?: BPJSPoliMapping;
  doctor_schedule_id?: number;
  employee_id: number;
  employee_name: string;
  employee?: {
    id: number;
    nama_lengkap: string;
    nip?: string;
  };
  kode_dokter_bpjs: string;
  nama_dokter_bpjs: string;
  jadwal_hari: string;
  jam_praktek: string;
  kuota_jkn: number;
  kuota_non_jkn: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePoliMappingRequest {
  room_id: number;
  kode_poli_bpjs: string;
  nama_poli_bpjs: string;
}

export interface UpdatePoliMappingRequest {
  kode_poli_bpjs?: string;
  nama_poli_bpjs?: string;
  is_active?: boolean;
}

export interface CreateDoctorMappingRequest {
  poli_mapping_id: number;
  employee_id: number;
  doctor_schedule_id?: number;
  kode_dokter_bpjs: string;
  nama_dokter_bpjs: string;
  jadwal_hari?: string;
  jam_praktek?: string;
  kuota_jkn?: number;
  kuota_non_jkn?: number;
}

export interface UpdateDoctorMappingRequest {
  kode_dokter_bpjs?: string;
  nama_dokter_bpjs?: string;
  jadwal_hari?: string;
  jam_praktek?: string;
  kuota_jkn?: number;
  kuota_non_jkn?: number;
  is_active?: boolean;
}

export const bpjsApi = {
  // Config
  getConfig: () => 
    api.get<{ data: BPJSConfigMap }>('/bpjs/config'),
  
  updateConfig: (data: Record<string, string>) => 
    api.put<{ message: string }>('/bpjs/config', data),
  
  initConfig: () => 
    api.post<{ message: string }>('/bpjs/config/init'),
  
  testConnection: () => 
    api.get<BPJSConnectionTestResult>('/bpjs/test-connection'),

  launchFingerprintApp: (data: BPJSFingerprintLaunchRequest) =>
    api.post<BPJSFingerprintLaunchResponse>('/bpjs/fingerprint/launch', data),

  // Logs
  getLogs: (params?: { status?: string; date?: string; endpoint?: string; limit?: number }) => 
    api.get<{ data: BPJSSyncLog[] }>('/bpjs/logs', { params }),
  
  getStats: () => 
    api.get<{ data: BPJSSyncStats }>('/bpjs/logs/stats'),

  // Referensi BPJS
  getReferensiPoli: () =>
    api.get<{ data: BPJSReferensiPoli[]; count: number }>('/bpjs/referensi/poli'),
  
  getReferensiDokter: () =>
    api.get<{ data: BPJSReferensiDokter[]; count: number }>('/bpjs/referensi/dokter'),
  
  getJadwalDokter: (kodePoli: string, tanggal?: string) =>
    api.get<{ data: BPJSJadwalDokter[]; count: number }>('/bpjs/referensi/jadwal-dokter', {
      params: { kode_poli: kodePoli, tanggal }
    }),

  // Poli Mapping
  getPoliMappings: (params?: { room_id?: number; is_active?: boolean }) => 
    api.get<{ data: BPJSPoliMapping[] }>('/bpjs/mapping/poli', { params }),
  
  createPoliMapping: (data: CreatePoliMappingRequest) => 
    api.post<{ data: BPJSPoliMapping }>('/bpjs/mapping/poli', data),
  
  updatePoliMapping: (id: number, data: UpdatePoliMappingRequest) => 
    api.put<{ data: BPJSPoliMapping }>(`/bpjs/mapping/poli/${id}`, data),
  
  deletePoliMapping: (id: number) => 
    api.delete<{ message: string }>(`/bpjs/mapping/poli/${id}`),

  // Doctor Mapping
  getDoctorMappings: (params?: { poli_mapping_id?: number; employee_id?: number; is_active?: boolean }) =>
    api.get<{ data: BPJSDoctorMapping[] }>('/bpjs/mapping/dokter', { params }),
  
  createDoctorMapping: (data: CreateDoctorMappingRequest) =>
    api.post<{ data: BPJSDoctorMapping }>('/bpjs/mapping/dokter', data),
  
  updateDoctorMapping: (id: number, data: UpdateDoctorMappingRequest) =>
    api.put<{ data: BPJSDoctorMapping }>(`/bpjs/mapping/dokter/${id}`, data),
  
  deleteDoctorMapping: (id: number) =>
    api.delete<{ message: string }>(`/bpjs/mapping/dokter/${id}`),
  
  syncDoctorFromReferensi: () =>
    api.post<{ message: string; data: Record<string, unknown> }>('/bpjs/mapping/dokter/sync'),

  // BPJS Queue (Antrian MJKN)
  getQueues: (params?: { date?: string; status?: string; kode_poli?: string; limit?: number }) =>
    api.get<{ data: BPJSQueue[] }>('/bpjs/queue', { params }),
  
  getQueueByRegistration: (registrationId: number) =>
    api.get<{ data: BPJSQueue }>(`/bpjs/queue/registration/${registrationId}`),
  
  getQueueByVisit: (visitId: number) =>
    api.get<{ data: BPJSQueue }>(`/bpjs/queue/visit/${visitId}`),
  
  activateQueueCheckin: (queueId: number) =>
    api.post<{ message: string; data: BPJSQueue }>(`/bpjs/queue/${queueId}/checkin`),
  
  // Manual send task to BPJS (for monitoring page)
  // waktu: timestamp in milliseconds
  sendTaskManual: (queueId: number, taskId: number, waktu: number) =>
    api.post<{ 
      success: boolean; 
      message: string; 
      response_code: number; 
      response_msg: string;
      waktu_sent: number;
    }>(`/bpjs/queue/${queueId}/send-task`, { task_id: taskId, waktu }),
  
  // Retry AddAntrean to BPJS
  retryAddAntrean: (queueId: number) =>
    api.post<{
      success: boolean;
      response_code: number;
      response_msg: string;
      data: BPJSQueue;
    }>(`/bpjs/queue/${queueId}/retry-add`),

  // Cancel BPJS queue (from internal system)
  cancelQueue: (queueId: number) =>
    api.post<{ message: string; data: BPJSQueue }>(`/bpjs/queue/${queueId}/cancel`),

  // === Antrian Online (direct BPJS API calls) ===

  // Get pendaftaran antrean by date from BPJS Antrian Online
  getPendaftaranAntrean: (tanggal: string) =>
    api.get<{ data: BPJSPendaftaranAntreanItem[] }>(`/bpjs/antrean/pendaftaran/${tanggal}`),

  // Batal antrean at BPJS Antrian Online
  batalAntrean: (kodebooking: string, keterangan: string) =>
    api.post<{ message: string; response_code: number; response_msg: string }>(
      '/bpjs/antrean/batal', { kodebooking, keterangan }
    ),

  // Get pendaftaran detail by kode booking
  getPendaftaranByKodeBooking: (kodebooking: string) =>
    api.get<{ data: BPJSPendaftaranAntreanItem[] }>(`/bpjs/antrean/pendaftaran-detail/${kodebooking}`),

  // Get list task by kode booking
  getListTask: (kodebooking: string) =>
    api.post<{ data: BPJSListTaskItem[] }>('/bpjs/antrean/getlisttask', { kodebooking }),

  // === I-Care ===
  
  // Validate I-Care: returns URL to open BPJS I-Care web interface
  icareValidate: (visitId: number) =>
    api.post<{ url: string; message: string }>(`/bpjs/icare/validate/${visitId}`),
  
  // Validate I-Care manual: input nomor kartu dan kode dokter langsung
  icareValidateManual: (noKartu: string, kodeDokter: number) =>
    api.post<{ url: string; message: string }>('/bpjs/icare/validate-manual', { no_kartu: noKartu, kode_dokter: kodeDokter }),

  // === APLICARE (Ketersediaan Tempat Tidur) ===

  // Referensi kelas kamar dari BPJS
  aplicareGetRefKelas: () =>
    api.get<{ data: AplicareRefKelasItem[] }>('/bpjs/aplicare/ref-kelas'),

  // Baca ketersediaan tempat tidur dari BPJS
  aplicareReadBed: (start = 1, limit = 100) =>
    api.get<{ data: AplicareBedItem[] }>(`/bpjs/aplicare/bed?start=${start}&limit=${limit}`),

  // Daftar ruangan rawat inap SIMRS (yang punya bed)
  aplicareGetRooms: () =>
    api.get<{ data: AplicareRoom[] }>('/bpjs/aplicare/rooms'),

  // Daftarkan ruangan baru ke Aplicare
  aplicareCreateRoom: (payload: AplicareCreateRoomPayload | number) =>
    api.post<{ message: string; data: AplicareBedRequest }>('/bpjs/aplicare/bed/create', typeof payload === 'number' ? { room_id: payload } : payload),

  // Update ketersediaan tempat tidur
  aplicareUpdateRoom: (roomId: number) =>
    api.post<{ message: string; data: AplicareBedRequest }>('/bpjs/aplicare/bed/update', { room_id: roomId }),

  // Hapus seluruh ruangan beserta unitnya dari Aplicare
  aplicareDeleteRoom: (roomId: number) =>
    api.post<{ message: string }>('/bpjs/aplicare/bed/delete', { room_id: roomId }),

  // === APOTEK ONLINE ===

  apotekGetReferensiDPHO: () =>
    api.get<{ data: BPJSApotekDPHOData | BPJSApotekDPHOItem[]; cached?: boolean; warning?: string }>('/bpjs/apotek/referensi/dpho'),

  apotekGetReferensiPoli: (parameter: string) =>
    api.get<{ data: unknown }>(`/bpjs/apotek/referensi/poli/${encodeURIComponent(parameter)}`),

  apotekGetFasilitasKesehatan: (jenisFaskes: string, namaFaskes: string) =>
    api.get<{ data: unknown }>(
      `/bpjs/apotek/referensi/ppk/${encodeURIComponent(jenisFaskes)}/${encodeURIComponent(namaFaskes)}`,
    ),

  apotekGetSettingApotek: (kodeApotek: string) =>
    api.get<{ data: unknown }>(`/bpjs/apotek/referensi/settingppk/${encodeURIComponent(kodeApotek)}`),

  apotekGetSpesialistik: () =>
    api.get<{ data: unknown }>('/bpjs/apotek/referensi/spesialistik'),

  apotekGetReferensiObat: (kodeJenisObat: string, tglResep: string, filter: string) =>
    api.get<{ data: unknown }>('/bpjs/apotek/referensi/obat', {
      params: {
        kodeJenisObat,
        tglResep,
        filter,
      },
    }),

  apotekInsertObatNonRacikan: (payload: Record<string, unknown>) =>
    api.post<{ data: unknown }>('/bpjs/apotek/obat/non-racikan', payload),

  apotekInsertObatRacikan: (payload: Record<string, unknown>) =>
    api.post<{ data: unknown }>('/bpjs/apotek/obat/racikan', payload),

  apotekUpdateStokObat: (payload: Record<string, unknown>) =>
    api.post<{ data: unknown }>('/bpjs/apotek/obat/stok', payload),

  apotekHapusPelayananObat: (payload: Record<string, unknown>) =>
    api.delete<{ data: unknown }>('/bpjs/apotek/pelayanan/obat', { data: payload }),

  apotekGetDaftarPelayananObat: (noKunjungan: string) =>
    api.get<{ data: unknown }>(`/bpjs/apotek/obat/daftar/${encodeURIComponent(noKunjungan)}`),

  apotekGetRiwayatPelayananObat: (tglAwal: string, tglAkhir: string, noKartu: string) =>
    api.get<{ data: unknown }>(
      `/bpjs/apotek/riwayat/${encodeURIComponent(tglAwal)}/${encodeURIComponent(tglAkhir)}/${encodeURIComponent(noKartu)}`,
    ),

  apotekSimpanResep: (payload: Record<string, unknown>) =>
    api.post<{ data: unknown }>('/bpjs/apotek/resep/simpan', payload),

  apotekHapusResep: (payload: Record<string, unknown>) =>
    api.delete<{ data: unknown }>('/bpjs/apotek/resep', { data: payload }),

  apotekDaftarResep: (payload: Record<string, unknown>) =>
    api.post<{ data: unknown }>('/bpjs/apotek/resep/daftar', payload),

  apotekCariKunjunganBySEP: (noSEP: string) =>
    api.get<{ data: unknown }>(`/bpjs/apotek/sep/${encodeURIComponent(noSEP)}`),

  apotekGetDataKlaim: (bulan: string, tahun: string, jenisObat: string, status: string) =>
    api.get<{ data: unknown }>(
      `/bpjs/apotek/monitoring/klaim/${encodeURIComponent(bulan)}/${encodeURIComponent(tahun)}/${encodeURIComponent(jenisObat)}/${encodeURIComponent(status)}`,
    ),

  apotekGetRekapPesertaPRB: (tahun: string, bulan: string) =>
    api.get<{ data: unknown }>(`/bpjs/apotek/prb/rekap/${encodeURIComponent(tahun)}/${encodeURIComponent(bulan)}`),
};

// BPJS Queue Types (Antrian MJKN)
export interface BPJSQueue {
  id: number;
  kode_booking: string;
  nomor_antrean: string;
  angka_antrean: number;
  tanggal_periksa: string;
  jam_praktek: string;
  kode_poli: string;
  nama_poli: string;
  kode_dokter: string;
  nama_dokter: string;
  jenis_pasien: string;
  no_kartu: string;
  nik: string;
  no_hp: string;
  no_rm: string;
  nama_pasien: string;
  jenis_kunjungan: number;
  nomor_referensi: string;
  estimasi_dilayani: number;
  status: string;
  keterangan: string;
  waktu_checkin?: string;
  waktu_batal?: string;
  
  // Farmasi
  nomor_antrean_farmasi: number;
  status_farmasi: string;
  
  // Farmasi BPJS Task Buffer
  // Jika ada: farmasi sudah di-order/selesai tapi Task 5/6 belum terkirim, menunggu auto-chain
  farmasi_ready_at?: string;
  farmasi_jenis_resep?: string;
  farmasi_selesai_at?: string;
  
  // Task tracking
  task1_at?: string;
  task2_at?: string;
  task3_at?: string;
  task4_at?: string;
  task5_at?: string;
  task6_at?: string;
  task7_at?: string;
  
  // SIMRS Relations
  patient_id?: number;
  registration_id?: number;
  visit_id?: number;
  room_queue_id?: number;
  room_id?: number;
  poli_mapping_id?: number;
  doctor_mapping_id?: number;
  
  // Sync
  sync_status: string;
  sync_error?: string;
  last_sync_at?: string;
  
  // AddAntrean tracking
  add_antrean_sent: boolean;
  add_antrean_code: number;
  add_antrean_msg?: string;
  
  // Relations
  patient?: {
    id: number;
    no_rm: string;
    nama_lengkap: string;
    nik: string;
  };
  registration?: {
    id: number;
    registration_number: string;
    status: string;
  };
  visit?: {
    id: number;
    visit_number: string;
    status: string;
  };
  room_queue?: {
    id: number;
    queue_number: string;
    status: string;
  };
  room?: {
    id: number;
    name: string;
    code: string;
  };
  
  created_at: string;
  updated_at: string;
}

// BPJS Pendaftaran Antrean Item (from Antrian Online API)
export interface BPJSPendaftaranAntreanItem {
  kodebooking: string;
  tanggal: string;
  kodepoli: string;
  kodedokter: number;
  jampraktek: string;
  nik: string;
  nokapst: string;
  nohp: string;
  norekammedis: string;
  jeniskunjungan: number;
  nomorreferensi: string;
  sumberdata: string;
  ispeserta: boolean | number;
  noantrean: string;
  estimasidilayani: number;
  createdtime: number;
  status: string;
}

// BPJS List Task Item (from Antrian Online getlisttask API)
export interface BPJSListTaskItem {
  taskid: number;
  taskname: string;
  waktu: string;
  wakturs: string;
  wpidr: string;
}

// === APLICARE Types ===

export interface AplicareRefKelasItem {
  kodekelas: string;
  namakelas: string;
}

export interface AplicareBedItem {
  kodekelas: string;
  namakelas: string;
  koderuang: string;
  namaruang: string;
  kapasitas: number;
  tersedia: number;
  tersediapria: number;
  tersediawanita: number;
  tersediapriawanita: number;
}

export interface AplicareBedRequest {
  kodekelas: string;
  koderuang: string;
  namaruang: string;
  kapasitas: string;
  tersedia: string;
  tersediapria: string;
  tersediawanita: string;
  tersediapriawanita: string;
}

export interface AplicareCreateRoomPayload extends Partial<AplicareBedRequest> {
  room_id: number;
  sync_mode?: boolean; // true = update existing too; false = only create new
}

export interface AplicareRoom {
  id: number;
  code: string;
  name: string;
  room_class: string;
  room_type: string;
  has_bed: boolean;
  is_active: boolean;
  total_beds: number;
  available_beds: number;
}
