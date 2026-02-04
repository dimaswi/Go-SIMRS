import { api } from './client';

// Archive Status Types
export type ArchiveStatus = 'active' | 'inactive' | 'archived' | 'destroyed';
export type ArchiveLocation = 'active_storage' | 'inactive_storage' | 'digital' | 'offsite';

// Archive Interface
export interface MedicalRecordArchive {
  id: number;
  patient_id: number;
  patient?: {
    id: number;
    no_rm: string;
    nama_lengkap: string;
    tanggal_lahir?: string;
    jenis_kelamin?: string;
  };
  no_rm: string;
  status: ArchiveStatus;
  location: ArchiveLocation;
  location_code?: string;
  shelf_number?: string;
  box_number?: string;
  folder_color?: string;
  total_documents: number;
  total_pages: number;
  total_volumes: number;
  last_visit_date?: string;
  last_access_date?: string;
  total_visits: number;
  inactivity_months: number;
  retention_years: number;
  retention_start_date?: string;
  scheduled_archive_date?: string;
  scheduled_destroy_date?: string;
  is_digitized: boolean;
  digital_path?: string;
  digital_size?: number;
  digitized_at?: string;
  digitized_by?: { id: number; name: string };
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

// Archive Movement Interface
export interface ArchiveMovement {
  id: number;
  archive_id: number;
  archive?: MedicalRecordArchive;
  no_rm: string;
  movement_type: 'borrow' | 'return' | 'transfer' | 'archive' | 'retrieve';
  borrowed_by_id?: number;
  borrowed_by?: { id: number; name: string };
  borrowed_by_name?: string;
  borrow_reason?: string;
  borrowed_at: string;
  due_date?: string;
  returned_at?: string;
  from_location?: ArchiveLocation;
  from_location_code?: string;
  to_location?: ArchiveLocation;
  to_location_code?: string;
  status: 'active' | 'returned' | 'overdue' | 'completed';
  processed_by?: { id: number; name: string };
  notes?: string;
  created_at?: string;
}

// Archive Destruction Interface
export interface ArchiveDestruction {
  id: number;
  batch_number: string;
  destruction_date: string;
  destruction_type: 'shredding' | 'incineration' | 'digital_deletion';
  total_records: number;
  proposed_by?: { id: number; name: string };
  proposed_at: string;
  approved_by?: { id: number; name: string };
  approved_at?: string;
  executed_by?: { id: number; name: string };
  executed_at?: string;
  witness1_name?: string;
  witness1_role?: string;
  witness2_name?: string;
  witness2_role?: string;
  status: 'proposed' | 'approved' | 'executed' | 'cancelled';
  berita_acara_number?: string;
  berita_acara_path?: string;
  notes?: string;
  created_at?: string;
}

// Archive Statistics
export interface ArchiveStatistics {
  total_records: number;
  active_records: number;
  inactive_records: number;
  archived_records: number;
  digitized_records: number;
  borrowed_records: number;
  overdue_records: number;
  due_for_archival: number;
  due_for_destruction: number;
}

// API Functions
export const archivesApi = {
  // Get all archives with pagination and filters
  getAll: async (params?: {
    page?: number;
    limit?: number;
    status?: ArchiveStatus;
    location?: ArchiveLocation;
    search?: string;
    is_digitized?: boolean;
    overdue_only?: boolean;
  }) => {
    return api.get<{
      data: MedicalRecordArchive[];
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    }>('/archives', { params });
  },

  // Get single archive by ID
  getById: async (id: number) => {
    return api.get<MedicalRecordArchive>(`/archives/${id}`);
  },

  // Get archive by patient ID
  getByPatient: async (patientId: number) => {
    return api.get<MedicalRecordArchive>(`/archives/patient/${patientId}`);
  },

  // Create or update archive
  save: async (data: Partial<MedicalRecordArchive>) => {
    return api.post<MedicalRecordArchive>('/archives', data);
  },

  // Update archive location
  updateLocation: async (id: number, data: {
    location: ArchiveLocation;
    location_code?: string;
    shelf_number?: string;
    box_number?: string;
    notes?: string;
  }) => {
    return api.put(`/archives/${id}/location`, data);
  },

  // Borrow archive
  borrow: async (id: number, data: {
    borrowed_by_id?: number;
    borrowed_by_name?: string;
    borrow_reason?: string;
    due_days?: number;
    notes?: string;
  }) => {
    return api.post<ArchiveMovement>(`/archives/${id}/borrow`, data);
  },

  // Return archive
  return: async (id: number, data: {
    movement_id: number;
    notes?: string;
  }) => {
    return api.post(`/archives/${id}/return`, data);
  },

  // Get movement history
  getMovements: async (id: number) => {
    return api.get<ArchiveMovement[]>(`/archives/${id}/movements`);
  },

  // Get all borrowed archives
  getBorrowed: async (overdueOnly?: boolean) => {
    return api.get<ArchiveMovement[]>('/archives/borrowed', {
      params: { overdue_only: overdueOnly },
    });
  },

  // Get statistics
  getStatistics: async () => {
    return api.get<ArchiveStatistics>('/archives/statistics');
  },

  // Sync archives from visits (maintenance)
  sync: async () => {
    return api.post('/archives/sync');
  },
};

// Destruction API
export const archiveDestructionsApi = {
  // Get all destruction batches
  getAll: async (status?: string) => {
    return api.get<ArchiveDestruction[]>('/archives/destructions', {
      params: { status },
    });
  },

  // Propose destruction
  propose: async (data: {
    destruction_date: string;
    destruction_type: string;
    archive_ids: number[];
    notes?: string;
  }) => {
    return api.post<ArchiveDestruction>('/archives/destructions', data);
  },

  // Approve destruction
  approve: async (id: number) => {
    return api.put(`/archives/destructions/${id}/approve`);
  },

  // Execute destruction
  execute: async (id: number, data: {
    witness1_name?: string;
    witness1_role?: string;
    witness2_name?: string;
    witness2_role?: string;
    berita_acara_number?: string;
  }) => {
    return api.put(`/archives/destructions/${id}/execute`, data);
  },

  // Get destruction items
  getItems: async (id: number) => {
    return api.get(`/archives/destructions/${id}/items`);
  },
};
