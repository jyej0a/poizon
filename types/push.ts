export interface WebPushPayload {
  title: string;
  body: string;
  url: string;
}

export type SearchJobPushStatus = "done" | "partial" | "failed";

export interface PushSubscriptionPayload {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface SearchJobPushPayload extends WebPushPayload {
  jobId: string;
  status: SearchJobPushStatus;
}

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  user_agent: string | null;
}
