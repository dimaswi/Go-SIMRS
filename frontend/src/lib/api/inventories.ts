import { api } from './client';

// Types
export interface Inventory {
  id: number;
  created_at: string;
  updated_at: string;
  code: string;
  name: string;
  description?: string;
  category: InventoryCategory;
  unit: string;
  brand?: string;
  model?: string;
  min_stock: number;
  max_stock: number;
  current_stock: number;
  price: number;
  total_value: number;
  is_consumable: boolean;
  is_reusable: boolean;
  require_serial: boolean;
  is_active: boolean;
  specifications?: string;
  notes?: string;
  image_url?: string;
  items?: InventoryItem[];
}

export interface InventoryItem {
  id: number;
  created_at: string;
  updated_at: string;
  inventory_id: number;
  inventory?: Inventory;
  serial_number?: string;
  asset_number?: string;
  barcode?: string;
  condition: InventoryCondition;
  status: InventoryStatus;
  purchase_date?: string;
  purchase_price?: number;
  supplier?: string;
  warranty_end?: string;
  room_id?: number;
  room?: Room;
  room_unit_id?: number;
  room_unit?: RoomUnit;
  location?: string;
  last_maintenance_date?: string;
  next_maintenance_date?: string;
  notes?: string;
}

export interface RoomInventory {
  id: number;
  created_at: string;
  updated_at: string;
  room_id: number;
  room?: Room;
  inventory_id: number;
  inventory?: Inventory;
  quantity: number;
  min_quantity: number;
  notes?: string;
}

export interface InventoryTransaction {
  id: number;
  created_at: string;
  updated_at: string;
  transaction_type: string;
  inventory_id: number;
  inventory?: Inventory;
  inventory_item_id?: number;
  inventory_item?: InventoryItem;
  quantity: number;
  previous_stock: number;
  current_stock: number;
  from_room_id?: number;
  from_room?: Room;
  to_room_id?: number;
  to_room?: Room;
  transaction_date: string;
  reference_number?: string;
  reason?: string;
  user_id: number;
  user?: User;
  notes?: string;
}

// Import Room types (already exists)
interface Room {
  id: number;
  code: string;
  name: string;
}

interface RoomUnit {
  id: number;
  code: string;
  name: string;
}

interface User {
  id: number;
  username: string;
  full_name: string;
}

// Enums
export type InventoryCategory = 
  | 'medical' 
  | 'non_medical' 
  | 'consumable' 
  | 'equipment' 
  | 'furniture' 
  | 'electronic' 
  | 'infrastructure';

export type InventoryCondition = 
  | 'new' 
  | 'good' 
  | 'fair' 
  | 'damaged' 
  | 'broken' 
  | 'disposed';

export type InventoryStatus = 
  | 'available' 
  | 'in_use' 
  | 'maintenance' 
  | 'reserved' 
  | 'disposed';

// Labels
export const inventoryCategoryLabels: Record<InventoryCategory, string> = {
  medical: 'Alat Medis',
  non_medical: 'Alat Non-Medis',
  consumable: 'Bahan Habis Pakai',
  equipment: 'Peralatan',
  furniture: 'Furniture',
  electronic: 'Elektronik',
  infrastructure: 'Infrastruktur',
};

export const inventoryConditionLabels: Record<InventoryCondition, string> = {
  new: 'Baru',
  good: 'Baik',
  fair: 'Cukup',
  damaged: 'Rusak Ringan',
  broken: 'Rusak Berat',
  disposed: 'Dihapuskan',
};

export const inventoryStatusLabels: Record<InventoryStatus, string> = {
  available: 'Tersedia',
  in_use: 'Sedang Digunakan',
  maintenance: 'Dalam Perawatan',
  reserved: 'Direservasi',
  disposed: 'Dihapuskan',
};

