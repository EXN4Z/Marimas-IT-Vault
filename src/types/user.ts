export interface User {
    id: number;
    name: string;
    email: string;
    phone?: string | null;
    role: 'admin' | 'hr' | 'manajer' | 'karyawan' | 'cabang';
}