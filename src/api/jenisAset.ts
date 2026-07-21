import api from './axios';

export interface JenisAset {
  id: number;
  nama: string;
}

export async function getJenisAset(): Promise<JenisAset[]> {
  const res = await api.get<JenisAset[]>('/jenis-aset');
  return res.data;
}

// POST /jenis-aset — dibatasi backend ke role admin.
export async function createJenisAset(nama: string): Promise<JenisAset> {
  const res = await api.post<JenisAset>('/jenis-aset', { nama });
  return res.data;
}

// PUT /jenis-aset/{id} — dibatasi backend ke role admin.
export async function updateJenisAset(id: number, nama: string): Promise<JenisAset> {
  const res = await api.put<JenisAset>(`/jenis-aset/${id}`, { nama });
  return res.data;
}

// DELETE /jenis-aset/{id} — dibatasi backend ke role admin.
export async function deleteJenisAset(id: number): Promise<{ message: string }> {
  const res = await api.delete<{ message: string }>(`/jenis-aset/${id}`);
  return res.data;
}
