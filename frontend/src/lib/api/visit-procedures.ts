import { api } from './client';
import type { ProcedureParameter } from './procedures';

// ===========================================================================
// VISIT PROCEDURES INTERFACES
// Tindakan yang dilakukan langsung di ruangan visit (bukan order)
// ===========================================================================

export interface RoomProcedureForVisit {
  id: number;
  code: string;
  name: string;
  description: string;
  procedure_type: string;
  duration: number;
  requires_booking: boolean;
  max_per_day: number;
  parameters: ProcedureParameter[];
  has_parameters: boolean;
}

export interface VisitProcedureResult {
  id: number;
  created_at: string;
  updated_at: string;
  visit_procedure_id: number;
  parameter_id: number;
  parameter?: ProcedureParameter;
  value: string;
  num_value: number;
  is_abnormal: boolean;
  is_critical: boolean;
  filled_by_id?: number;
  filled_by?: {
    id: number;
    username: string;
    full_name: string;
  };
}

export interface VisitProcedure {
  id: number;
  created_at: string;
  updated_at: string;
  visit_id: number;
  procedure_id: number;
  procedure?: {
    id: number;
    code: string;
    name: string;
    description: string;
    procedure_type: string;
    duration: number;
    parameters?: ProcedureParameter[];
  };
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  performed_at?: string;
  notes?: string;
  created_by_id?: number;
  created_by?: {
    id: number;
    username: string;
    full_name: string;
  };
  filled_by_id?: number;
  filled_by?: {
    id: number;
    username: string;
    full_name: string;
  };
  results?: VisitProcedureResult[];
  
  // Discount Info
  discount_type?: string;
  discount_value?: number;
  discount_amount?: number;
  discount_note?: string;
}

export interface CreateVisitProcedureInput {
  procedure_id: number;
  notes?: string;
}

export interface SaveVisitProcedureResultsInput {
  status?: string;
  notes?: string;
  results: {
    parameter_id: number;
    value: string;
    num_value?: number;
    is_abnormal?: boolean;
    is_critical?: boolean;
  }[];
  // Discount Info
  discount_type?: string;
  discount_value?: number;
  discount_amount?: number;
  discount_note?: string;
}

export interface UpdateVisitProcedureStatusInput {
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
}

// ===========================================================================
// VISIT PROCEDURES API
// ===========================================================================

export const visitProceduresApi = {
  // Get procedures available for the visit's room
  getRoomProcedures: (visitId: number) => 
    api.get<{ data: RoomProcedureForVisit[] }>(`/visits/${visitId}/room-procedures`),
  
  // Get all procedures performed during a visit
  getAll: (visitId: number) => 
    api.get<{ data: VisitProcedure[] }>(`/visits/${visitId}/procedures`),
  
  // Get single visit procedure with details
  getById: (visitId: number, procedureId: number) => 
    api.get<{ data: VisitProcedure }>(`/visits/${visitId}/procedures/${procedureId}`),
  
  // Add a procedure to a visit
  create: (visitId: number, data: CreateVisitProcedureInput) => 
    api.post<{ data: VisitProcedure }>(`/visits/${visitId}/procedures`, data),
  
  // Save/update results for a visit procedure
  saveResults: (visitId: number, procedureId: number, data: SaveVisitProcedureResultsInput) => 
    api.put<{ data: VisitProcedure }>(`/visits/${visitId}/procedures/${procedureId}`, data),
  
  // Update status only
  updateStatus: (visitId: number, procedureId: number, data: UpdateVisitProcedureStatusInput) => 
    api.put<{ data: VisitProcedure }>(`/visits/${visitId}/procedures/${procedureId}/status`, data),
  
  // Delete a visit procedure (only if pending)
  delete: (visitId: number, procedureId: number) => 
    api.delete(`/visits/${visitId}/procedures/${procedureId}`),
};

// ===========================================================================
// CONSTANTS & HELPERS
// ===========================================================================

export const VISIT_PROCEDURE_STATUS = {
  pending: { label: 'Menunggu', color: 'bg-yellow-100 text-yellow-800' },
  in_progress: { label: 'Dikerjakan', color: 'bg-blue-100 text-blue-800' },
  completed: { label: 'Selesai', color: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Dibatalkan', color: 'bg-red-100 text-red-800' },
} as const;

export function getVisitProcedureStatusLabel(status: string): string {
  return VISIT_PROCEDURE_STATUS[status as keyof typeof VISIT_PROCEDURE_STATUS]?.label || status;
}

export function getVisitProcedureStatusColor(status: string): string {
  return VISIT_PROCEDURE_STATUS[status as keyof typeof VISIT_PROCEDURE_STATUS]?.color || 'bg-gray-100 text-gray-800';
}
