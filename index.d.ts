export type CreateLinkyOptions = {
  urls: string[];
  baseUrl?: string;
  source?: string;
  metadata?: Record<string, unknown>;
  fetchImpl?: typeof fetch;
};

export type CreateLinkyResult = {
  slug: string;
  url: string;
};

export const DEFAULT_BASE_URL: string;

export function createLinky(
  options: CreateLinkyOptions,
): Promise<CreateLinkyResult>;
