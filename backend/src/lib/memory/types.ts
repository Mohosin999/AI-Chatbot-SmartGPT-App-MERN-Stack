export interface BudgetConfig {
  totalTokens: number;
  systemPercent: number;
  memoryPercent: number;
  historyPercent: number;
  toolPercent: number;
  reservedPercent: number;
}

export interface ContextBudget {
  total: number;
  system: number;
  history: number;
  memory: number;
  toolResults: number;
  reserved: number;
  used: number;
}

export interface MessageDocument {
  _id?: { toString(): string } | string;
  id?: string;
  role: string;
  content: string;
  timestamp: number;
}
