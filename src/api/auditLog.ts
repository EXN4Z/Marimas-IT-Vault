import api from './axios';

export interface AuditLog {
  id: number;
  user_id: number | null;
  method: string;
  endpoint: string;
  deskripsi: string;
  ip_address: string | null;
  created_at: string;
  deleted_at: string | null;
  user: { id: number; name: string } | null;
}

export interface PaginatedAuditLog {
  data: AuditLog[];
  current_page: number;
  last_page: number;
  total: number;
  per_page: number;
}

export async function getAuditLog(page = 1): Promise<PaginatedAuditLog> {
  const res = await api.get<PaginatedAuditLog>('/audit-log', { params: { page } });
  return res.data;
}

export async function getAuditLogTrash(page = 1): Promise<PaginatedAuditLog> {
  const res = await api.get<PaginatedAuditLog>('/audit-log/trash', { params: { page } });
  return res.data;
}