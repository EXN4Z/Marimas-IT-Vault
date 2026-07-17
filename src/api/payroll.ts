import api from './axios';

export interface PayrollRow {
  pekerja_id: number;
  nip: string;
  nama: string;
  jabatan: string;
  departemen: string;
  gaji_pokok: number;
  hari_hadir: number;
  hari_telat: number;
  potongan_telat: number;
  gaji_bersih: number;
}

// GET /payroll?bulan=&tahun= — dibatasi backend ke role admin/hr.
export async function getPayroll(bulan: number, tahun: number): Promise<PayrollRow[]> {
  const res = await api.get<PayrollRow[]>('/payroll', { params: { bulan, tahun } });
  return res.data;
}

// GET /payroll/export?bulan=&tahun= — download CSV rekap gaji.
export async function exportPayrollCsv(bulan: number, tahun: number): Promise<void> {
  const res = await api.get('/payroll/export', {
    params: { bulan, tahun },
    responseType: 'blob',
  });

  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `payroll-${tahun}-${bulan}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}