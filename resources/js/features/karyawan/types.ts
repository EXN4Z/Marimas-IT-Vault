export interface Departemen {
  id: number
  nama: string
}

export interface LokasiKantor {
  id: number
  nama: string
}

export interface Perusahaan {
  id: number
  nama: string
}

export interface Karyawan {
  id: number
  nik: string
  name: string
  email: string
  phone: string
  departemen: Departemen | null
  lokasi_kantor: LokasiKantor | null
  perusahaan: Perusahaan | null
  tanggal_masuk: string
  role_id: number
  role: string
  status?: 'aktif' | 'nonaktif'
  created_at?: string
  updated_at?: string
}

// [F3-INERTIA] Bentuk props tab Karyawan dari server (MasterDataPageController -> KaryawanWebController).
// Satu baris = Karyawan lengkap + id relasi (dipakai form Edit).
export interface KaryawanRow extends Karyawan {
  departemen_id: number | null;
  lokasi_kantor_id: number | null;
  perusahaan_id: number | null;
}

export interface KaryawanList {
  data: KaryawanRow[];
  total: number;
  current_page: number;
  last_page: number;
  per_page: number;
  filters: {
    search: string;
    role: 'semua' | 'user' | 'admin';
  };
}

// Pilihan dropdown form Tambah/Edit user.
export interface KaryawanOpsi {
  departemen: Departemen[];
  cabang: LokasiKantor[];
  perusahaan: Perusahaan[];
  roles: { id: number; nama: string }[];
}
