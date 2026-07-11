import { BadRequestException } from '@nestjs/common';

/**
 * 合同状态枚举（字面量类型）
 */
export enum ContractStatus {
  DRAFT       = 'draft',
  PENDING     = 'pending',
  APPROVED    = 'approved',
  RETURNED    = 'returned',
  PRODUCTION  = 'production',
  SHIPPED     = 'shipped',
  INSTALLING  = 'installing',
  DELIVERED   = 'delivered',
  CANCELLED   = 'cancelled',
}

/**
 * 合法状态转移表
 * 每个状态的后继状态列表，空数组 = 终态
 */
export const CONTRACT_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  [ContractStatus.DRAFT]:      [ContractStatus.PENDING, ContractStatus.CANCELLED],
  [ContractStatus.PENDING]:    [ContractStatus.APPROVED, ContractStatus.RETURNED],
  [ContractStatus.RETURNED]:   [ContractStatus.PENDING, ContractStatus.CANCELLED],
  [ContractStatus.APPROVED]:   [ContractStatus.PRODUCTION, ContractStatus.CANCELLED],
  [ContractStatus.PRODUCTION]: [ContractStatus.SHIPPED],
  [ContractStatus.SHIPPED]:    [ContractStatus.INSTALLING],
  [ContractStatus.INSTALLING]: [ContractStatus.DELIVERED],
  [ContractStatus.DELIVERED]:  [],       // 终态
  [ContractStatus.CANCELLED]:  [],       // 终态
};

/** 终态集合 */
export const TERMINAL_STATUSES: ContractStatus[] = [
  ContractStatus.DELIVERED,
  ContractStatus.CANCELLED,
];

/** 可编辑的中间状态（编辑/删除合同前检查） */
export const EDITABLE_STATUSES: ContractStatus[] = [
  ContractStatus.DRAFT,
];

/**
 * 断言状态转移合法，非法时抛 BadRequestException
 */
export function assertTransition(from: string, to: string): void {
  const validNext = CONTRACT_TRANSITIONS[from as ContractStatus];
  if (!validNext || !validNext.includes(to as ContractStatus)) {
    throw new BadRequestException(
      `合同状态不能从 ${from} 转为 ${to}`,
    );
  }
}

/**
 * 断言当前状态可编辑（编辑/删除草稿前调用）
 */
export function assertEditable(status: string): void {
  if (!EDITABLE_STATUSES.includes(status as ContractStatus)) {
    throw new BadRequestException('只能编辑草稿状态的合同');
  }
}

/**
 * 断言合同可终止（非终态均可终止）
 */
export function assertTerminable(status: string): void {
  if (TERMINAL_STATUSES.includes(status as ContractStatus)) {
    throw new BadRequestException('该合同无法终止');
  }
}

/**
 * 检查状态是否为合法的合同状态
 */
export function isValidStatus(status: string): status is ContractStatus {
  return Object.values(ContractStatus).includes(status as ContractStatus);
}
