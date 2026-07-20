import api from './axios';
import { printCsvAsReport } from '../utils/printCsvReport';

type JenisLaporan = 'absensi' | 'izin' | 'inventaris';

const bulanLabel = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const laporanTitle: Record<JenisLaporan, string> = {
  absensi: 'Laporan Absensi',
  izin: 'Laporan Pengajuan Izin',
  inventaris: 'Laporan Mutasi Inventaris',
};

// Helper generik: hit endpoint /laporan/{jenis}?bulan=&tahun= sebagai blob, parse
// hasilnya, lalu render sebagai tabel HTML rapi yang ditulis ke jendela print yang
// SUDAH dibuka (lihat printCsvReport.ts untuk alasan kenapa window-nya harus dibuka
// duluan, sebelum fetch data). Semua endpoint dibatasi backend ke role admin/hr/manajer.
async function printLaporan(
  jenis: JenisLaporan,
  bulan: number,
  tahun: number,
  targetWindow: Window
): Promise<void> {
  try {
    const res = await api.get(`/laporan/${jenis}`, {
      params: { bulan, tahun },
      responseType: 'blob',
    });

    const csvText = await (res.data as Blob).text();
    printCsvAsReport(
      csvText,
      {
        title: laporanTitle[jenis],
        periodLabel: `${bulanLabel[bulan - 1]} ${tahun}`,
      },
      targetWindow
    );
  } catch (err) {
    targetWindow.close();
    throw err;
  }
}

export function printLaporanAbsensi(bulan: number, tahun: number, targetWindow: Window): Promise<void> {
  return printLaporan('absensi', bulan, tahun, targetWindow);
}

export function printLaporanIzin(bulan: number, tahun: number, targetWindow: Window): Promise<void> {
  return printLaporan('izin', bulan, tahun, targetWindow);
}

export function printLaporanInventaris(bulan: number, tahun: number, targetWindow: Window): Promise<void> {
  return printLaporan('inventaris', bulan, tahun, targetWindow);
}