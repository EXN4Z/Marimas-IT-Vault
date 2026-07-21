import api from './axios';

export interface KelengkapanMaster {
  id: number;
  nama: string;
}

export async function getKelengkapanMaster(): Promise<KelengkapanMaster[]> {
  const res = await api.get<KelengkapanMaster[]>('/kelengkapan-master');
  return res.data;
}

// POST /kelengkapan-master — dibatasi backend ke role admin.
export async function createKelengkapanMaster(nama: string): Promise<KelengkapanMaster> {
  const res = await api.post<KelengkapanMaster>('/kelengkapan-master', { nama });
  return res.data;
}

// PUT /kelengkapan-master/{id} — dibatasi backend ke role admin.
export async function updateKelengkapanMaster(id: number, nama: string): Promise<KelengkapanMaster> {
  const res = await api.put<KelengkapanMaster>(`/kelengkapan-master/${id}`, { nama });
  return res.data;
}

// DELETE /kelengkapan-master/{id} — dibatasi backend ke role admin.
export async function deleteKelengkapanMaster(id: number): Promise<{ message: string }> {
  const res = await api.delete<{ message: string }>(`/kelengkapan-master/${id}`);
  return res.data;
}