// API Functions
export const inventoriesApi = {
  // Master Inventory CRUD
  getAll: (params?: { page?: number; limit?: number; search?: string; category?: string; is_active?: boolean }) =>
    api.get('/inventories', { params }),
  
  getById: (id: number) => api.get(`/inventories/${id}`),
  
  create: (data: Partial<Inventory>) => api.post('/inventories', data),
  
  update: (id: number, data: Partial<Inventory>) => api.put(`/inventories/${id}`, data),
  
  delete: (id: number) => api.delete(`/inventories/${id}`),

  // Categories, Conditions, Statuses, Units from master data
  getCategories: () => api.get('/inventories/categories'),
  getConditions: () => api.get('/inventories/conditions'),
  getStatuses: () => api.get('/inventories/statuses'),
  getUnits: () => api.get('/inventories/units'),

  // Inventory Items (individual trackable items)
  getItems: (inventoryId: number) => api.get(`/inventories/${inventoryId}/items`),
  
  createItem: (inventoryId: number, data: Partial<InventoryItem>) =>
    api.post(`/inventories/${inventoryId}/items`, data),
  
  updateItem: (inventoryId: number, itemId: number, data: Partial<InventoryItem>) =>
    api.put(`/inventories/${inventoryId}/items/${itemId}`, data),
  
  deleteItem: (inventoryId: number, itemId: number) =>
    api.delete(`/inventories/${inventoryId}/items/${itemId}`),
  
  assignItemToRoom: (inventoryId: number, itemId: number, data: { room_id?: number; room_unit_id?: number; location?: string }) =>
    api.post(`/inventories/${inventoryId}/items/${itemId}/assign`, data),

  // Inventory Transactions
  getTransactions: (inventoryId: number, params?: { page?: number; limit?: number }) =>
    api.get(`/inventories/${inventoryId}/transactions`, { params }),
  
  createTransaction: (inventoryId: number, data: { 
    transaction_type: 'in' | 'out' | 'purchase' | 'opname' | 'distribution' | 'request' | 'adjustment' | 'disposal';
    quantity: number;
    reference_number?: string;
    reason?: string;
    notes?: string;
    from_room_id?: number;
    to_room_id?: number;
  }) => api.post(`/inventories/${inventoryId}/transactions`, data),
};

// Room Inventory API (for bulk assignment)
export const roomInventoriesApi = {
  // Get all room inventories with pagination
  getAll: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    room_id?: number;
    inventory_id?: number;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  }) => {
    return api.get('/room-inventories', { params });
  },

  // Get single room inventory
  getById: async (id: number) => {
    return api.get(`/room-inventories/${id}`);
  },

  // Get inventories by room
  getByRoom: async (roomId: number, params?: { page?: number; limit?: number; search?: string }) => {
    return api.get(`/rooms/${roomId}/inventories`, { params });
  },

  // Get rooms by inventory
  getByInventory: async (inventoryId: number) => {
    return api.get(`/inventories/${inventoryId}/rooms`);
  },

  // Get total stock of an inventory across all rooms
  getTotalStock: async (inventoryId: number) => {
    return api.get(`/inventories/${inventoryId}/total-stock`);
  },

  // Assign inventory to room (create)
  create: async (data: {
    room_id: number;
    inventory_id: number;
    quantity?: number;
    min_quantity?: number;
    notes?: string;
  }) => {
    return api.post('/room-inventories', data);
  },

  // Legacy: Assign inventory to room
  assignToRoom: (roomId: number, data: { 
    inventory_id: number; 
    quantity: number; 
    min_quantity?: number; 
    notes?: string 
  }) => api.post('/room-inventories', { room_id: roomId, ...data }),

  // Update room inventory
  update: async (id: number, data: {
    quantity?: number;
    min_quantity?: number;
    notes?: string;
  }) => {
    return api.put(`/room-inventories/${id}`, data);
  },

  // Delete room inventory
  delete: async (id: number) => {
    return api.delete(`/room-inventories/${id}`);
  },

  // Legacy: Remove inventory from room
  remove: (roomId: number, id: number) => api.delete(`/rooms/${roomId}/inventories/${id}`),

  // Adjust stock
  adjustStock: async (id: number, data: {
    adjustment_type: 'add' | 'subtract' | 'set';
    quantity: number;
    reason?: string;
  }) => {
    return api.post(`/room-inventories/${id}/adjust`, data);
  },

  // Transfer stock between rooms
  transfer: async (data: {
    from_room_id: number;
    to_room_id: number;
    inventory_id: number;
    quantity: number;
    notes?: string;
  }) => {
    return api.post('/room-inventories/transfer', data);
  },

  // Get low stock inventories
  getLowStock: async (roomId?: number) => {
    const params = roomId ? { room_id: roomId } : {};
    return api.get('/room-inventories/low-stock', { params });
  },
};
