// ========================================
//  事件名称常量 & 事件 Payload 类型
// ========================================

// ---- 合同事件 ----
export const ContractEvents = {
  APPROVED:   'contract.approved',
  TERMINATED: 'contract.terminated',
} as const;

export interface ContractApprovedEvent {
  contractId: number;
}
export interface ContractTerminatedEvent {
  contractId: number;
}

// ---- 生产事件 ----
export const ProductionEvents = {
  COMPLETED:  'production.completed',
  QC_PASSED:  'qc.passed',
  QC_REJECTED: 'qc.rejected',
} as const;

export interface ProductionCompletedEvent {
  orderId: number;
  contractId: number;
}
export interface QcPassedEvent {
  orderId: number;
  contractId: number;
}
export interface QcRejectedEvent {
  orderId: number;
  contractId: number;
}

// ---- 事件联合类型（用于 EventEmitter2 的类型提示） ----
export type AppEventMap = {
  [ContractEvents.APPROVED]:   ContractApprovedEvent;
  [ContractEvents.TERMINATED]: ContractTerminatedEvent;
  [ProductionEvents.COMPLETED]:  ProductionCompletedEvent;
  [ProductionEvents.QC_PASSED]:  QcPassedEvent;
  [ProductionEvents.QC_REJECTED]: QcRejectedEvent;
};
