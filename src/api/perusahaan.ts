import api from './axios';

// Mirror dari api/cabang.ts -- struktur field sama persis, tanpa
// pekerja_count karena Perusahaan sengaja belum dikaitkan ke tabel lain.
export interface Perusahaan {
    id: number;
    nama: string;
    alamat: string | null;
    telepon: string | null;
    link: string | null;
}

export async function getPerusahaan(): Promise<Perusahaan[]> {
    const res = await api.get('/perusahaan');
    return res.data;
}

export async function createPerusahaan(payload: {
    nama: string;
    alamat?: string;
    telepon?: string;
    link: string;
}): Promise<Perusahaan> {
    const res = await api.post('/perusahaan', payload);
    return res.data;
}

export async function updatePerusahaan(
    id: number,
    payload: { nama: string; alamat?: string; telepon?: string; link: string; }
): Promise<Perusahaan> {
    const res = await api.put(`/perusahaan/${id}`, payload);
    return res.data;
}

export async function deletePerusahaan(id: number): Promise<{ message: string }> {
    const res = await api.delete(`/perusahaan/${id}`);
    return res.data;
}