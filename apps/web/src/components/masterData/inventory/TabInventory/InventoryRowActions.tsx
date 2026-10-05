import { Pencil, Trash2, HandCoins, Undo2, Wrench, Eye, Link2, Unlink } from 'lucide-react';
import { useAuth } from '../../../../context/AuthContext';
import { userIdPemakai } from '../../../../utils/inventoryHelpers';
import type { Inventory } from '../../../../api/masterData/inventory';
import type { InventoryPemakai } from '../../../../api/transaksi/inventoryPemakai';

interface InventoryRowActionsProps {
  a: Inventory;
  isAdmin: boolean;
  openDetail: (id: number) => void | Promise<void>;
  setPerbaikanInventoryTarget: React.Dispatch<React.SetStateAction<Inventory | null>>;
  setLepasTarget: React.Dispatch<React.SetStateAction<Inventory | null>>;
  setEditingInventory: React.Dispatch<React.SetStateAction<Inventory | null>>;
  setFormOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setDeleteError: React.Dispatch<React.SetStateAction<string>>;
  setDeleteForceAvailable: React.Dispatch<React.SetStateAction<boolean>>;
  setDeleteTarget: React.Dispatch<React.SetStateAction<Inventory | null>>;
  user: ReturnType<typeof useAuth>['user'];
  setPasangIndukTarget: React.Dispatch<React.SetStateAction<Inventory | null>>;
  setSerahTerimaInventory: React.Dispatch<React.SetStateAction<Inventory | null>>;
  setPengembalianTarget: React.Dispatch<React.SetStateAction<{ inventory: Inventory; pemakai: InventoryPemakai } | null>>;
}

