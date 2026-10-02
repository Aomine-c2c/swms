export interface Role {
  id: number;
  name: string;
  description?: string;
  permissions?: string[];
}

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: number | null;
  role_details?: Role | null;
  status?: string;
  is_active?: boolean;
  is_superuser?: boolean;
  permissions?: string[];
}

export interface Carrier {
  id: number;
  name: string;
  contact_person?: string;
  phone_number?: string;
  status?: string;
  vehicle_count?: number;
}

export interface Vehicle {
  id: number;
  license_plate: string;
  vehicle_type?: string;
  known_tare_weight?: string | number | null;
  tare_weight?: string | number | null;
  carrier?: number | Carrier | null;
  carrier_name?: string;
  default_driver?: number | Driver | null;
  default_driver_name?: string;
  max_capacity?: string | number | null;
  registration_expiry?: string | null;
  last_inspection_date?: string | null;
  status?: string;
}

export interface Driver {
  id: number;
  name: string;
  license_number: string;
  contact_info?: string;
  phone?: string;
  status?: string;
  license_expiry?: string | null;
  carrier_name?: string;
  assigned_vehicle_count?: number;
}

export interface Supplier {
  id: number;
  name: string;
  code?: string;
  contact_person?: string;
  phone?: string;
  address?: string;
  status?: string;
}

export interface Material {
  id: number;
  name: string;
  code?: string;
  description?: string;
  unit_of_measure?: string;
  unit_price?: string | number | null;
  status?: string;
}

export interface WeighingTransaction {
  id: number;
  ticket_number?: string;
  vehicle: number | Vehicle;
  vehicle_license?: string;
  driver?: number | Driver | null;
  driver_name?: string;
  supplier?: number | Supplier | null;
  supplier_name?: string;
  material: number | Material;
  material_name?: string;
  operator: number | User;
  operator_name?: string;
  gross_weight: string | number | null;
  tare_weight: string | number | null;
  net_weight: string | number | null;
  first_weighing_datetime: string;
  second_weighing_datetime?: string | null;
  status: 'Open' | 'Pending Verification' | 'Completed' | 'Corrected' | 'Reversed' | 'Cancelled';
  remarks?: string;
  is_manual_entry: boolean;
  manual_entry_reason?: string;
}

export interface ApprovalRequest {
  id: number;
  transaction: number | WeighingTransaction;
  transaction_details?: WeighingTransaction;
  action: 'CORRECTION' | 'REVERSAL' | 'CANCELLATION';
  requested_by: number | User;
  requested_by_name?: string;
  reviewed_by?: number | User | null;
  reviewed_by_name?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  request_reason: string;
  review_reason?: string;
  changes_payload?: Record<string, any> | null;
  created_at: string;
  updated_at: string;
}

export interface AuditLogItem {
  id: number;
  user: number | User | null;
  user_name?: string;
  action: string;
  record_type: string;
  record_id: string;
  previous_value?: any;
  new_value?: any;
  reason?: string;
  action_datetime: string;
}

export interface BackupRecord {
  id: number;
  filename: string;
  size_bytes: number;
  created_at: string;
  status: string;
  verified?: boolean;
}
