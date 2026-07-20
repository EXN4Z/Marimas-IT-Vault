export interface ChatIntent {
  label: string;
  path: string;
  keywords: string[];
}

// User harus nyebut salah satu kata "minta tutorial" INI...
const TRIGGER_WORDS = [
  'cara', 'gimana', 'bagaimana', 'tutorial', 'panduan', 'langkah',
  'gmn', 'gmna', 'how to',
];

// ...DAN salah satu keyword fitur di bawah, baru dianggap valid buat redirect.
// path harus persis sama kayak yang didaftarkan di App.tsx (routing).
const intents: ChatIntent[] = [
  { label: 'Absensi', path: '/absensi', keywords: ['absen', 'absensi', 'scan qr', 'check in', 'checkin', 'check-in'] },
  { label: 'Data Karyawan', path: '/karyawan', keywords: ['data karyawan', 'daftar karyawan', 'karyawan'] },
  { label: 'Tambah Karyawan', path: '/karyawan/create', keywords: ['tambah karyawan', 'karyawan baru', 'daftarkan karyawan', 'daftar karyawan'] },
  { label: 'Pengajuan Izin', path: '/izin', keywords: ['izin', 'cuti'] },
  { label: 'Ajukan Izin', path: '/izin/create', keywords: ['ajukan izin', 'buat izin', 'mengajukan cuti', 'ajukan cuti'] },
  { label: 'Ticketing', path: '/ticketing', keywords: ['ticket', 'tiket', 'ticketing'] },
  { label: 'Inventaris', path: '/inventaris', keywords: ['barang', 'inventaris', 'stok'] },
  { label: 'Agenda', path: '/agenda', keywords: ['agenda', 'jadwal', 'meeting'] },
  { label: 'Laporan', path: '/laporan', keywords: ['laporan', 'report'] },
  { label: 'Master Data', path: '/master-data', keywords: ['master data', 'departemen', 'jabatan', 'kategori barang'] },
  { label: 'Settings', path: '/settings', keywords: ['pengaturan', 'ubah password', 'profil saya', 'setting'] },
];

// Cari intent yang cocok. Butuh trigger word ("cara", "gimana", dst) DAN
// keyword fitur, biar gak asal redirect tiap kali user nyebut nama fitur
// secara sambil lalu (mis. "tadi saya udah absen").
export function detectIntent(message: string): ChatIntent | null {
  const lower = message.toLowerCase();

  const hasTrigger = TRIGGER_WORDS.some((w) => lower.includes(w));
  if (!hasTrigger) return null;

  let best: { intent: ChatIntent; matchLen: number } | null = null;
  for (const intent of intents) {
    for (const kw of intent.keywords) {
      if (lower.includes(kw) && (!best || kw.length > best.matchLen)) {
        best = { intent, matchLen: kw.length };
      }
    }
  }

  return best?.intent ?? null;
}