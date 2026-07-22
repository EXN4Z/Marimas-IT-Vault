import Papa from 'papaparse';
import * as XLSX from 'xlsx';
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

// Helper generik: hit endpoint /laporan/{jenis}?bulan=&tahun=&... sebagai blob, parse
// hasilnya, lalu render sebagai tabel HTML rapi yang ditulis ke jendela print yang
// SUDAH dibuka (lihat printCsvReport.ts untuk alasan kenapa window-nya harus dibuka
// duluan, sebelum fetch data). Semua endpoint dibatasi backend ke role admin/hr/manajer.
// extraParams: query tambahan opsional, misal { status: 'telat' } untuk filter khusus.

async function printLaporan(
  jenis: JenisLaporan,
  bulan: number,
  tahun: number,
  targetWindow: Window,
  extraParams: Record<string, string> = {}
): Promise<void> {
  try {
    const res = await api.get(`/laporan/${jenis}`, {
      params: { bulan, tahun, ...extraParams },
      responseType: 'blob',
    });

    const csvText = await (res.data as Blob).text();
    printCsvAsReport(
      csvText,
      {
        title: extraParams.status === 'telat' ? 'Laporan Karyawan Terlambat' : laporanTitle[jenis],
        periodLabel: `${bulanLabel[bulan - 1]} ${tahun}`,
      },
      targetWindow
    );
  } catch (err) {
    targetWindow.close();
    throw err;
  }
}

// Helper generik: hit endpoint CSV yang sama seperti printLaporan, tapi hasilnya
// di-convert jadi file .xlsx beneran (pakai SheetJS) lalu langsung di-download
// lewat browser. Tidak perlu window baru karena tidak ada proses "print" di sini,
// cuma trigger file download.
async function downloadLaporanExcel(
  jenis: JenisLaporan,
  bulan: number,
  tahun: number,
  extraParams: Record<string, string> = {}
): Promise<void> {
  const res = await api.get(`/laporan/${jenis}`, {
    params: { bulan, tahun, ...extraParams },
    responseType: 'blob',
  });

  
  const csvText = await (res.data as Blob).text();

  // PENTING: parsing manual pakai PapaParse, BUKAN XLSX.read(csvText, {type:'string'}).
  // XLSX.read punya auto-detect tipe data yang suka salah nebak kolom tanggal/teks
  // sebagai angka (mis. "21/07/2026 08:30" jadi serial number Excel seperti
  // 46215.29 tanpa format tanggal yang benar). Dengan PapaParse, setiap sel dibaca
  // sebagai string apa adanya, lalu aoa_to_sheet menyimpannya sebagai teks (type 's')
  // tanpa konversi otomatis apapun.
  const parsed = Papa.parse<string[]>(csvText.trim(), { skipEmptyLines: true });
  const rows = parsed.data;

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();

  // Nama sheet maks 31 karakter (batas Excel)
  const title = extraParams.status === 'telat' ? 'Laporan Karyawan Terlambat' : laporanTitle[jenis];
  const sheetName = title.slice(0, 31);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const filename = `${title} - ${bulanLabel[bulan - 1]} ${tahun}.xlsx`;
  XLSX.writeFile(workbook, filename);
}

interface AbsensiStatusParams {
  status: 'telat' | 'tepat_waktu';
  tanggal_mulai: string;
  tanggal_selesai: string;
  label: string;
}

function judulAbsensiStatus(p: AbsensiStatusParams): string {
  const statusLabel = p.status === 'telat' ? 'Terlambat' : 'Tepat Waktu';
  return `Laporan Karyawan ${statusLabel}`;
}

export async function printLaporanAbsensiStatus(p: AbsensiStatusParams, targetWindow: Window): Promise<void> {
  try {
    const res = await api.get('/laporan/absensi', {
      params: { status: p.status, tanggal_mulai: p.tanggal_mulai, tanggal_selesai: p.tanggal_selesai },
      responseType: 'blob',
    });

    const csvText = await (res.data as Blob).text();
    printCsvAsReport(
      csvText,
      { title: judulAbsensiStatus(p), periodLabel: p.label },
      targetWindow
    );
  } catch (err) {
    targetWindow.close();
    throw err;
  }
}

export async function downloadLaporanAbsensiStatusExcel(p: AbsensiStatusParams): Promise<void> {
  const res = await api.get('/laporan/absensi', {
    params: { status: p.status, tanggal_mulai: p.tanggal_mulai, tanggal_selesai: p.tanggal_selesai },
    responseType: 'blob',
  });

  const csvText = await (res.data as Blob).text();
  const parsed = Papa.parse<string[]>(csvText.trim(), { skipEmptyLines: true });
  const rows = parsed.data;

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();

  const title = judulAbsensiStatus(p);
  const sheetName = title.slice(0, 31);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  const filename = `${title} - ${p.label}.xlsx`;
  XLSX.writeFile(workbook, filename);
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

export function downloadLaporanAbsensiExcel(bulan: number, tahun: number): Promise<void> {
  return downloadLaporanExcel('absensi', bulan, tahun);
}

export function downloadLaporanIzinExcel(bulan: number, tahun: number): Promise<void> {
  return downloadLaporanExcel('izin', bulan, tahun);
}

export function downloadLaporanInventarisExcel(bulan: number, tahun: number): Promise<void> {
  return downloadLaporanExcel('inventaris', bulan, tahun);
}

// BARU: khusus data karyawan terlambat, dipakai dari chat AI
export function printLaporanKaryawanTerlambat(bulan: number, tahun: number, targetWindow: Window): Promise<void> {
  return printLaporan('absensi', bulan, tahun, targetWindow, { status: 'telat' });
}

export function downloadLaporanKaryawanTerlambatExcel(bulan: number, tahun: number): Promise<void> {
  return downloadLaporanExcel('absensi', bulan, tahun, { status: 'telat' });
}