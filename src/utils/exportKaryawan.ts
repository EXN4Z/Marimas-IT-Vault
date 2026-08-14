import * as XLSX from 'xlsx'

export interface Karyawan {
  name: string
  email: string
  phone?: string | null
  nik?: string | null
  departemen?: { nama: string } | null
  lokasi_kantor?: { nama: string } | null
  tanggal_masuk?: string | null
  role: string
}

interface KaryawanRow {
  Nama: string
  Email: string
  Telepon: string
  NIK: string
  Departemen: string
  'Lokasi Kantor': string
  'Tanggal Masuk': string
  Role: string
}

function toRows(data: Karyawan[]): KaryawanRow[] {
  return data.map((k) => ({
    Nama: k.name,
    Email: k.email,
    Telepon: k.phone ?? '-',
    NIK: k.nik ?? '-',
    Departemen: k.departemen?.nama ?? '-',
    'Lokasi Kantor': k.lokasi_kantor?.nama ?? '-',
    'Tanggal Masuk': k.tanggal_masuk ?? '-',
    Role: k.role,
  }))
}

export function exportKaryawanToExcel(data: Karyawan[], filename = 'data-karyawan'): void {
  const worksheet = XLSX.utils.json_to_sheet(toRows(data))
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Karyawan')
  XLSX.writeFile(workbook, `${filename}.xlsx`)
}

export function exportKaryawanToCSV(data: Karyawan[], filename = 'data-karyawan'): void {
  const worksheet = XLSX.utils.json_to_sheet(toRows(data))
  const csv = XLSX.utils.sheet_to_csv(worksheet)
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })

  const link = document.createElement('a')
  link.href = URL.createObjectURL(blob)
  link.download = `${filename}.csv`
  link.click()
  URL.revokeObjectURL(link.href)
}