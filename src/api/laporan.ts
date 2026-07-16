import api from './axios';

type JenisLaporan = 'absensi' | 'izin' | 'inventaris';

// Helper generik: hit endpoint /laporan/{jenis}?bulan=&tahun= sebagai blob lalu
// trigger download di browser. Semua endpoint dibatasi backend ke role admin/hr/manajer.
async function downloadLaporan(jenis: JenisLaporan, bulan: number, tahun: number): Promise<void> {
  const res = await api.get(`/laporan/${jenis}`, {
    params: { bulan, tahun },
    responseType: 'blob',
  });

  const url = window.URL.createObjectURL(new Blob([res.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `laporan-${jenis}-${tahun}-${bulan}.csv`);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export function downloadLaporanAbsensi(bulan: number, tahun: number): Promise<void> {
  return downloadLaporan('absensi', bulan, tahun);
}

export function downloadLaporanIzin(bulan: number, tahun: number): Promise<void> {
  return downloadLaporan('izin', bulan, tahun);
}

export function downloadLaporanInventaris(bulan: number, tahun: number): Promise<void> {
  return downloadLaporan('inventaris', bulan, tahun);
}