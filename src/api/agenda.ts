import api from './axios';

export interface AgendaItem {
  id: number;
  title: string;
  description: string | null;
  start_at: string;
}

export interface CreateAgendaPayload {
  title: string;
  description?: string;
  start_at: string;
}

// GET /agenda — dipakai widget "Agenda Mendatang" di Dashboard.
export async function getAgendaMendatang(limit = 5): Promise<AgendaItem[]> {
  const res = await api.get<AgendaItem[]>('/agenda', { params: { limit } });
  return res.data;
}

// POST /agenda — dibatasi backend ke role admin/hr.
export async function createAgenda(payload: CreateAgendaPayload): Promise<AgendaItem> {
  const res = await api.post<AgendaItem>('/agenda', payload);
  return res.data;
}

// DELETE /agenda/{id} — dibatasi backend ke role admin/hr.
export async function deleteAgenda(id: number): Promise<void> {
  await api.delete(`/agenda/${id}`);
}
