import api from './axios';

export interface Supplier {
  id: number;
  nama: string;
  alamat: string | null;
  telepon: string | null;
}

export async function getSupplier(): Promise<Supplier[]> {
  const res = await api.get<Supplier[]>('/supplier');
  return res.data;
}

// POST /supplier — dibatasi backend ke role admin.
export async function createSupplier(payload: {
  nama: string;
  alamat?: string;
  telepon?: string;
}): Promise<Supplier> {
  const res = await api.post<Supplier>('/supplier', payload);
  return res.data;
}

// PUT /supplier/{id} — dibatasi backend ke role admin.
export async function updateSupplier(
  id: number,
  payload: { nama: string; alamat?: string; telepon?: string }
): Promise<Supplier> {
  const res = await api.put<Supplier>(`/supplier/${id}`, payload);
  return res.data;
}

// DELETE /supplier/{id} — dibatasi backend ke role admin.
export async function deleteSupplier(id: number): Promise<{ message: string }> {
  const res = await api.delete<{ message: string }>(`/supplier/${id}`);
  return res.data;
}
