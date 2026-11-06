// Gaya halaman Penanganan / Inventory / Master Data / Laporan Foto (dulu kelas .pn-* di index.css).
// Hanya yang dipakai berulang (≥ 14×) dijadikan konstanta di sini; sisanya utilitas Tailwind langsung di komponen.
// Warna (text-dv-ink, bg-dd-card, …) berasal dari palet area `.pn` / `.dv` — lihat blok @theme di index.css.

/** Kartu putih (terang) / kartu bergaris (gelap) pembungkus tabel & daftar. */
export const pnCard =
  'min-w-0 rounded-[20px] bg-dd-card px-[18px] pt-3.5 pb-2.5 shadow-dd dark:border dark:border-dv-line dark:shadow-none';

/** Keadaan kosong ("Belum ada data …"). */
export const pnEmpty =
  'mb-2 rounded-[14px] border border-dashed border-dv-line px-4 py-12 text-center text-[13px] text-dv-muted';

/**
 * Tabel data: <table className={pnTable}>. Gaya <th>/<td> diberikan dari <table> lewat varian `[&_th]:` supaya sel tidak perlu kelas satu per satu.
 * Modifier: <th className="text-right"> / "text-center" untuk rata; <tr className="is-late"> menandai baris terlambat (garis kiri merah).
 */
export const pnTable = [
  'w-full border-separate border-spacing-0 text-[13px]',
  '[&_th]:bg-dv-surface [&_th]:px-3 [&_th]:py-2.5 [&_th]:text-left [&_th]:text-[11px] [&_th]:font-bold [&_th]:whitespace-nowrap [&_th]:text-dv-muted',
  '[&_th.text-center]:text-center [&_th.text-right]:text-right',
  '[&_th:first-child]:rounded-l-[10px] [&_th:last-child]:rounded-r-[10px]',
  '[&_td]:border-b [&_td]:border-dv-line [&_td]:p-3 [&_td]:align-middle [&_td]:text-dv-soft',
  '[&_tbody_tr:last-child_td]:border-b-0 [&_tbody_tr:hover_td]:bg-dv-surface/70',
  '[&_tr.is-late_td:first-child]:shadow-[inset_3px_0_0_var(--dv-alert)]',
].join(' ');
