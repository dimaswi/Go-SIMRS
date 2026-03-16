import type { ClinicalPackage } from '@/lib/api/clinical-packages';
import type { RoomMedicine } from '@/lib/api/medicines';
import type { RoomProcedure } from '@/lib/api/procedures';

export interface RegistrationProcedureSelection {
  procedure_id: number;
  target_room_id?: number;
  notes: string;
}

export interface RegistrationMedicineSelection {
  medicine_id: number;
  pharmacy_room_id?: number;
  quantity: number;
  unit: string;
  dosage: string;
  frequency: string;
  route: string;
  duration: string;
  instructions: string;
  notes: string;
}

export function mapClinicalPackageToRegistrationSelections(pkg?: ClinicalPackage | null): {
  procedures: RegistrationProcedureSelection[];
  medicines: RegistrationMedicineSelection[];
} {
  if (!pkg) {
    return { procedures: [], medicines: [] };
  }

  return {
    procedures: (pkg.procedure_items || []).map((item) => ({
      procedure_id: item.procedure_id,
      notes: item.notes || '',
    })),
    medicines: (pkg.medicine_items || []).map((item) => ({
      medicine_id: item.medicine_id,
      quantity: Number(item.quantity || 1),
      unit: item.unit || item.medicine?.unit || '',
      dosage: item.dosage || item.medicine?.dosage || '',
      frequency: item.frequency || '',
      route: item.route || '',
      duration: item.duration || '',
      instructions: item.instructions || '',
      notes: item.notes || '',
    })),
  };
}

export function mergeRoomProceduresWithClinicalPackage(roomProcedures: RoomProcedure[], pkg?: ClinicalPackage | null): RoomProcedure[] {
  if (!pkg?.procedure_items?.length) {
    return roomProcedures;
  }

  const existing = new Set(roomProcedures.map((item) => item.procedure_id));
  const synthetic = pkg.procedure_items
    .filter((item) => item.procedure && !existing.has(item.procedure_id))
    .map((item, index) => ({
      id: -(index + 1),
      created_at: '',
      updated_at: '',
      room_id: 0,
      procedure_id: item.procedure_id,
      procedure: item.procedure,
      is_available: true,
      max_per_day: 0,
      requires_booking: false,
      notes: item.notes || 'Paket klinis',
    }));

  return [...roomProcedures, ...synthetic];
}

export function mergeRoomMedicinesWithClinicalPackage(roomMedicines: RoomMedicine[], pkg?: ClinicalPackage | null): RoomMedicine[] {
  if (!pkg?.medicine_items?.length) {
    return roomMedicines;
  }

  const existing = new Set(roomMedicines.map((item) => item.medicine_id));
  const synthetic = pkg.medicine_items
    .filter((item) => item.medicine && !existing.has(item.medicine_id))
    .map((item, index) => ({
      id: -(index + 1),
      created_at: '',
      updated_at: '',
      room_id: 0,
      medicine_id: item.medicine_id,
      medicine: item.medicine,
      quantity: Math.max(item.quantity || 1, 1),
      min_quantity: 0,
      notes: item.notes || 'Paket klinis',
    }));

  return [...roomMedicines, ...synthetic];
}