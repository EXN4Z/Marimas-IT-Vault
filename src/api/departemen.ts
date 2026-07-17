import api from './axios';

export interface Departemen {
  id: number;
  nama: string;
}

export async function getDepartemen(): Promise<Departemen[]> {
  const res = await api.get<Departemen[]>('/departemen');
  return res.data;
}

// POST /departemen — dibatasi backend ke role admin/hr.
export async function createDepartemen(nama: string): Promise<Departemen> {
  const res = await api.post<Departemen>('/departemen', { nama });
  return res.data;
}

// PUT /departemen/{id} — dibatasi backend ke role admin/hr.
export async function updateDepartemen(id: number, nama: string): Promise<Departemen> {
  const res = await api.put<Departemen>(`/departemen/${id}`, { nama });
  return res.data;
}

// DELETE /departemen/{id} — dibatasi backend ke role admin/hr.
export async function deleteDepartemen(id: number): Promise<{ message: string }> {
  const res = await api.delete<{ message: string }>(`/departemen/${id}`);
  return res.data;
}