import { api } from './client';

export interface RoomQueue {
  id: number;
  queue_number: string;
  queue_code: string;
  queue_date: string;
  visit_id: number;
  room_id: number;
  priority: 'normal' | 'urgent' | 'emergency';
  status: 'waiting' | 'called' | 'serving' | 'completed' | 'skipped' | 'cancelled';
  called_at?: string;
  called_by_id?: number;
  served_at?: string;
  completed_at?: string;
  estimated_wait_time?: number;
  notes?: string;
  visit?: any;
  room?: any;
  called_by?: any;
  created_at: string;
  updated_at: string;
}

export interface RoomQueueStats {
  total_queues: number;
  waiting_queues: number;
  called_queues: number;
  serving_queues: number;
  completed_queues: number;
  skipped_queues: number;
  cancelled_queues: number;
  average_wait_time_minutes: number;
}

export interface CreateRoomQueueRequest {
  visit_id: number;
  priority?: string;
  notes?: string;
}

export interface UpdateQueueStatusRequest {
  status: string;
  notes?: string;
}

export const roomQueuesApi = {
  // Get all room queues with filters
  getAll: async (params?: {
    room_id?: number;
    date?: string;
    status?: string;
  }) => {
    return api.get<RoomQueue[]>('/room-queues', { params });
  },

  // Get specific room queue
  getById: async (id: number) => {
    return api.get<RoomQueue>(`/room-queues/${id}`);
  },

  // Create new room queue
  create: async (data: CreateRoomQueueRequest) => {
    return api.post<RoomQueue>('/room-queues', data);
  },

  // Update queue status
  updateStatus: async (id: number, data: UpdateQueueStatusRequest) => {
    return api.put<RoomQueue>(`/room-queues/${id}/status`, data);
  },

  // Call specific queue
  callQueue: async (id: number) => {
    return api.put<RoomQueue>(`/room-queues/${id}/call`);
  },

  // Call next queue in room
  callNext: async (roomId: number) => {
    return api.post<RoomQueue>(`/room-queues/room/${roomId}/call-next`);
  },

  // Get room queue statistics
  getStats: async (roomId: number, date?: string) => {
    return api.get<RoomQueueStats>(`/room-queues/room/${roomId}/stats`, { params: { date } });
  },

  // Get current active queue for room
  getCurrent: async (roomId: number) => {
    return api.get<RoomQueue>(`/room-queues/room/${roomId}/current`);
  },
};
