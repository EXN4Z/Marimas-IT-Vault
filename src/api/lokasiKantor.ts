import api from './axios';

export interface LokasiKantor {
    id: number;
    nama: string;
}

export async function getLokasiKantor(): Promise<LokasiKantor[]> {
    const res = await api.get('/cabang');
    return res.data;
}