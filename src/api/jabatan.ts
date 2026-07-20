import api from './axios';

export interface Jabatan {
  id: number;
  nama: string;
}

export interface JabatanInput {
  nama: string;
}

export async function getJabatan(): Promise<Jabatan[]> {
  const res = await api.get<Jabatan[]>('/jabatan');
  return res.data;
}

// POST /jabatan — dibatasi backend ke role admin/hr.
export async function createJabatan(payload: JabatanInput): Promise<Jabatan> {
  const res = await api.post<Jabatan>('/jabatan', payload);
  return res.data;
}

// PUT /jabatan/{id} — dibatasi backend ke role admin/hr.
export async function updateJabatan(id: number, payload: JabatanInput): Promise<Jabatan> {
  const res = await api.put<Jabatan>(`/jabatan/${id}`, payload);
  return res.data;
}

// DELETE /jabatan/{id} — dibatasi backend ke role admin/hr.
export async function deleteJabatan(id: number): Promise<{ message: string }> {
  const res = await api.delete<{ message: string }>(`/jabatan/${id}`);
  return res.data;
}
