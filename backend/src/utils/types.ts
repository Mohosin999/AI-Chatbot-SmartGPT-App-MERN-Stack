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
