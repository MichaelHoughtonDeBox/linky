export type LinkySource = "web" | "cli" | "sdk" | "agent" | "unknown";

export type LinkyMetadata = Record<string, unknown>;

export type CreateLinkyPayload = {
  urls: string[];
  source: LinkySource;
  metadata?: LinkyMetadata;
};

export type CreateLinkyResponse = {
  slug: string;
  url: string;
};

export type LinkyRecord = {
  id: number;
  slug: string;
  urls: string[];
  createdAt: string;
  source: LinkySource;
  metadata: LinkyMetadata | null;
};