export default function InventoryRowActions({ a, isAdmin, openDetail, setPerbaikanInventoryTarget, setLepasTarget, setEditingInventory, setFormOpen, setDeleteError, setDeleteForceAvailable, setDeleteTarget, user, setPasangIndukTarget, setSerahTerimaInventory, setPengembalianTarget }: InventoryRowActionsProps) {
  // Aksi buat baris Kelengkapan yang MASIH NEMPEL ke induk (parent_id
  // terisi) -- Lapor Kerusakan (admin, status tersedia/dipakai; lewat modal
  // InventoryLaporKerusakanModal + alur InventoryPenanganan yang sama kaya
  // Barang Utama -- kalau hasilnya "diperbaiki" tetap nempel ke induk, kalau
  // "rusak_berat" backend otomatis copot parent_id + kembaliin pemakaian
  // aktif, lihat InventoryPenangananController::update()), Edit, Hapus.
  // Detail (lihat riwayat/spesifikasi item ini sendiri) tetap ada, tapi
  // TIDAK ada Serah Terima/Terima Kembali/Jual (kelengkapan yang nempel
  // gak ikut alur peminjaman perorangan -- dia ikut serah-terima/kembali
  // BARENG induknya lewat form Barang Utama, bukan sendiri-sendiri).
  // Non-admin gak dapat aksi apapun di baris ini, sama seperti behaviour
  // TabKelengkapanInventory.tsx yang lama.
  //
  // Kelengkapan yang BERDIRI SENDIRI (parent_id null) sudah TIDAK lewat sini
  // lagi -- dia dispatch ke renderAksiInventory yang sama kaya Barang Utama
  // (lihat renderAksi di bawah).
  const renderAksiKelengkapan = (a: Inventory) => {
    // Detail (Eye) selalu tampil buat item yang menempel ke induk, apapun
    // statusnya dan apapun rolenya (admin/non-admin) -- biar user tetep bisa
    // lihat riwayat/spesifikasi item anak walau lagi tersedia/dipakai/dst.
    if (!isAdmin) {
      return (
        <button
          onClick={() => openDetail(a.id)}
          title="Detail"
          className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
        >
          <Eye size={15} />
        </button>
      );
    }
    return (
      <>
        <button
          onClick={() => openDetail(a.id)}
          title="Detail"
          className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
        >
          <Eye size={15} />
        </button>
        {(a.status === 'tersedia' || a.status === 'dipakai') && (
          <button
            onClick={() => setPerbaikanInventoryTarget(a)}
            title="Lapor Kerusakan"
            className="p-2 text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition"
          >
            <Wrench size={15} />
          </button>
        )}
        {(a.status === 'menunggu_perbaikan' || a.status === 'diperbaiki' || a.status === 'rusak_berat') && (
          <span
            title="Laporan kerusakan sudah dikirim, menunggu/sedang ditangani"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-2 rounded-lg cursor-default"
          >
            <Wrench size={14} />
            Sudah Lapor
          </span>
        )}
        {/* BARU (3B): Lepas dari Induk — muncul kalau kelengkapan masih nempel (parent_id terisi).
            Kondisi a.parent_id pasti terisi di sini karena renderAksiKelengkapan hanya
            dipanggil dari renderAksi kalau a.parent_id truthy, tapi tetap dipakai
            kondisi ini sebagai defensive check. */}
        {a.parent_id && (
          <button
            onClick={() => setLepasTarget(a)}
            title="Lepas dari Induk"
            className="p-2 text-amber-600 bg-amber-50 rounded-lg hover:bg-amber-100 transition"
          >
            <Unlink size={15} />
          </button>
        )}
        <button
          onClick={() => {
            setEditingInventory(a);
            setFormOpen(true);
          }}
          title="Edit"
          className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
        >
          <Pencil size={15} />
        </button>
        <button
          onClick={() => {
            setDeleteError('');
            setDeleteForceAvailable(false);
            setDeleteTarget(a);
          }}
          title="Hapus"
          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
        >
          <Trash2 size={15} />
        </button>
      </>
    );
  };

  // Dispatcher aksi tabel gabungan -- item yang masih MENEMPEL ke induk
  // (parent_id terisi) pakai set aksi terbatas (renderAksiKelengkapan),
  // apapun kategorinya. Item yang berdiri sendiri (parent_id null) pakai
  // set aksi penuh (renderAksiInventory) -- boleh di-Serahkan/di-Terima
  // Kembali/Lapor Rusak langsung, tanpa lewat induk.
  const renderAksi = (a: Inventory) =>
    a.parent_id ? renderAksiKelengkapan(a) : renderAksiInventory(a);

  // Dipakai bareng oleh tabel (desktop) & card (mobile) biar tombol aksinya
  // gak ke-duplikasi/nyimpang antara 2 tampilan itu.
  //
  // BARU: karena tabel non-admin sekarang cuma berisi inventory berstatus
  // 'tersedia' (item yang lagi mereka pakai dipindah ke card "Sedang Anda
  // Pakai" -- lihat myBorrowedItems), baris tabel buat karyawan/cabang cuma
  // punya aksi Detail.
  const renderAksiInventory = (a: Inventory) => {
    const akuPeminjamnya = userIdPemakai(a.pemakai_saat_ini) === user?.id;
    const bolehLihatDetail = isAdmin || a.status === 'tersedia' || akuPeminjamnya;

    if (!isAdmin) {
      return (
        <>
          {bolehLihatDetail && (
            <button
              onClick={() => openDetail(a.id)}
              title="Detail"
              className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            >
              <Eye size={15} />
            </button>
          )}
        </>
      );
    }

    return (
      <>
        {bolehLihatDetail && (
          <button
            onClick={() => openDetail(a.id)}
            title="Detail"
            className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
          >
            <Eye size={15} />
          </button>
        )}

        {/* Item manapun yang berdiri sendiri (parent_id null) &
            tersedia bisa dipasang ke item lain sebagai child -- tidak terbatas
            ke kategori tertentu lagi. */}
        {!a.parent_id && a.status === 'tersedia' && (
          <button
            onClick={() => setPasangIndukTarget(a)}
            title="Pasang ke Induk"
            className="p-2 text-sky-600 bg-sky-50 rounded-lg hover:bg-sky-100 transition"
          >
            <Link2 size={15} />
          </button>
        )}
        {a.status === 'tersedia' && (
          <button
            onClick={() => setSerahTerimaInventory(a)}
            title="Serahkan ke Karyawan"
            className="p-2 text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition"
          >
            <HandCoins size={15} />
          </button>
        )}
        {a.status === 'dipakai' && a.pemakai_saat_ini && (
          <button
            onClick={() => setPengembalianTarget({ inventory: a, pemakai: a.pemakai_saat_ini! })}
            title="Terima Kembali"
            className="p-2 text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition"
          >
            <Undo2 size={15} />
          </button>
        )}
        {/* Admin bisa lapor kerusakan untuk status tersedia atau dipakai */}
        {(a.status === 'tersedia' || a.status === 'dipakai') && (
          <button
            onClick={() => setPerbaikanInventoryTarget(a)}
            title="Lapor Kerusakan"
            className="p-2 text-red-700 bg-red-50 rounded-lg hover:bg-red-100 transition"
          >
            <Wrench size={15} />
          </button>
        )}
        {(a.status === 'menunggu_perbaikan' || a.status === 'diperbaiki' || a.status === 'rusak_berat') && (
          <span
            title="Laporan kerusakan sudah dikirim, menunggu/sedang ditangani"
            className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 bg-slate-100 px-3 py-2 rounded-lg cursor-default"
          >
            <Wrench size={14} />
            Sudah Lapor
          </span>
        )}
        <button
          onClick={() => {
            setEditingInventory(a);
            setFormOpen(true);
          }}
          title="Edit"
          className="p-2 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
        >
          <Pencil size={15} />
        </button>
        <button
          onClick={() => {
            setDeleteError('');
            setDeleteForceAvailable(false);
            setDeleteTarget(a);
          }}
          title="Hapus"
          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
        >
          <Trash2 size={15} />
        </button>
      </>
    );
  };

  return renderAksi(a);
}
