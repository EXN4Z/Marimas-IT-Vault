export interface User {
    id: number;
    name: string;
    email: string;
    phone?: string | null;
    role: 'admin' | 'hr' | 'manajer' | 'karyawan' | 'cabang';
    nik?: string | null;
    departemen?: { id: number; nama: string } | null;
    lokasi_kantor?: { id: number; nama: string } | null;
    tanggal_masuk?: string | null;
}