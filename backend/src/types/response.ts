export interface ApiResponse<T = unknown> {
  code?: number;
  message?: string;
  data?: T;
  links?: Record<string, string>;
  errors?: string[];
  logout?: boolean;
}

export interface TransformedItem {
  id: string;
  [key: string]: unknown;
  link: string;
}

export interface GetTransformedItemsParams {
  items: Record<string, unknown>[];
  selection: string[];
  path: string;
}

export interface FormattedMessage {
  id: string;
  role: string;
  content: string;
  timestamp: number;
}
