import { api } from './client';

// Types
export interface StockRequest {
  id: number;
  created_at: string;
  updated_at: string;
  request_number: string;
  request_type: 'inventory' | 'medicine';
  from_room_id: number;
  from_room?: Room;
  to_room_id: number;
  to_room?: Room;
  status: StockRequestStatus;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  request_date: string;
  required_date?: string;
  approved_date?: string;
  completed_date?: string;
  requested_by_id: number;
  requested_by?: User;
  approved_by_id?: number;
  approved_by?: User;
  completed_by_id?: number;
  completed_by?: User;
  reason?: string;
  rejection_reason?: string;
  notes?: string;
  items: StockRequestItem[];
}

export interface StockRequestItem {
  id: number;
  stock_request_id: number;
  inventory_id?: number;
  inventory?: {
    id: number;
    code: string;
    name: string;
    unit: string;
    current_stock: number;
  };
  medicine_id?: number;
  medicine?: {
    id: number;
    code: string;
    name: string;
    unit: string;
    current_stock: number;
  };
  quantity_requested: number;
  quantity_approved: number;
  quantity_fulfilled: number;
  unit: string;
  notes?: string;
}

export interface StockDistribution {
  id: number;
  created_at: string;
  updated_at: string;
  distribution_number: string;
  stock_request_id?: number;
  stock_request?: StockRequest;
  from_room_id: number;
  from_room?: Room;
  to_room_id: number;
  to_room?: Room;
  distribution_date: string;
  distributed_by_id: number;
  distributed_by?: User;
  received_by_id?: number;
  received_by?: User;
  received_date?: string;
  status: 'pending' | 'delivered' | 'received';
  notes?: string;
  items: StockDistributionItem[];
}

export interface StockDistributionItem {
  id: number;
  stock_distribution_id: number;
  stock_request_item_id?: number;
  inventory_id?: number;
  inventory?: {
    id: number;
    code: string;
    name: string;
    unit: string;
  };
  medicine_id?: number;
  medicine?: {
    id: number;
    code: string;
    name: string;
    unit: string;
  };
  batch_number?: string;
  expiry_date?: string;
  quantity: number;
  unit: string;
  notes?: string;
}

interface Room {
  id: number;
  code: string;
  name: string;
  room_type: string;
}

interface User {
  id: number;
  username: string;
  full_name: string;
}

export type StockRequestStatus = 
  | 'draft'
  | 'pending' 
  | 'approved' 
  | 'rejected' 
  | 'partial' 
  | 'completed' 
  | 'cancelled';

