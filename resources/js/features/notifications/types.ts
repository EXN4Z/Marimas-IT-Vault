// [F9-INERTIA] Tipe notifikasi (dulu di api/notifications.ts + types/dashboard.ts).
export interface AppNotification {
  id: string;
  type?: string;
  data: {
    message: string;
    url?: string;
    silent?: boolean;
    status?: string;
    [key: string]: any;
  };
  read_at: string | null;
  created_at: string;
}

export interface NotificationResponse {
  data: AppNotification[];
  unread_count: number;
}
