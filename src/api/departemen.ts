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

// POST /departemen/import — import massal dari file Excel (.xlsx/.xls),
// dibatasi backend ke role admin/hr. Format kolom: Nama. Baris dengan
// nama yang sudah ada dilewati (idempotent), bukan dianggap error.
export async function importDepartemen(file: File): Promise<{ success: boolean; message: string }> {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post<{ success: boolean; message: string }>('/departemen/import', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}