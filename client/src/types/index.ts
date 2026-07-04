export interface UserInfo {
  id: number;
  username: string;
  real_name: string;
  roles: string[];
  permissions: string[];
}

export interface LoginResult {
  access_token: string;
  user: UserInfo;
}

export interface Product {
  id: number;
  name: string;
  model: string;
  price?: number;
  unit?: string;
}

export interface Contract {
  id: number;
  contract_no: string;
  customer_name: string;
  customer_phone?: string;
  customer_address?: string;
  status: string;
  submitter?: { id: number; real_name: string };
  items: ContractItem[];
  created_at: string;
  change_reason?: string;
}

export interface ContractItem {
  id: number;
  product_id: number;
  quantity: number;
  remark?: string;
  product?: Product;
}
