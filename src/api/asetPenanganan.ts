import api from './axios';
import type { Aset } from './aset';

interface PenangananPemakai {
  id: number;
  pekerja?: {
    id: number;
    user?: { id: number; name: string };
  };
}

export interface AsetPenanganan {
  id: number;
  aset_id: number;
  aset_pemakai_id: number | null;
  jenis_kerusakan: string;
  keluhan: string;
  tanggal_lapor: string;
  tanggal_selesai: string | null;
  harga_jasa: number | null;
  biaya_komponen: number | null;
  hasil: string | null;
  no_struk: string | null;
  catatan: string | null;
  total_biaya?: number;
  durasi_hari?: number | null;
  aset?: Aset;
  pemakai?: PenangananPemakai | null;
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

// POST /aset-penanganan/{id} — admin tandai selesai / isi hasil penanganan.
export async function selesaikanPenanganan(
  id: number,
  payload: Partial<{
    tanggal_selesai: string | null;
    harga_jasa: number | null;
    biaya_komponen: number | null;
    hasil: string | null;
    no_struk: string | null;
    catatan: string | null;
  }> = {},
): Promise<AsetPenanganan> {
  const res = await api.post<AsetPenanganan>(`/aset-penanganan/${id}`, payload);
  return res.data;
}