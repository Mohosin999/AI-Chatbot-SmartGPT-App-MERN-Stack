export interface ContextBudget {
  total: number;
  system: number;
  history: number;
  memory: number;
  toolResults: number;
  reserved: number;
  used: number;
}
