/** Row shapes for notices, chat and in-app notifications. */

export interface Notice {
  id: string;
  title: string;
  body: string;
  category: string;
  status: string;
  /** null = sent to all buildings of the tenant. */
  building_id: string | null;
  published_at: string | null;
  expires_at: string | null;
  /** Aggregate: how many residents have opened it. */
  notice_reads: { count: number }[];
}

export interface ChatChannel {
  id: string;
  /** building | floor | room | staff | custom */
  kind: string;
  name: string;
  residents_can_post: boolean;
  building_id: string;
}

export interface ChatMessage {
  id: string;
  sender_user_id: string;
  sender_name: string;
  sender_is_staff: boolean;
  body: string;
  is_pinned: boolean;
  created_at: string;
}

export interface AppNotification {
  id: string;
  title: string;
  body: string | null;
  created_at: string;
  read_at: string | null;
}
