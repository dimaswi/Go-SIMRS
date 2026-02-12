import { api } from './client';
import type { Employee } from './employees';

// Room (Ruangan) - Hospital Room/Unit
export interface Room {
  id: number;
  code: string;
  name: string;
  queue_code?: string;
  service_type: string;
  room_type: string;
  room_class: string;
  total_floors: number;
  registration_fee: number;
  tariff_per_day: number;
  facilities: string;
  description: string;
  building_id?: number | null;
  has_bed: boolean;
  has_schedule: boolean;
  is_active: boolean;
  pic_employee_id?: number;
  pic_employee?: Employee;
  units?: RoomUnit[];
  schedules?: Schedule[];
  tariffs?: RoomTariff[];
  total_beds?: number;
  available_beds?: number;
  created_at: string;
  updated_at: string;
}

// RoomTariff - Tariff per patient class for inpatient rooms
export interface RoomTariff {
  id: number;
  room_id: number;
  patient_class: string; // non_kelas, kelas_3, kelas_2, kelas_1, vip, vvip
  akomodasi: number;
  makan: number;
  perawatan: number;
  administrasi: number;
  lainnya: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RoomTariffRequest {
  patient_class: string;
  akomodasi: number;
  makan: number;
  perawatan: number;
  administrasi: number;
  lainnya: number;
  is_active?: boolean;
}

export interface BulkRoomTariffRequest {
  tariffs: RoomTariffRequest[];
}

// RoomUnit (Kamar) - Chamber within a Room
export interface RoomUnit {
  id: number;
  room_id: number;
  code: string;
  name: string;
  floor: number;
  capacity: number;
  is_active: boolean;
  notes: string;
  room?: Room;
  beds?: Bed[];
  created_at: string;
  updated_at: string;
}

// Bed (Tempat Tidur) - Bed within a RoomUnit
export interface Bed {
  id: number;
  room_unit_id: number;
  bed_number: string;
  bed_type: string;
  status: string;
  notes: string;
  room_unit?: RoomUnit;
  current_patient?: {
    name: string;
    medical_record_number: string;
    nik?: string;
    gender?: string;
    birth_date?: string;
    age?: number;
    address?: string;
    phone?: string;
    insurance_type?: string;
    insurance_number?: string;
    admission_date?: string;
    diagnosis?: string;
    doctor_name?: string;
    room_name?: string;
    unit_name?: string;
    visit_id: number;
    patient_id?: number;
  };
  created_at: string;
  updated_at: string;
}

// RoomStaff - Staff assigned to a Room
export interface RoomStaff {
  id: number;
  room_id: number;
  employee_id: number;
  role_type: string;
  is_primary: boolean;
  start_date?: string;
  end_date?: string;
  notes: string;
  room?: Room;
  employee?: Employee;
  created_at: string;
  updated_at: string;
}

// Schedule - Room operational schedule (Jadwal Poli)
export interface Schedule {
  id: number;
  room_id: number;
  day_of_week: number; // 0=Sunday, 1=Monday, ..., 6=Saturday
  start_time: string; // "HH:MM"
  end_time: string; // "HH:MM"
  max_patients: number;
  is_active: boolean;
  notes: string;
  room?: Room;
  created_at: string;
  updated_at: string;
}

// DoctorSchedule - Doctor's practice schedule
export interface DoctorSchedule {
  id: number;
  room_id: number;
  employee_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  max_patients: number;
  consult_fee: number;
  is_active: boolean;
  effective_from?: string;
  effective_to?: string;
  notes: string;
  room?: Room;
  employee?: Employee;
  created_at: string;
  updated_at: string;
}

// ScheduleException - Exception to regular schedule
export interface ScheduleException {
  id: number;
  room_id?: number;
  employee_id?: number;
  exception_date: string;
  exception_type: 'closed' | 'modified' | 'holiday';
  start_time?: string;
  end_time?: string;
  reason: string;
  is_active: boolean;
  room?: Room;
  employee?: Employee;
  created_at: string;
  updated_at: string;
}

// Request types
export interface RoomRequest {
  code: string;
  name: string;
  queue_code?: string;
  service_type: string;
  room_type: string;
  room_class?: string;
  total_floors?: number;
  registration_fee?: number;
  tariff_per_day?: number;
  facilities?: string;
  description?: string;
  has_bed?: boolean;
  has_schedule?: boolean;
  is_active?: boolean;
  pic_employee_id?: number | null;
}

export interface RoomUnitRequest {
  code: string;
  name: string;
  floor?: number;
  capacity?: number;
  is_active?: boolean;
  notes?: string;
}

export interface BedRequest {
  bed_number: string;
  bed_type?: string;
  status?: string;
  notes?: string;
}

export interface RoomStaffRequest {
  employee_id: number;
  role_type: string;
  is_primary?: boolean;
  notes?: string;
}

// Schedule request types
export interface ScheduleRequest {
  room_id?: number; // Optional for create from room context
  day_of_week: number;
  start_time: string;
  end_time: string;
  max_patients?: number;
  is_active?: boolean;
  notes?: string;
}

export interface BulkScheduleRequest {
  room_id: number;
  schedules: Omit<ScheduleRequest, 'room_id'>[];
}

export interface DoctorScheduleRequest {
  room_id?: number;
  employee_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  max_patients?: number;
  consult_fee?: number;
  is_active?: boolean;
  effective_from?: string;
  effective_to?: string;
  notes?: string;
}

export interface ScheduleExceptionRequest {
  room_id?: number;
  employee_id?: number;
  exception_date: string;
  exception_type: 'closed' | 'modified' | 'holiday';
  start_time?: string;
  end_time?: string;
  reason?: string;
  is_active?: boolean;
}

// Response types
export interface RoomListResponse {
  data: Room[];
  meta: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

export const roomsApi = {
  // Room CRUD
  getAll: (params?: { 
    page?: number; 
    limit?: number; 
    search?: string;
    room_type?: string;
    room_class?: string;
    is_active?: string;
    building_id?: string;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.append('page', params.page.toString());
    if (params?.limit) searchParams.append('limit', params.limit.toString());
    if (params?.search) searchParams.append('search', params.search);
    if (params?.room_type) searchParams.append('room_type', params.room_type);
    if (params?.room_class) searchParams.append('room_class', params.room_class);
    if (params?.is_active) searchParams.append('is_active', params.is_active);
    if (params?.building_id) searchParams.append('building_id', params.building_id);
    const queryString = searchParams.toString();
    return api.get<RoomListResponse>(`/rooms${queryString ? `?${queryString}` : ''}`);
  },

  // Get rooms assigned to current user (via RoomStaff)
  getMyAssignedRooms: (params?: { service_type?: string; room_type?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.service_type) searchParams.append('service_type', params.service_type);
    if (params?.room_type) searchParams.append('room_type', params.room_type);
    const queryString = searchParams.toString();
    return api.get<{ data: Room[] }>(`/rooms/my-assigned${queryString ? `?${queryString}` : ''}`);
  },
  
  getById: (id: number) =>
    api.get<{ data: Room }>(`/rooms/${id}`),
  
  create: (data: RoomRequest) =>
    api.post<{ data: Room; message: string }>('/rooms', data),
  
  update: (id: number, data: RoomRequest) =>
    api.put<{ data: Room; message: string }>(`/rooms/${id}`, data),
  
  delete: (id: number) =>
    api.delete<{ message: string }>(`/rooms/${id}`),
  
  // Room Units (Kamar)
  getUnits: (roomId: number, params?: { floor?: number; is_active?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.floor) searchParams.append('floor', params.floor.toString());
    if (params?.is_active) searchParams.append('is_active', params.is_active);
    const queryString = searchParams.toString();
    return api.get<{ data: RoomUnit[] }>(`/rooms/${roomId}/units${queryString ? `?${queryString}` : ''}`);
  },
  
  getUnit: (roomId: number, unitId: number) =>
    api.get<{ data: RoomUnit }>(`/rooms/${roomId}/units/${unitId}`),
  
  createUnit: (roomId: number, data: RoomUnitRequest) =>
    api.post<{ data: RoomUnit; message: string }>(`/rooms/${roomId}/units`, data),
  
  updateUnit: (roomId: number, unitId: number, data: RoomUnitRequest) =>
    api.put<{ data: RoomUnit; message: string }>(`/rooms/${roomId}/units/${unitId}`, data),
  
  deleteUnit: (roomId: number, unitId: number) =>
    api.delete<{ message: string }>(`/rooms/${roomId}/units/${unitId}`),
  
  // All Beds for a Room (across all units)
  getAllBeds: (roomId: number) =>
    api.get<{ data: Bed[] }>(`/rooms/${roomId}/beds`),
  
  // Beds for a specific Unit
  getBeds: (roomId: number, unitId: number, params?: { status?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.append('status', params.status);
    const queryString = searchParams.toString();
    return api.get<{ data: Bed[] }>(`/rooms/${roomId}/units/${unitId}/beds${queryString ? `?${queryString}` : ''}`);
  },
  
  createBed: (roomId: number, unitId: number, data: BedRequest) =>
    api.post<{ data: Bed; message: string }>(`/rooms/${roomId}/units/${unitId}/beds`, data),
  
  updateBed: (roomId: number, unitId: number, bedId: number, data: BedRequest) =>
    api.put<{ data: Bed; message: string }>(`/rooms/${roomId}/units/${unitId}/beds/${bedId}`, data),
  
  deleteBed: (roomId: number, unitId: number, bedId: number) =>
    api.delete<{ message: string }>(`/rooms/${roomId}/units/${unitId}/beds/${bedId}`),
  
  // Staff
  getStaff: (roomId: number) =>
    api.get<{ data: RoomStaff[] }>(`/rooms/${roomId}/staff`),
  
  assignStaff: (roomId: number, data: RoomStaffRequest) =>
    api.post<{ data: RoomStaff; message: string }>(`/rooms/${roomId}/staff`, data),
  
  updateStaff: (roomId: number, staffId: number, data: Omit<RoomStaffRequest, 'employee_id'>) =>
    api.put<{ data: RoomStaff; message: string }>(`/rooms/${roomId}/staff/${staffId}`, data),
  
  removeStaff: (roomId: number, staffId: number) =>
    api.delete<{ message: string }>(`/rooms/${roomId}/staff/${staffId}`),

  // Room Schedules (Jadwal Poli)
  getSchedules: (roomId: number) =>
    api.get<{ data: Schedule[]; grouped: Record<string, Schedule[]> }>(`/rooms/${roomId}/schedules`),
  
  createSchedule: (roomId: number, data: Omit<ScheduleRequest, 'room_id'>) =>
    api.post<{ data: Schedule; message: string }>(`/rooms/${roomId}/schedules`, { ...data, room_id: roomId }),
  
  createBulkSchedules: (roomId: number, schedules: Omit<ScheduleRequest, 'room_id'>[]) =>
    api.post<{ data: Schedule[]; message: string }>(`/rooms/${roomId}/schedules/bulk`, { room_id: roomId, schedules }),
  
  updateSchedule: (roomId: number, scheduleId: number, data: Omit<ScheduleRequest, 'room_id'>) =>
    api.put<{ data: Schedule; message: string }>(`/rooms/${roomId}/schedules/${scheduleId}`, data),
  
  deleteSchedule: (roomId: number, scheduleId: number) =>
    api.delete<{ message: string }>(`/rooms/${roomId}/schedules/${scheduleId}`),

  // Doctor Schedules (Jadwal Dokter)
  getDoctorSchedules: (roomId: number) =>
    api.get<{ data: DoctorSchedule[]; grouped: Record<string, DoctorSchedule[]> }>(`/rooms/${roomId}/doctor-schedules`),
  
  createDoctorSchedule: (roomId: number, data: Omit<DoctorScheduleRequest, 'room_id'>) =>
    api.post<{ data: DoctorSchedule; message: string }>(`/rooms/${roomId}/doctor-schedules`, { ...data, room_id: roomId }),
  
  updateDoctorSchedule: (roomId: number, scheduleId: number, data: Omit<DoctorScheduleRequest, 'room_id'>) =>
    api.put<{ data: DoctorSchedule; message: string }>(`/rooms/${roomId}/doctor-schedules/${scheduleId}`, data),
  
  deleteDoctorSchedule: (roomId: number, scheduleId: number) =>
    api.delete<{ message: string }>(`/rooms/${roomId}/doctor-schedules/${scheduleId}`),

  // Room Tariffs (Tarif per Kelas Pasien untuk Rawat Inap)
  getTariffs: (roomId: number) =>
    api.get<{ data: RoomTariff[] }>(`/rooms/${roomId}/tariffs`),
  
  createTariff: (roomId: number, data: RoomTariffRequest) =>
    api.post<{ data: RoomTariff; message: string }>(`/rooms/${roomId}/tariffs`, data),
  
  updateTariff: (roomId: number, tariffId: number, data: RoomTariffRequest) =>
    api.put<{ data: RoomTariff; message: string }>(`/rooms/${roomId}/tariffs/${tariffId}`, data),
  
  deleteTariff: (roomId: number, tariffId: number) =>
    api.delete<{ message: string }>(`/rooms/${roomId}/tariffs/${tariffId}`),
  
  bulkUpdateTariffs: (roomId: number, data: BulkRoomTariffRequest) =>
    api.post<{ data: RoomTariff[]; message: string }>(`/rooms/${roomId}/tariffs/bulk`, data),
};

// Schedule API (general endpoints)
export const schedulesApi = {
  // Get all schedules with filters
  getAll: (params?: { room_id?: number; day_of_week?: number; is_active?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params?.room_id) searchParams.append('room_id', params.room_id.toString());
    if (params?.day_of_week !== undefined) searchParams.append('day_of_week', params.day_of_week.toString());
    if (params?.is_active !== undefined) searchParams.append('is_active', params.is_active.toString());
    const queryString = searchParams.toString();
    return api.get<{ data: Schedule[] }>(`/schedules${queryString ? `?${queryString}` : ''}`);
  },

  // Doctor schedules
  getAllDoctorSchedules: (params?: { room_id?: number; employee_id?: number; day_of_week?: number; is_active?: boolean }) => {
    const searchParams = new URLSearchParams();
    if (params?.room_id) searchParams.append('room_id', params.room_id.toString());
    if (params?.employee_id) searchParams.append('employee_id', params.employee_id.toString());
    if (params?.day_of_week !== undefined) searchParams.append('day_of_week', params.day_of_week.toString());
    if (params?.is_active !== undefined) searchParams.append('is_active', params.is_active.toString());
    const queryString = searchParams.toString();
    return api.get<{ data: DoctorSchedule[] }>(`/doctor-schedules${queryString ? `?${queryString}` : ''}`);
  },

  // Get available doctors for a room on a specific date
  getAvailableDoctorsByDate: (roomId: number, date: string) =>
    api.get<{
      data: Array<{
        employee_id: number;
        employee_name: string;
        start_time: string;
        end_time: string;
        max_patients: number;
        consult_fee: number;
      }>;
      room: { id: number; name: string; code: string };
      date: string;
      day_of_week: number;
      room_closed: boolean;
    }>(`/schedules/available-doctors?room_id=${roomId}&date=${date}`),

  // Schedule exceptions
  getExceptions: (params?: { room_id?: number; employee_id?: number; start_date?: string; end_date?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.room_id) searchParams.append('room_id', params.room_id.toString());
    if (params?.employee_id) searchParams.append('employee_id', params.employee_id.toString());
    if (params?.start_date) searchParams.append('start_date', params.start_date);
    if (params?.end_date) searchParams.append('end_date', params.end_date);
    const queryString = searchParams.toString();
    return api.get<{ data: ScheduleException[] }>(`/schedule-exceptions${queryString ? `?${queryString}` : ''}`);
  },

  createException: (data: ScheduleExceptionRequest) =>
    api.post<{ data: ScheduleException; message: string }>('/schedule-exceptions', data),

  deleteException: (id: number) =>
    api.delete<{ message: string }>(`/schedule-exceptions/${id}`),
};

// Helper functions
export const getDayName = (dayOfWeek: number): string => {
  const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  return days[dayOfWeek] || '';
};

export const getDayShortName = (dayOfWeek: number): string => {
  const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  return days[dayOfWeek] || '';
};
