import api from '../axios';

// Master Data > Role -- data referensi role yang bisa diassign ke user
// (nama). Mirror pola api/cabang.ts / api/perusahaan.ts (CRUD + import),
// tapi paginated server-side sama kayak api/auditLog.ts karena daftarnya
// dimaksudkan bisa dicari & diloncat per halaman.
//
// REVISI (hapus level & label): dulu ada juga kolom `label` (nama
// tampilan) & `level` (hak akses lintas role), tapi keduanya dihapus --
// hak akses sekarang cuma 2 tingkat (admin vs role lain yang setara,
// lihat backend User::isAdmin()), jadi gak ada lagi yang perlu
// diinput/ditampilkan selain nama.
export interface RoleItem {
    id: number;
    nama: string;
    users_count: number;
    created_at: string;
    updated_at: string;
}

export interface PaginatedRole {
    data: RoleItem[];
    current_page: number;
    last_page: number;
    total: number;
    per_page: number;
}

export async function getRole(page = 1, search = '', perPage = 10): Promise<PaginatedRole> {
    const res = await api.get<PaginatedRole>('/role', {
        params: { page, per_page: perPage, search: search || undefined },
    });
    return res.data;
}

export async function createRole(payload: { nama: string }): Promise<RoleItem> {
    const res = await api.post<RoleItem>('/role', payload);
    return res.data;
}

export async function updateRole(
    id: number,
    payload: { nama?: string }
): Promise<RoleItem> {
    const res = await api.put<RoleItem>(`/role/${id}`, payload);
    return res.data;
}

export async function deleteRole(id: number): Promise<{ message: string }> {
    const res = await api.delete(`/role/${id}`);
    return res.data;
}

// POST /role/import — import massal dari file Excel (.xlsx/.xls), dibatasi
// backend ke role admin. Format kolom: Nama. Baris dengan nama yang sudah
// ada dilewati (gak ada yang diupdate lagi selain nama itu sendiri).
export async function importRole(file: File): Promise<{ success: boolean; message: string }> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await api.post<{ success: boolean; message: string }>('/role/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
}