// src/api/karyawan.ts
import api from './axios'

export interface Departemen {
  id: number
  nama: string
}

export interface LokasiKantor {
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
  tanggal_masuk: string
  role: string
  created_at?: string
  updated_at?: string
}

export type KaryawanPayload = Omit<Karyawan, 'id' | 'created_at' | 'updated_at'>

export const karyawanApi = {
  getAll: () => api.get<Karyawan[]>('/karyawan'),
  getOne: (id: number) => api.get<Karyawan>(`/karyawan/${id}`),
  create: (data: KaryawanPayload) => api.post<Karyawan>('/karyawan', data),
  update: (id: number, data: Partial<KaryawanPayload>) =>
    api.put<Karyawan>(`/karyawan/${id}`, data),
  remove: (id: number) => api.delete(`/karyawan/${id}`),
}