// Status Labels
export const stockRequestStatusLabels: Record<StockRequestStatus, string> = {
  draft: 'Draft',
  pending: 'Menunggu',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  partial: 'Disetujui Sebagian',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

export const priorityLabels: Record<string, string> = {
  low: 'Rendah',
  normal: 'Normal',
  high: 'Tinggi',
  urgent: 'Mendesak',
};

export const requestTypeLabels: Record<string, string> = {
  inventory: 'Barang Inventaris',
  medicine: 'Obat/Farmasi',
};

// API Functions
export const stockRequestsApi = {
  // List all stock requests
  getAll: (params?: {
    page?: number;
    limit?: number;
    request_type?: string;
    status?: string;
    from_room_id?: number;
    to_room_id?: number;
  }) => api.get('/stock-requests', { params }),

  // Get single stock request
  getById: (id: number) => api.get(`/stock-requests/${id}`),

  // Create new stock request
  create: (data: {
    request_type: 'inventory' | 'medicine';
    from_room_id: number;
    to_room_id: number;
    priority?: string;
    required_date?: string;
    reason?: string;
    notes?: string;
    items: {
      inventory_id?: number;
      medicine_id?: number;
      quantity_requested: number;
      unit?: string;
      notes?: string;
    }[];
  }) => api.post('/stock-requests', data),

  // Update stock request (only draft or pending)
  update: (id: number, data: {
    priority?: string;
    required_date?: string;
    reason?: string;
    notes?: string;
  }) => api.put(`/stock-requests/${id}`, data),

  // Delete stock request (only draft/pending/cancelled)
  delete: (id: number) => api.delete(`/stock-requests/${id}`),

  // Submit stock request for approval (draft → pending)
  submit: (id: number) => api.post(`/stock-requests/${id}/submit`),

  // Approve stock request
  approve: (id: number, data: {
    items: { id: number; quantity_approved: number }[];
    notes?: string;
  }) => api.post(`/stock-requests/${id}/approve`, data),

  // Reject stock request
  reject: (id: number, data: { rejection_reason: string }) => 
    api.post(`/stock-requests/${id}/reject`, data),

  // Cancel stock request
  cancel: (id: number) => api.post(`/stock-requests/${id}/cancel`),

  // Get my requests (user's requests)
  getMyRequests: () => api.get('/stock-requests/my-requests'),

  // Get pending approvals (for depo)
  getPendingApprovals: (toRoomId?: number) => 
    api.get('/stock-requests/pending-approvals', { params: { to_room_id: toRoomId } }),
};

// Distribution API
export const distributionsApi = {
  // List all distributions
  getAll: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    from_room_id?: number;
    to_room_id?: number;
  }) => api.get('/distributions', { params }),

  // Get single distribution
  getById: (id: number) => api.get(`/distributions/${id}`),

  // Create distribution
  create: (data: {
    stock_request_id?: number;
    from_room_id: number;
    to_room_id: number;
    notes?: string;
    items: {
      stock_request_item_id?: number;
      inventory_id?: number;
      medicine_id?: number;
      batch_number?: string;
      expiry_date?: string;
      quantity: number;
      unit?: string;
      notes?: string;
    }[];
  }) => api.post('/distributions', data),

  // Update distribution (only pending)
  update: (id: number, data: {
    notes?: string;
    items?: {
      id?: number;
      inventory_id?: number;
      medicine_id?: number;
      batch_number?: string;
      expiry_date?: string;
      quantity: number;
      unit?: string;
      notes?: string;
    }[];
  }) => api.put(`/distributions/${id}`, data),

  // Receive distribution
  receive: (id: number, data?: { notes?: string }) => 
    api.post(`/distributions/${id}/receive`, data),
};

// Purchase Types
export interface Purchase {
  id: number;
  created_at: string;
  updated_at: string;
  purchase_number: string;
  supplier_id?: number;
  supplier?: {
    id: number;
    code: string;
    name: string;
    phone?: string;
    email?: string;
  };
  supplier_name: string;
  supplier_contact?: string;
  to_room_id: number;
  to_room?: Room;
  order_date?: string;
  expected_date?: string;
  received_date?: string;
  status: 'draft' | 'pending' | 'ordered' | 'partial' | 'received' | 'cancelled';
  total_amount: number;
  notes?: string;
  created_by_id: number;
  created_by?: User;
  received_by_id?: number;
  received_by?: User;
  items: PurchaseItem[];
}

export interface PurchaseItem {
  id: number;
  purchase_id: number;
  inventory_id?: number;
  inventory?: {
    id: number;
    code: string;
    name: string;
    unit: string;
  };
  medicine_id?: number;
  medicine?: {
    id: number;
    code: string;
    name: string;
    unit: string;
  };
  quantity_ordered: number;
  quantity_received: number;
  unit_price: number;
  total_price: number;
  batch_number?: string;
  expiry_date?: string;
  unit: string;
  notes?: string;
}

export const purchaseStatusLabels: Record<string, string> = {
  draft: 'Draft',
  pending: 'Menunggu',
  ordered: 'Dipesan',
  partial: 'Diterima Sebagian',
  received: 'Diterima',
  cancelled: 'Dibatalkan',
};

