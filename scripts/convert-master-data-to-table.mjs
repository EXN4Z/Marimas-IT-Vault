#!/usr/bin/env node
/**
 * convert-master-data-to-table.mjs
 *
 * Mengubah tampilan grid kartu di tab Perusahaan dan Cabang menjadi tabel
 * (pola yang sama dengan SupplierTab/KategoriTab: .pn-card + .pn-table,
 * list di mobile, pagination menempel di dasar card).
 * Catatan: DepartemenTab sudah memakai tabel, jadi tidak disentuh.
 *
 * Pemakaian (dari root project):
 *   node convert-master-data-to-table.mjs            # terapkan
 *   node convert-master-data-to-table.mjs --dry-run  # cuma tampilkan
 *   node convert-master-data-to-table.mjs /path/ke/project
 *
 * Idempotent: file yang sudah memakai `pn-table` dilewati.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const ROOT = path.resolve(args.find((a) => !a.startsWith('--')) ?? process.cwd());

const TARGETS = [
  {
    file: 'resources/js/features/master-data/perusahaan/PerusahaanTab.tsx',
    list: 'perusahaanList',
    filtered: 'filteredPerusahaan',
    paged: 'paginatedPerusahaan',
    singular: 'perusahaan',
    Singular: 'Perusahaan',
  },
  {
    file: 'resources/js/features/master-data/cabang/CabangTab.tsx',
    list: 'cabangList',
    filtered: 'filteredCabang',
    paged: 'paginatedCabang',
    singular: 'cabang',
    Singular: 'Cabang',
  },
];

const ICONS_TO_PRUNE = ['Building2', 'MapPin', 'Phone'];

function buildBlock(t) {
  return `<div className="pn-card">
          {${t.list}.length === 0 && (
            <p className="pn-empty">Belum ada data ${t.singular}.</p>
          )}

          {${t.list}.length > 0 && ${t.filtered}.length === 0 && (
            <p className="pn-empty">${t.Singular} tidak ditemukan.</p>
          )}

          {${t.filtered}.length > 0 && (
            <>
              {/* Desktop Table */}
              <div className="hidden sm:block pn-scroll">
                <table className="pn-table">
                  <thead>
                    <tr>
                      <th>Nama</th>
                      <th>Alamat</th>
                      <th>Telepon</th>
                      <th>Lokasi</th>
                      <th className="pn-r">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {${t.paged}.map((item) => (
                      <tr key={item.id}>
                        <td className="font-medium">{item.nama}</td>
                        <td className="text-slate-600 max-w-[280px] truncate">{item.alamat || '-'}</td>
                        <td className="text-slate-600 whitespace-nowrap">{item.telepon || '-'}</td>
                        <td className="whitespace-nowrap">
                          {item.link ? (
                            <a
                              href={item.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-600 hover:text-sky-700"
                            >
                              <Map size={13} />
                              Lihat Lokasi
                            </a>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              title="Edit"
                              className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setDeleteTarget(item);
                                setDeleteError('');
                              }}
                              title="Hapus"
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile List View */}
              <div className="sm:hidden flex flex-col divide-y divide-slate-100">
                {${t.paged}.map((item) => (
                  <div key={item.id} className="p-4 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{item.nama}</p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditModal(item)}
                          title="Edit"
                          className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeleteTarget(item);
                            setDeleteError('');
                          }}
                          title="Hapus"
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {(item.alamat || item.telepon) && (
                      <div className="text-xs text-slate-500 space-y-0.5">
                        {item.alamat && <p className="truncate">{item.alamat}</p>}
                        {item.telepon && <p>{item.telepon}</p>}
                      </div>
                    )}
                    {item.link && (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-600 hover:text-sky-700"
                      >
                        <Map size={13} />
                        Lihat Lokasi
                      </a>
                    )}
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="-mx-[18px] -mb-3 mt-1 px-6 py-3 border-t border-slate-100">
                  <Pagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    onPageChange={setCurrentPage}
                    totalItems={${t.filtered}.length}
                    itemLabel="${t.singular}"
                    className="pt-0 mt-0 border-t-0"
                  />
                </div>
              )}
            </>
          )}
        </div>`;
}

/** Hapus ikon dari import lucide-react kalau setelah konversi sudah tidak dipakai lagi. */
function pruneUnusedIcons(src) {
  const m = src.match(/import\s*\{([^}]*)\}\s*from\s*'lucide-react';/);
  if (!m) return src;
  const names = m[1].split(',').map((s) => s.trim()).filter(Boolean);
  const body = src.replace(m[0], '');
  const kept = names.filter((n) => {
    if (!ICONS_TO_PRUNE.includes(n)) return true;
    return new RegExp(`\\b${n}\\b`).test(body);
  });
  if (kept.length === names.length) return src;
  return src.replace(m[0], `import { ${kept.join(', ')} } from 'lucide-react';`);
}

async function convert(t) {
  const abs = path.join(ROOT, t.file);
  let src;
  try {
    src = await fs.readFile(abs, 'utf8');
  } catch {
    return `${t.file}: tidak ditemukan, dilewati`;
  }
  if (src.includes('pn-table')) return `${t.file}: sudah tabel, dilewati`;

  const startMarker = `{${t.list}.length === 0 && (`;
  const endMarker = `\n      </div>\n\n      {/* MODAL TAMBAH / EDIT */}`;
  const start = src.indexOf(startMarker);
  const end = src.indexOf(endMarker, start);
  if (start === -1 || end === -1) {
    return `${t.file}: struktur tidak cocok (marker tidak ketemu), TIDAK diubah`;
  }

  // Blok lama harus berakhir pada penutup `)}` dari kondisi `${t.filtered}.length > 0`.
  const oldBlock = src.slice(start, end).trimEnd();
  if (!oldBlock.includes(`{${t.filtered}.length > 0 && (`) || !oldBlock.endsWith(')}')) {
    return `${t.file}: blok lama tidak sesuai dugaan, TIDAK diubah`;
  }

  let out = src.slice(0, start) + buildBlock(t) + src.slice(end);
  out = pruneUnusedIcons(out);
  if (!DRY) await fs.writeFile(abs, out, 'utf8');
  return `${t.file}: ${DRY ? 'AKAN diubah' : 'diubah'} -> tabel`;
}

for (const t of TARGETS) console.log(await convert(t));
