import { api } from './client';

// ===========================================================================
// TYPES
// ===========================================================================

export interface Building {
  id: number;
  code: string;
  name: string;
  total_floors: number;
  description?: string;
  color?: string;
  is_active: boolean;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  // Computed stats
  total_rooms?: number;
  total_beds?: number;
  available_beds?: number;
  created_at: string;
  updated_at: string;
}

export interface FloorPlanBed {
  id: number;
  bed_number: string;
  bed_type: string;
  status: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
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
}

export interface FloorPlanUnit {
  id: number;
  code: string;
  name: string;
  floor: number;
  capacity: number;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  beds: FloorPlanBed[];
}

export interface FloorPlanRoom {
  id: number;
  code: string;
  name: string;
  service_type: string;
  room_type: string;
  room_class: string;
  total_floors: number;
  units: FloorPlanUnit[];
}

export interface FloorPlanBuilding {
  id: number;
  code: string;
  name: string;
  total_floors: number;
  color: string;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
  rooms: FloorPlanRoom[];
}

export interface LayoutItem {
  id: number;
  position_x: number;
  position_y: number;
  width: number;
  height: number;
}

export interface SaveLayoutPayload {
  buildings?: LayoutItem[];
  units?: LayoutItem[];
  beds?: LayoutItem[];
}

// ===========================================================================
// BEDSIDE SUMMARY TYPES
// ===========================================================================

export interface BedsidePatientAllergy {
  id: number;
  patient_id: number;
  visit_id?: number;
  snomed_code: string;
  snomed_display: string;
  category: string;
  criticality: string;
  notes?: string;
  onset_date?: string;
  recorded_at: string;
  is_active: boolean;
}

export interface BedsideDiagnosis {
  id: number;
  type: string;
  icd_code: string;
  icd_description?: string;
  description: string;
}

export interface BedsideCPPT {
  id: number;
  record_date: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  planning?: string;
  instruction?: string;
  profession?: string;
  created_at: string;
  created_by?: { id: number; name: string };
}

export interface BedsideVitalSign {
  id: number;
  heart_rate?: number;
  systolic_bp?: number;
  diastolic_bp?: number;
  temperature?: number;
  respiratory_rate?: number;
  oxygen_saturation?: number;
  gcs_eye?: number;
  gcs_verbal?: number;
  gcs_motor?: number;
  measured_at: string;
}

export interface BedsideMedicineOrderItem {
  id: number;
  medicine?: { id: number; name: string; code?: string };
  dosage?: string;
  frequency?: string;
  route?: string;
  duration?: string;
  quantity?: number;
  instructions?: string;
}

export interface BedsideMedicineOrder {
  id: number;
  status: string;
  prescriber?: { id: number; name: string };
  items: BedsideMedicineOrderItem[];
  created_at: string;
}

export interface BedsideProcedureResult {
  id: number;
  result_value?: string;
  result_text?: string;
  unit?: string;
  reference_range?: string;
  is_abnormal?: boolean;
}

export interface BedsideProcedureOrderItem {
  id: number;
  procedure?: { id: number; name: string; code?: string; category?: string };
  results?: BedsideProcedureResult[];
}

export interface BedsideProcedureOrder {
  id: number;
  status: string;
  items: BedsideProcedureOrderItem[];
  created_at: string;
}

export interface BedsideVisit {
  id: number;
  visit_number?: string;
  admission_time?: string;
  registration?: {
    id: number;
    patient?: {
      id: number;
      nama_lengkap?: string;
      no_rekam_medis?: string;
      nik?: string;
      jenis_kelamin?: string;
      tanggal_lahir?: string;
      alamat?: string;
      no_telepon?: string;
      jenis_jaminan?: string;
      no_jaminan?: string;
    };
  };
  room?: {
    id: number;
    name: string;
    code?: string;
    service_type?: string;
  };
  doctor?: {
    id: number;
    name: string;
  };
  bed?: {
    id: number;
    bed_number: string;
    room_unit?: {
      id: number;
      name: string;
      room?: { id: number; name: string };
    };
  };
}

export interface BedsideSummary {
  visit: BedsideVisit;
  allergies: BedsidePatientAllergy[];
  diagnoses: BedsideDiagnosis[];
  cppts: BedsideCPPT[];
  medicine_orders: BedsideMedicineOrder[];
  procedure_orders: BedsideProcedureOrder[];
  fluid_balance: {
    records: any[];
    total_intake: number;
    total_output: number;
    balance: number;
  };
  latest_vitals: BedsideVitalSign | null;
  vital_trend: BedsideVitalSign[];
  anamnesis: any;
  assessment_plan: any;
  days_of_stay: number;
}

// ===========================================================================
// API
// ===========================================================================

export const buildingsApi = {
  // CRUD
  getAll: (params?: { search?: string; is_active?: boolean }) =>
    api.get<{ data: Building[] }>('/buildings', { params }),
  getById: (id: number) =>
    api.get<{ data: Building }>(`/buildings/${id}`),
  create: (data: Partial<Building>) =>
    api.post<{ data: Building; message: string }>('/buildings', data),
  update: (id: number, data: Partial<Building>) =>
    api.put<{ data: Building; message: string }>(`/buildings/${id}`, data),
  delete: (id: number) =>
    api.delete<{ message: string }>(`/buildings/${id}`),

  // Room assignment
  assignRoom: (buildingId: number, roomId: number, floor?: number) =>
    api.post<{ data: any; message: string }>(`/buildings/${buildingId}/rooms`, { room_id: roomId, floor: floor || 1 }),
  unassignRoom: (buildingId: number, roomId: number) =>
    api.delete<{ message: string }>(`/buildings/${buildingId}/rooms/${roomId}`),
  getRooms: (buildingId: number, params?: { floor?: number; has_bed?: boolean }) =>
    api.get<{ data: any[] }>(`/buildings/${buildingId}/rooms`, { params }),
};

export const floorPlanApi = {
  // Layout
  getLayout: (params?: { building_id?: number; floor?: number }) =>
    api.get<{ data: FloorPlanBuilding[] }>('/floor-plan/layout', { params }),
  saveLayout: (data: SaveLayoutPayload) =>
    api.put<{ message: string }>('/floor-plan/layout', data),
};

export const bedsideApi = {
  getSummary: (visitId: number) =>
    api.get<{ data: BedsideSummary }>(`/visits/${visitId}/bedside-summary`),
};