// Purchase API
export const purchasesApi = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    to_room_id?: number;
  }) => api.get('/purchases', { params }),

  getById: (id: number) => api.get(`/purchases/${id}`),

  create: (data: {
    supplier_name: string;
    supplier_contact?: string;
    to_room_id: number;
    notes?: string;
    items: {
      inventory_id?: number;
      medicine_id?: number;
      quantity_ordered: number;
      unit_price: number;
      unit?: string;
      notes?: string;
    }[];
  }) => api.post('/purchases', data),

  update: (id: number, data: {
    supplier_name?: string;
    supplier_contact?: string;
    notes?: string;
  }) => api.put(`/purchases/${id}`, data),

  delete: (id: number) => api.delete(`/purchases/${id}`),

  submit: (id: number) => api.post(`/purchases/${id}/submit`),

  approve: (id: number) => api.post(`/purchases/${id}/approve`),

  receive: (id: number, data: {
    items: {
      id: number;
      quantity_received: number;
      batch_number?: string;
      expiry_date?: string;
    }[];
    notes?: string;
  }) => api.post(`/purchases/${id}/receive`, data),

  cancel: (id: number) => api.post(`/purchases/${id}/cancel`),
};

// Stock Opname Types
export interface StockOpname {
  id: number;
  created_at: string;
  updated_at: string;
  opname_number: string;
  room_id: number;
  room?: Room;
  opname_date: string;
  status: 'draft' | 'in_progress' | 'completed' | 'approved';
  notes?: string;
  created_by_id: number;
  created_by?: User;
  approved_by_id?: number;
  approved_by?: User;
  approved_date?: string;
  items: StockOpnameItem[];
}

export interface StockOpnameItem {
  id: number;
  stock_opname_id: number;
  inventory_id?: number;
  inventory?: {
    id: number;
    code: string;
    name: string;
    unit: string;
    current_stock: number;
  };
  medicine_id?: number;
  medicine?: {
    id: number;
    code: string;
    name: string;
    unit: string;
    current_stock: number;
  };
  system_stock: number;
  physical_stock: number;
  difference: number;
  unit: string;
  notes?: string;
}

export const stockOpnameStatusLabels: Record<string, string> = {
  draft: 'Draft',
  in_progress: 'Sedang Berjalan',
  completed: 'Selesai',
  approved: 'Disetujui',
};

// Room Stock Item for stock opname
export interface RoomStockItem {
  id: number;
  item_type: 'inventory' | 'medicine';
  inventory_id?: number;
  medicine_id?: number;
  code: string;
  name: string;
  unit: string;
  system_stock: number;
  category?: string;
}

// Stock Opname API
export const stockOpnameApi = {
  getAll: (params?: {
    page?: number;
    limit?: number;
    status?: string;
    room_id?: number;
  }) => api.get('/stock-opname', { params }),

  getById: (id: number) => api.get(`/stock-opname/${id}`),

  // Get room stock for opname (inventory and medicine in a specific room)
  getRoomStock: (roomId: number, type?: 'inventory' | 'medicine') =>
    api.get<{ data: RoomStockItem[] }>(`/stock-opname/room-stock/${roomId}`, { params: { type } }),

  create: (data: {
    room_id: number;
    notes?: string;
    items: {
      inventory_id?: number;
      medicine_id?: number;
      system_stock: number;
      physical_stock: number;
      unit?: string;
      notes?: string;
    }[];
  }) => api.post('/stock-opname', data),

  update: (id: number, data: {
    notes?: string;
    items?: {
      id?: number;
      inventory_id?: number;
      medicine_id?: number;
      physical_stock: number;
      notes?: string;
    }[];
  }) => api.put(`/stock-opname/${id}`, data),

  complete: (id: number) => api.post(`/stock-opname/${id}/complete`),

  approve: (id: number, data?: { notes?: string }) => 
    api.post(`/stock-opname/${id}/approve`, data),

  delete: (id: number) => api.delete(`/stock-opname/${id}`),
};
