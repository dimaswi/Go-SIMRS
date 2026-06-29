import { api } from './client';

export interface CashierShift {
  id: number;
  cashier_id: number;
  cashier?: {
    id: number;
    nama_lengkap: string;
  };
  start_time: string;
  end_time?: string;
  opening_balance: number;
  closing_balance: number;
  actual_balance: number;
  status: string;
  notes: string;
}

export const cashierShiftApi = {
  getCurrent: async (): Promise<CashierShift | null> => {
    const { data } = await api.get('/cashier-shifts/current');
    return data.data; // Server returns { data: shift } or { data: null }
  },

  openShift: async (payload: { opening_balance: number; notes?: string }): Promise<CashierShift> => {
    const { data } = await api.post('/cashier-shifts/open', payload);
    return data.data;
  },

  closeShift: async (payload: { actual_balance: number; notes?: string }): Promise<CashierShift> => {
    const { data } = await api.post('/cashier-shifts/close', payload);
    return data.data;
  },
};
