import { BudgetConfig, ContextBudget as ContextBudgetType } from "./types";

const DEFAULT_CONFIG: BudgetConfig = {
  totalTokens: 128_000,
  systemPercent: 5,
  memoryPercent: 5,
  historyPercent: 45,
  toolPercent: 15,
  reservedPercent: 30,
};

export class ContextBudget {
  private config: BudgetConfig;
  private requestCount = 0;

  constructor(config: Partial<BudgetConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  allocate(): ContextBudgetType {
    const total = this.config.totalTokens;
    return {
      total,
      system: Math.floor(total * (this.config.systemPercent / 100)),
      history: Math.floor(total * (this.config.historyPercent / 100)),
      memory: Math.floor(total * (this.config.memoryPercent / 100)),
      toolResults: Math.floor(total * (this.config.toolPercent / 100)),
      reserved: Math.floor(total * (this.config.reservedPercent / 100)),
      used: 0,
    };
  }

  logBudgetAllocation(
    budget: ContextBudgetType,
    used: Record<string, number>,
  ): void {
    this.requestCount++;
    console.log(
      `[Budget #${this.requestCount}] ` +
        `sys:${budget.system} hist:${budget.history} mem:${budget.memory} tool:${budget.toolResults} ` +
        `used:${JSON.stringify(used)}`,
    );
  }
}

export const contextBudget = new ContextBudget();
