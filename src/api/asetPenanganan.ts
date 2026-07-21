import api from './axios';
import type { Aset, AsetPemakai } from './aset';

export interface AsetPenanganan {
  id: number;
  aset_id: number;
  aset_pemakai_id: number;
  jenis_kerusakan: string;
  keluhan: string;
  tanggal_lapor: string;
  tanggal_selesai: string | null;
  harga_jasa: number;
  biaya_komponen: number;
  hasil: string | null;
  no_struk: string | null;
  catatan: string | null;
  aset?: Aset;
  pemakai?: AsetPemakai;
}

// GET /aset-penanganan — dibatasi backend ke role admin.
export async function getAsetPenanganan(): Promise<AsetPenanganan[]> {
  const res = await api.get<AsetPenanganan[]>('/aset-penanganan');
  return res.data;
}

// POST /aset-penanganan — bisa dipanggil user manapun yang sedang memegang aset tsb.
export async function laporKerusakanAset(payload: {
  aset_id: number;
  jenis_kerusakan: string;
  keluhan: string;
}): Promise<AsetPenanganan> {
  const res = await api.post<AsetPenanganan>('/aset-penanganan', payload);
  return res.data;
}