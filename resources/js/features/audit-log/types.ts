export interface AuditLog {
  id: number;
  user_id: number | null;
  method: string;
  endpoint: string;
  deskripsi: string;
  ip_address: string | null;
  created_at: string;
  deleted_at: string | null;
  // Diisi untuk entri penghapusan data yang bisa dipulihkan (lihat AuditSubject di backend).
  subject_type: string | null;
  subject_id: number | null;
  dipulihkan_at: string | null;
  user: { id: number; name: string } | null;
}

export interface PaginatedAuditLog {
  data: AuditLog[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}
