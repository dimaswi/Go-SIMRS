// Common types used across API modules

export interface Permission {
  id: number;
  name: string;
  module: string;
  category: string;
  description: string;
  actions: string; // JSON string containing array of actions
}

export interface Role {
  id: number;
  name: string;
  description: string;
  permissions?: Permission[];
}

export interface User {
  id: number;
  email: string;
  username: string;
  full_name: string;
  is_active: boolean;
  role_id?: number;
  role?: Role;
  employee_id?: number;
  employee?: any; // or use specific Employee type if imported
  has_signature_pin?: boolean;
  signature_pin_set_at?: string;
}
