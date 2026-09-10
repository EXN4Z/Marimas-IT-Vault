import api from './axios';

export interface Cabang {
    id: number;
    nama: string;
    alamat: string | null;
    telepon: string | null;
    link: string | null;
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
}): Promise<Cabang> {
    const res = await api.post('/cabang', payload);
    return res.data;
}

export async function updateCabang(
    id: number,
    payload: { nama: string; alamat?: string; telepon?: string; link: string; }
): Promise<Cabang> {
    const res = await api.put(`/cabang/${id}`, payload);
    return res.data;
}

export async function deleteCabang(id: number): Promise<{ message: string }> {
    const res = await api.delete(`/cabang/${id}`);
    return res.data;
}

// POST /cabang/import — import massal dari file Excel (.xlsx/.xls),
// dibatasi backend ke role admin. Format kolom: Nama | Alamat | Telepon | Link.
// Baris dengan nama yang sudah ada akan di-UPDATE, bukan diduplikasi.
export async function importCabang(file: File): Promise<{ success: boolean; message: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post<{ success: boolean; message: string }>('/cabang/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
}