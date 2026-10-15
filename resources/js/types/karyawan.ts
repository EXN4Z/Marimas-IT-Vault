import type { Karyawan } from '../api/masterData/karyawan';

// [F3-INERTIA] Bentuk data tab Karyawan dari server (KaryawanWebController). Satu baris = satu user, sudah
// lengkap untuk list, modal detail, dan modal edit (id relasi + tanggal_masuk 'Y-m-d' + status).
export type KaryawanRow = Karyawan & {
  departemen_id?: number | null;
  lokasi_kantor_id?: number | null;
  perusahaan_id?: number | null;
};

export interface KaryawanOpsiItem {
  id: number;
  nama: string;
}

// Pilihan dropdown form Tambah/Edit (props `karyawanOpsi`).
export interface KaryawanOpsi {
  departemen: KaryawanOpsiItem[];
  cabang: KaryawanOpsiItem[];
  perusahaan: KaryawanOpsiItem[];
  roles: KaryawanOpsiItem[];
}

export type KaryawanFilterRole = 'semua' | 'user' | 'admin';

// Props `karyawan`: satu halaman data + filter aktif (query string = sumber kebenaran).
export interface KaryawanList {
  data: KaryawanRow[];
  total: number;
  current_page: number;
  last_page: number;
  per_page: number;
  filters: { search: string; role: KaryawanFilterRole };
}
