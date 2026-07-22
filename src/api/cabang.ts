import api from './axios';

export interface Cabang {
    id: number;
    nama: string;
    alamat: string | null;
    telepon: string | null;
    latitude: number;
    longitude: number;
    pekerja_count: number;
}

export async function getCabang(): Promise<Cabang[]> {
    const res = await api.get('/cabang');
    return res.data;
}

export async function createCabang(payload: {
    nama: string;
    alamat?: string;
    telepon?: string;
    latitude: number;
    longitude: number;
}): Promise<Cabang> {
    const res = await api.post('/cabang', payload);
    return res.data;
}

export async function updateCabang(
    id: number,
    payload: { nama: string; alamat?: string; telepon?: string; latitude: number; longitude: number }
): Promise<Cabang> {
    const res = await api.put(`/cabang/${id}`, payload);
    return res.data;
}

export async function deleteCabang(id: number): Promise<{ message: string }> {
    const res = await api.delete(`/cabang/${id}`);
    return res.data;
}