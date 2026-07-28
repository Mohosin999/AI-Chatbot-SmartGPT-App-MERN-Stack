export interface GenerateAccessTokenParams {
  payload: Record<string, unknown>;
  algorithm?: string;
  secret?: string;
  expiresIn?: string;
}

export interface VerifyAccessTokenParams {
  token: string;
  algorithm?: string;
  secret?: string;
}

export interface DecodedTokenParams {
  token: string;
  algorithm?: string;
}
