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

export interface Contract {
  id: number;
  contract_no: string;
  customer_name: string;
  status: string;
  submitter: { real_name: string };
  items: ContractItem[];
  created_at: string;
}

export interface ContractItem {
  id: number;
  product_id: number;
  quantity: number;
  remark?: string;
}
