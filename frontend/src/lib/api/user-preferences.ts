import { api } from './client';

export interface MedicalRecordTabPreference {
  mode: string;
  tab_order: string[];
}

export const userPreferencesApi = {
  getMedicalRecordTabs: (mode: string) =>
    api.get<MedicalRecordTabPreference>('/auth/preferences/medical-record-tabs', {
      params: { mode },
    }),

  saveMedicalRecordTabs: (mode: string, tabOrder: string[]) =>
    api.put<MedicalRecordTabPreference>('/auth/preferences/medical-record-tabs', {
      mode,
      tab_order: tabOrder,
    }),
};
