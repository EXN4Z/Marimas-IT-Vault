export interface User {
    id: number;
    name: string;
    email: string;
    phone?: string | null;
    role: 'admin' | 'user' | 'cabang'; // REVISI (simplify_roles_table): dulu masih 'hr' | 'manajer' | 'karyawan' | 'cabang', ketinggalan pas migration role di-merge ke 'user'
    nik?: string | null;
    departemen?: { id: number; nama: string } | null;
    lokasi_kantor?: { id: number; nama: string } | null;
    tanggal_masuk?: string | null;
}