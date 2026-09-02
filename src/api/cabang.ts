import api from './axios';

export interface Cabang {
    id: number;
    nama: string;
    alamat: string | null;
    telepon: string | null;
    link: string | null;
    // FIX: latitude/longitude sebelumnya gak ada di interface ini walau
    // udah dipakai di TabCabang.tsx (item.latitude / item.longitude) --
    // nyebabin TS2339 "Property does not exist on type 'Cabang'".
    latitude: number | null;
    longitude: number | null;
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
    link: string;
    latitude: number;
    longitude: number;
}): Promise<Cabang> {
    const res = await api.post('/cabang', payload);
    return res.data;
}

export async function updateCabang(
    id: number,
    payload: { nama: string; alamat?: string; telepon?: string; link: string; latitude: number; longitude: number; }
): Promise<Cabang> {
    const res = await api.put(`/cabang/${id}`, payload);
    return res.data;
}

export async function deleteCabang(id: number): Promise<{ message: string }> {
    const res = await api.delete(`/cabang/${id}`);
    return res.data;
}