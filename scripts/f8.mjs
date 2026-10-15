#!/usr/bin/env node
// =============================================================================
// F8 - Migrasi ke Inertia: Dashboard (admin & user) -> deferred props server; useDashboardData.ts dihapus
//      (notifikasi dashboard sengaja tetap hook terpisah useDashboardNotifications.ts sampai F9)
//
// Syarat: F1 - F7 sudah terpasang.
//
// Jalankan dari ROOT project (folder yang ada file `artisan`):
//   node f8.mjs --dry      cek dulu, tidak mengubah apa pun
//   node f8.mjs            terapkan
//   node f8.mjs --revert   kembalikan semua dari .migrasi-backup/f8/
//
// Hanya modul bawaan Node. Tidak menjalankan composer/npm/artisan.
// Semua-atau-tidak-sama-sekali: kalau ada anchor tidak ketemu / ketemu >1x (atau file yang diganti total isinya beda dari
// versi zip), script berhenti SEBELUM menulis apa pun. Aman dijalankan dua kali (yang sudah terpasang dilewati).
// Langkah { find, with } = ganti teks (harus ketemu tepat 1x). { start, end, with } = ganti dari anchor awal sampai
// SEBELUM anchor akhir (tanpa end = sampai akhir file). { replaceAll, sha } = ganti seluruh isi file, hanya jika SHA-256 isi
// aslinya (line ending dinormalisasi ke LF) cocok dengan versi yang dipakai menyusun script ini.
// =============================================================================
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const FASE = 'f8';
const ROOT = process.cwd();
const BACKUP_DIR = path.join(ROOT, '.migrasi-backup', FASE);
const MANIFEST = path.join(BACKUP_DIR, 'manifest.json');
const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry');
const REVERT = args.has('--revert');

// ---------------------------------------------------------------- DATA (hasil generate)
const NEW_FILES = [
  {
    "path": "app/Queries/DashboardQuery.php",
    "content": "<?php\n\nnamespace App\\Queries;\n\nuse App\\Models\\MasterData\\Inventory;\nuse App\\Models\\User;\nuse Carbon\\Carbon;\nuse Illuminate\\Support\\Facades\\DB;\n\n/**\n * [F8-INERTIA] Data dashboard (dulu dihitung di klien dari beberapa request axios), sekarang dihitung server dan dikirim\n * sebagai props oleh App\\Http\\Controllers\\Dashboard\\DashboardPageController. Angka & aturan dipindah APA ADANYA dari\n * pages/dashboard/useDashboardData.ts (bucket status, 6 bulan terakhir, garansi <= 30 hari, dst).\n *  - departemen() juga dipakai API lama DashboardController::KaryawanPerDepart (dihapus di F10).\n */\nclass DashboardQuery\n{\n    private const BULAN_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];\n\n    private const STATUS_LABEL = [\n        'tersedia' => 'Tersedia',\n        'dipakai' => 'Dipakai',\n        'menunggu_perbaikan' => 'Menunggu Perbaikan',\n        'diperbaiki' => 'Diperbaiki',\n        'rusak_berat' => 'Rusak Berat',\n        'dijual' => 'Dijual',\n    ];\n\n    private const GARANSI_WARNING_HARI = 30;\n\n    /** Jumlah karyawan per departemen (+ percent terhadap departemen terbesar). */\n    public static function departemen()\n    {\n        $query = User::join('departemen', 'users.departemen_id', '=', 'departemen.id')\n            ->select(\n                'departemen.nama as departemen',\n                DB::raw('COUNT(users.id) as jumlah')\n            );\n\n        $karyawan = $query->groupBy('departemen.nama')->get();\n\n        $maxJumlah = $karyawan->max('jumlah') ?: 1; // fallback 1 biar ga divide by zero\n\n        $karyawan = $karyawan->map(function ($item) use ($maxJumlah) {\n            $item->percent = round(($item->jumlah / $maxJumlah) * 100);\n            return $item;\n        });\n\n        return $karyawan;\n    }\n\n    /** Props dashboard ADMIN (lintas-perusahaan). Inventory = SEMUA item, termasuk kelengkapan. */\n    public static function admin(User $user): array\n    {\n        $list = Inventory::query()->get(['id', 'status', 'nama', 'tanggal_invoice', 'tanggal_garansi']);\n\n        $tersedia = $dipakai = $rusakBerat = $dijual = 0;\n        $rusak = $dalamPenanganan = $garansiSegeraHabis = 0;\n        $perNama = [];\n        $perStatus = [];\n        $now = time();\n        $batas = self::GARANSI_WARNING_HARI * 24 * 60 * 60;\n\n        // 6 bulan terakhir (termasuk bulan ini), jumlah inventory yang tanggal_invoice-nya jatuh di bulan itu\n        $bulan = [];\n        for ($i = 5; $i >= 0; $i--) {\n            $d = Carbon::now()->startOfMonth()->subMonthsNoOverflow($i);\n            $bulan[$d->format('Y-n')] = ['bulan' => self::BULAN_ID[$d->month - 1], 'jumlah' => 0];\n        }\n\n        foreach ($list as $a) {\n            switch ($a->status) {\n                case 'tersedia': $tersedia++; break;\n                case 'dipakai': case 'menunggu_perbaikan': case 'diperbaiki': $dipakai++; break;\n                case 'rusak_berat': $rusakBerat++; break;\n                case 'dijual': $dijual++; break;\n            }\n\n            if ($a->status === 'rusak_berat') $rusak++;\n            if ($a->status === 'menunggu_perbaikan' || $a->status === 'diperbaiki') $dalamPenanganan++;\n\n            if ($a->tanggal_garansi) {\n                $sisa = Carbon::parse($a->tanggal_garansi)->getTimestamp() - $now;\n                if ($sisa >= 0 && $sisa <= $batas) $garansiSegeraHabis++;\n            }\n\n            $nama = trim((string) $a->nama) ?: 'Tanpa Nama';\n            $perNama[$nama] = ($perNama[$nama] ?? 0) + 1;\n\n            $label = self::STATUS_LABEL[$a->status] ?? $a->status;\n            $perStatus[$label] = ($perStatus[$label] ?? 0) + 1;\n\n            if ($a->tanggal_invoice) {\n                $key = Carbon::parse($a->tanggal_invoice)->format('Y-n');\n                if (isset($bulan[$key])) $bulan[$key]['jumlah']++;\n            }\n        }\n\n        arsort($perNama); // urutan stabil: yang jumlahnya sama tetap urut kemunculan\n        $inventoryPerMerek = [];\n        foreach ($perNama as $nama => $jumlah) {\n            $inventoryPerMerek[] = ['nama' => (string) $nama, 'jumlah' => $jumlah];\n        }\n\n        $statusDistribusi = [];\n        foreach (self::STATUS_LABEL as $label) {\n            if (($perStatus[$label] ?? 0) > 0) $statusDistribusi[] = ['status' => $label, 'jumlah' => $perStatus[$label]];\n        }\n\n        return [\n            'ringkasanInventory' => [\n                'total' => $list->count(),\n                'tersedia' => $tersedia,\n                'dipakai' => $dipakai,\n                'rusakBerat' => $rusakBerat,\n                'dijual' => $dijual,\n            ],\n            'inventoryPerMerek' => $inventoryPerMerek,\n            'inventoryPerhatian' => ['rusak' => $rusak, 'dalamPenanganan' => $dalamPenanganan, 'garansiSegeraHabis' => $garansiSegeraHabis],\n            'trenPembelianInventory' => array_values($bulan),\n            'statusInventoryDistribusi' => $statusDistribusi,\n            'aktivitasKalender' => self::aktivitas($user),\n            'departemen' => self::departemen()->all(),\n        ];\n    }\n\n    /**\n     * Props dashboard NON-ADMIN: cuma data milik user sendiri. Daftar inventory dibatasi InventoryQuery::batasiUntuk()\n     * (item 'tersedia' + yang lagi dipegang user), riwayat dibatasi RiwayatInventoryQuery (milik sendiri).\n     */\n    public static function pribadi(User $user): array\n    {\n        $list = InventoryQuery::batasiUntuk(InventoryQuery::dasar(), $user)->get();\n\n        $sedangDipinjam = 0;\n        $totalTersedia = 0;\n        foreach ($list as $a) {\n            if ($a->pemakaiSaatIni?->user_id === $user->id) $sedangDipinjam++;\n            if ($a->status === 'tersedia') $totalTersedia++;\n        }\n\n        $kalender = self::aktivitas($user);\n\n        return [\n            'sedangDipinjam' => $sedangDipinjam,\n            'totalTersedia' => $totalTersedia,\n            'totalPernahDipinjam' => RiwayatInventoryQuery::ambil($user, 'pinjam', '', 1, 10)['total'],\n            'totalLaporRusak' => RiwayatInventoryQuery::ambil($user, 'lapor_rusak', '', 1, 10)['total'],\n            'aktivitasTerbaru' => array_slice($kalender, 0, 5), // feed yang sama (halaman 1, urutan terbaru), dipotong 5\n            'aktivitasKalender' => $kalender,\n        ];\n    }\n\n    /** 200 aktivitas inventory terbaru (sumber sama dengan tab Riwayat Inventory, scoping role di RiwayatInventoryQuery). */\n    private static function aktivitas(User $user): array\n    {\n        return RiwayatInventoryQuery::ambil($user, null, '', 1, 200)['data'];\n    }\n}\n"
  },
  {
    "path": "resources/js/types/dashboard.ts",
    "content": "// [F8-INERTIA] Tipe data dashboard (dulu di pages/dashboard/useDashboardData.ts) + bentuk props dari server\n// (DashboardPageController -> DashboardQuery).\nimport type { RiwayatInventoryEvent } from '../api/transaksi/inventoryPemakai';\n\nexport interface DepartemenDistribusi {\n  departemen: string;\n  jumlah: number;\n  percent: number;\n}\n\n// Ringkasan status seluruh inventory/barang inventaris — dipakai kartu\n// \"Ringkasan Status Inventory\" di dashboard.\n// Catatan: status backend inventory ada 6 (tersedia, dipakai, menunggu_perbaikan,\n// diperbaiki, rusak_berat, dijual). Supaya kartu tetap simpel 4 kategori,\n// menunggu_perbaikan & diperbaiki (inventory yang lagi dalam proses penanganan)\n// digabung ke bucket \"dipakai\" karena sama-sama belum tersedia dipinjam.\nexport interface RingkasanInventory {\n  total: number;\n  tersedia: number;\n  dipakai: number;\n  rusakBerat: number;\n  dijual: number;\n}\n\n// Distribusi jumlah inventory per nama (Laptop Lenovo, Mouse Logitech, dst)\n// — dulu per `merek`+`jenis_id`, tapi kedua kolom itu udah dihapus dari\n// tabel inventory (merek/tipe sekarang digabung jadi satu kolom `nama`),\n// jadi sumbernya sekarang kolom `nama` langsung.\n// NB: widget \"Distribusi Inventory per Merek\" ini disabled di semua\n// dashboard yang ada saat ini (lihat inventoryPerMerek: false di\n// DashboardAdmin.tsx) — gak ada card yang benar-benar render datanya.\nexport interface InventoryPerMerek {\n  nama: string;\n  jumlah: number;\n}\n\n// Tren jumlah inventory dibeli per bulan (6 bulan terakhir, dari tanggal_invoice)\n// — dipakai hero chart \"Tren Pembelian Inventory per Bulan\" di dashboard admin.\nexport interface TrenPembelianInventory {\n  bulan: string;\n  jumlah: number;\n}\n\n// Distribusi jumlah inventory per status (tersedia/dipakai/dst) — dipakai\n// donut chart \"Distribusi Status Inventory\" di dashboard admin.\nexport interface StatusInventoryDistribusi {\n  status: string;\n  jumlah: number;\n}\n\n// Ringkasan inventory yang butuh perhatian: lagi rusak/proses perbaikan, atau\n// garansinya bakal habis dalam 30 hari ke depan — dipakai kartu\n// \"Inventory Butuh Perhatian\" di dashboard admin.\nexport interface InventoryPerhatian {\n  rusak: number; // status rusak_berat\n  dalamPenanganan: number; // status menunggu_perbaikan + diperbaiki\n  garansiSegeraHabis: number; // tanggal_garansi <= 30 hari dari sekarang\n}\n\n// 5 aktivitas inventory terbaru (pinjam/kembali/lapor rusak/dst) — dipakai\n// widget \"Aktivitas Inventory Terbaru\" di dashboard admin, biar histori inventory\n// gak cuma keliatan kalau user sadar buka tab Riwayat di dalam Inventaris.\nexport type AktivitasInventoryTerbaru = RiwayatInventoryEvent;\n\n// Ringkasan aktivitas inventory PRIBADI user yang lagi login -- dipakai kartu\n// KPI \"Sedang Dipinjam\" di DashboardUser, gantiin \"Total Karyawan\" yang\n// gak seharusnya keliatan buat role non-admin. `totalTersedia` juga dihitung\n// dari list yang sama (gak perlu request tambahan) -- ini AMAN buat non-admin\n// karena GET /inventory buat role non-admin sudah balikin SEMUA item\n// 'tersedia' apa adanya (independen dari siapa yang punya), lihat\n// InventoryController::index().\n// Catatan: gak ada field \"menunggu persetujuan\" -- app ini gak punya alur\n// request/approve buat pinjam inventory (InventoryPemakaiController::store()\n// selalu langsung set status 'disetujui', admin serah-terima langsung tanpa\n// approval), jadi status 'pending' di enum gak pernah kepakai di praktiknya.\nexport interface NotificationItem {\n  id: string;\n  data: { message: string; [key: string]: any };\n  read_at: string | null;\n  created_at: string;\n}\n\nexport interface NotificationsResponse {\n  data: NotificationItem[];\n  unread_count: number;\n}\n\n\n/** Props `analitik` (admin; deferred -> undefined/null selama belum dimuat). */\nexport interface DashboardAdminData {\n  ringkasanInventory: RingkasanInventory;\n  inventoryPerMerek: InventoryPerMerek[];\n  inventoryPerhatian: InventoryPerhatian;\n  trenPembelianInventory: TrenPembelianInventory[];\n  statusInventoryDistribusi: StatusInventoryDistribusi[];\n  aktivitasKalender: AktivitasInventoryTerbaru[];\n  departemen: DepartemenDistribusi[];\n}\n\n/** Props `pribadi` (non-admin; deferred). */\nexport interface DashboardUserData {\n  sedangDipinjam: number;\n  totalTersedia: number;\n  totalPernahDipinjam: number;\n  totalLaporRusak: number;\n  aktivitasTerbaru: AktivitasInventoryTerbaru[];\n  aktivitasKalender: AktivitasInventoryTerbaru[];\n}\n"
  },
  {
    "path": "resources/js/pages/dashboard/useDashboardNotifications.ts",
    "content": "import { useEffect, useRef } from 'react';\nimport { useQuery, useQueryClient } from '@tanstack/react-query';\nimport api from '../../api/axios';\nimport { getEcho } from '../../lib/echo';\nimport type { NotificationItem, NotificationsResponse } from '../../types/dashboard';\n\n// [F8-INERTIA] Sisa dari useDashboardData.ts: HANYA notifikasi (list + realtime Echo + mark-as-read + auto-hapus 30 menit).\n// Sengaja masih axios/useQuery (data & aksi notifikasi dipindah di F9, bareng NotificationDropDown yang memakai cache\n// react-query ['notifications'] yang sama). Semua yang lain di dashboard sudah props server.\n\nasync function fetchNotifications(): Promise<NotificationsResponse> {\n  const res = await api.get<NotificationsResponse>('/notifications');\n  return res.data;\n}\n\nconst AUTO_DELETE_AFTER_READ_MS = 30 * 60 * 1000; // 30 menit\n\nexport function useDashboardNotifications(userId?: number) {\n  const queryClient = useQueryClient();\n\n  const { data: notificationsRes } = useQuery({\n    queryKey: ['notifications'],\n    queryFn: fetchNotifications,\n    staleTime: 60 * 1000,\n    enabled: !!userId,\n  });\n\n\n  const notifications = notificationsRes?.data ?? [];\n\n  useEffect(() => {\n    if ('Notification' in window && Notification.permission === 'default') {\n      Notification.requestPermission();\n    }\n  }, []);\n\n  // Realtime notifikasi via Echo/Pusher\n  useEffect(() => {\n    if (!userId) return;\n    const echo = getEcho();\n    if (!echo) return;\n\n    const channel = echo.private(`App.Models.User.${userId}`);\n\n    channel.notification((payload: any) => {\n      queryClient.setQueryData<NotificationsResponse | undefined>(['notifications'], (old) => {\n        const newItem: NotificationItem = {\n          id: payload.id,\n          data: {\n            message: payload.message,\n            status: payload.status,\n          },\n          read_at: null,\n          created_at: new Date().toISOString(),\n        };\n\n        return {\n          data: [newItem, ...(old?.data ?? [])].slice(0, 20),\n          unread_count: (old?.unread_count ?? 0) + 1,\n        };\n      });\n\n      if ('Notification' in window && Notification.permission === 'granted') {\n        new Notification('Notifikasi Baru', {\n          body: payload.message,\n          icon: `/logo.png`,\n        });\n      }\n    });\n\n    return () => {\n      if (echo && typeof echo.leave === 'function') {\n        echo.leave(`App.Models.User.${userId}`);\n      }\n    };\n  }, [userId, queryClient]);\n\n  const handleMarkAsRead = async (id: string) => {\n    try {\n      await api.post(`/notifications/${id}/read`);\n      queryClient.setQueryData<NotificationsResponse | undefined>(['notifications'], (old) => {\n        if (!old) return old;\n        return {\n          data: old.data.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),\n          unread_count: Math.max(0, old.unread_count - (old.data.find((n) => n.id === id && !n.read_at) ? 1 : 0)),\n        };\n      });\n    } catch (err) {\n      console.log(err);\n    }\n  };\n\n  const deleteNotification = async (id: string) => {\n    try {\n      await api.delete(`/notifications/${id}`);\n    } catch (err) {\n      console.log(err);\n    }\n    queryClient.setQueryData<NotificationsResponse | undefined>(['notifications'], (old) => {\n      if (!old) return old;\n      return { ...old, data: old.data.filter((n) => n.id !== id) };\n    });\n  };\n\n  // Auto-hapus notifikasi 30 menit setelah dibaca\n  const scheduledDeletes = useRef<Record<string, ReturnType<typeof setTimeout>>>({});\n\n  useEffect(() => {\n    notifications.forEach((n) => {\n      if (!n.read_at || scheduledDeletes.current[n.id]) return;\n\n      const readAt = new Date(n.read_at).getTime();\n      const deleteAt = readAt + AUTO_DELETE_AFTER_READ_MS;\n      const delay = deleteAt - Date.now();\n\n      if (delay <= 0) {\n        deleteNotification(n.id);\n        return;\n      }\n\n      scheduledDeletes.current[n.id] = setTimeout(() => {\n        deleteNotification(n.id);\n        delete scheduledDeletes.current[n.id];\n      }, delay);\n    });\n\n    const currentIds = new Set(notifications.map((n) => n.id));\n    Object.keys(scheduledDeletes.current).forEach((id) => {\n      if (!currentIds.has(id)) {\n        clearTimeout(scheduledDeletes.current[id]);\n        delete scheduledDeletes.current[id];\n      }\n    });\n    // eslint-disable-next-line react-hooks/exhaustive-deps\n  }, [notifications]);\n\n  useEffect(() => {\n    return () => {\n      Object.values(scheduledDeletes.current).forEach(clearTimeout);\n    };\n  }, []);\n\n\n  return {\n    notifications: Array.isArray(notifications) ? notifications : [],\n    handleMarkAsRead,\n  };\n}\n"
  }
];

const DELETES = [
  "resources/js/pages/dashboard/useDashboardData.ts"
];

const EDITS = [
  {
    "file": "app/Http/Controllers/Dashboard/DashboardController.php",
    "marker": "[F8-INERTIA]",
    "steps": [
      {
        "start": "    public function KaryawanPerDepart()",
        "with": "    // [F8-INERTIA] Logika di App\\Queries\\DashboardQuery::departemen() (dipakai bareng props halaman Dashboard).\n    // Endpoint ini tidak dipanggil frontend lagi; dihapus di F10.\n    public function KaryawanPerDepart()\n    {\n        return response()->json(\\App\\Queries\\DashboardQuery::departemen());\n    }\n}\n"
      }
    ]
  },
  {
    "file": "app/Http/Controllers/Dashboard/DashboardPageController.php",
    "marker": "[F8-INERTIA]",
    "steps": [
      {
        "replaceAll": "<?php\n\nnamespace App\\Http\\Controllers\\Dashboard;\n\nuse App\\Http\\Controllers\\Controller;\nuse App\\Queries\\DashboardQuery;\nuse Illuminate\\Http\\Request;\nuse Inertia\\Inertia;\n\n// [F8-INERTIA] GET /dashboard   (middleware: auth, lihat routes/web.php)\n// Semua role boleh. Data dikirim sebagai deferred props (halaman tampil dulu, skeleton sampai data datang):\n//  - admin     -> `analitik` (ringkasan/tren/status inventory, distribusi departemen, aktivitas kalender)\n//  - non-admin -> `pribadi`  (inventory milik sendiri, ringkasan & feed aktivitas milik sendiri)\n// DashboardAdmin vs DashboardUser dipilih di sisi React dari auth.user.role (sama dengan isAdmin() di sini).\n// Notifikasi sengaja belum di sini (F9).\nclass DashboardPageController extends Controller\n{\n    public function __invoke(Request $request)\n    {\n        $user = $request->user();\n        $admin = $user->isAdmin();\n\n        return Inertia::render('Dashboard/Index', [\n            'analitik' => $admin ? Inertia::defer(fn () => DashboardQuery::admin($user)) : null,\n            'pribadi' => !$admin ? Inertia::defer(fn () => DashboardQuery::pribadi($user)) : null,\n        ]);\n    }\n}\n",
        "sha": "815841d718475770a36e60fae4462098c305e587d4886acae5472df7106acfae"
      }
    ]
  },
  {
    "file": "resources/js/pages/dashboard/DashboardAdmin.tsx",
    "marker": "[F8-INERTIA]",
    "steps": [
      {
        "replaceAll": "import { useAppNavigate } from '../../hooks/useAppNavigate';\nimport { usePage } from '@inertiajs/react';\nimport { useSharedProps } from '../../hooks/useSharedProps';\nimport { useDashboardNotifications } from './useDashboardNotifications';\nimport type { DashboardAdminData } from '../../types/dashboard';\nimport { Boxes, Package, AlertTriangle, ShieldAlert } from 'lucide-react';\nimport {\n  WelcomeHeader,\n  KpiCard,\n  RingkasanInventoryCard,\n  HeroTrenPembelianInventoryChart,\n  StatusInventoryDonutCard,\n  TopInventoryCard,\n  InventoryPerhatianCard,\n  DepartemenDistribusiCard,\n  RiwayatAktivitasTableCard,\n  CalendarCard,\n  NotifikasiCard,\n  DashboardSkeleton,\n} from './widgets';\n\n// [F8-INERTIA] Data dari props `analitik` (deferred; DashboardPageController -> DashboardQuery::admin), bukan axios/useQuery.\n// Selama belum datang -> skeleton. User dari shared props (auth.user). Notifikasi masih hook sendiri (F9).\nexport default function DashboardAdmin() {\n  const navigate = useAppNavigate();\n  const { auth } = useSharedProps();\n  const user = auth?.user ?? null;\n  const { notifications, handleMarkAsRead } = useDashboardNotifications(user?.id);\n  const analitik = (usePage().props as unknown as { analitik?: DashboardAdminData | null }).analitik ?? null;\n\n  if (!analitik) {\n    return <DashboardSkeleton variant=\"full\" />;\n  }\n\n  const {\n    ringkasanInventory,\n    trenPembelianInventory,\n    inventoryPerhatian,\n    statusInventoryDistribusi,\n    inventoryPerMerek,\n    aktivitasKalender: aktivitasInventoryKalender,\n    departemen,\n  } = analitik;\n\n  const inventoryTotal = ringkasanInventory?.total ?? 0;\n  const tersediaCount = ringkasanInventory?.tersedia ?? 0;\n  const dipakaiCount = ringkasanInventory?.dipakai ?? 0;\n  const rusakBeratCount = ringkasanInventory?.rusakBerat ?? 0;\n\n  const tersediaPct = inventoryTotal > 0 ? Math.round((tersediaCount / inventoryTotal) * 100) : 0;\n  const dipakaiPct = inventoryTotal > 0 ? Math.round((dipakaiCount / inventoryTotal) * 100) : 0;\n  const rusakBeratPct = inventoryTotal > 0 ? Math.round((rusakBeratCount / inventoryTotal) * 100) : 0;\n\n  const totalPerhatian =\n    (inventoryPerhatian?.rusak ?? 0) +\n    (inventoryPerhatian?.dalamPenanganan ?? 0) +\n    (inventoryPerhatian?.garansiSegeraHabis ?? 0);\n\n  return (\n    <div className=\"space-y-3\">\n      {/* Header + primary action (DEGO \"+ Add Product\" pattern) */}\n      <WelcomeHeader\n        user={user}\n      />\n\n      {/* Row 1: High-Density Bento KPIs, each with a \"Lihat detail\" footer link */}\n      <div className=\"grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3\">\n        <KpiCard\n          icon={Boxes}\n          label=\"Total Inventory\"\n          value={inventoryTotal}\n          tone=\"default\"\n          badge={`${tersediaPct}% Ready`}\n          detailLabel={`${tersediaCount} unit siap pakai`}\n          onClick={() => navigate('/master-data?tab=inventory')}\n        />\n        <KpiCard\n          icon={Package}\n          label=\"Sedang Dipakai\"\n          value={dipakaiCount}\n          tone=\"sky\"\n          badge={`${dipakaiPct}% Use`}\n          detailLabel={`${dipakaiPct}% dari total aset`}\n          onClick={() => navigate('/master-data?tab=inventory&status=dipakai')}\n        />\n        <KpiCard\n          icon={AlertTriangle}\n          label=\"Butuh Perhatian\"\n          value={totalPerhatian}\n          tone={totalPerhatian > 0 ? 'amber' : 'emerald'}\n          badge={totalPerhatian > 0 ? 'Urgent' : 'Aman'}\n          detailLabel={`${inventoryPerhatian?.garansiSegeraHabis ?? 0} garansi < 30 hr`}\n          onClick={() => navigate('/penanganan-inventory')}\n        />\n        <KpiCard\n          icon={ShieldAlert}\n          label=\"Rusak Berat\"\n          value={rusakBeratCount}\n          tone=\"rose\"\n          badge={`${rusakBeratPct}%`}\n          detailLabel={`${rusakBeratPct}% aset tidak aktif`}\n          onClick={() => navigate('/master-data?tab=inventory&status=rusak_berat')}\n        />\n      </div>\n\n      {/* Row 2: Hero Trends & Status Breakdown (Sales Analytics + Top Cities pattern) */}\n      <div className=\"grid grid-cols-1 xl:grid-cols-12 gap-2.5 sm:gap-3 items-stretch\">\n        <div className=\"xl:col-span-7 flex flex-col\">\n          <HeroTrenPembelianInventoryChart trenPembelianInventory={trenPembelianInventory} className=\"h-full\" />\n        </div>\n        <div className=\"xl:col-span-5 flex flex-col\">\n          <StatusInventoryDonutCard statusInventoryDistribusi={statusInventoryDistribusi} className=\"h-full\" />\n        </div>\n      </div>\n\n      {/* Row 3: Full-width searchable/sortable/paginated table (DEGO \"Information by stores\" pattern) */}\n      <div>\n        <RiwayatAktivitasTableCard aktivitas={aktivitasInventoryKalender} />\n      </div>\n\n      {/* Row 4: 3-Column Asset Operations Matrix */}\n      <div className=\"grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5 sm:gap-3 items-stretch\">\n        <RingkasanInventoryCard ringkasanInventory={ringkasanInventory} />\n        <TopInventoryCard inventoryPerMerek={inventoryPerMerek} />\n        <InventoryPerhatianCard inventoryPerhatian={inventoryPerhatian} />\n      </div>\n\n      {/* Row 5: Organization & Notifications */}\n      <div className=\"grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3 items-stretch\">\n        <DepartemenDistribusiCard departemen={departemen} />\n        <NotifikasiCard notifications={notifications} onMarkAsRead={handleMarkAsRead} />\n      </div>\n\n      {/* Row 6: Operational Calendar */}\n      <div>\n        <CalendarCard aktivitas={aktivitasInventoryKalender} />\n      </div>\n    </div>\n  );\n}",
        "sha": "121bd8327f4698936d4f630a8568e29303507403bbb8dc454e4bcd4bb1025c6f"
      }
    ]
  },
  {
    "file": "resources/js/pages/dashboard/DashboardUser.tsx",
    "marker": "[F8-INERTIA]",
    "steps": [
      {
        "replaceAll": "import { usePage } from '@inertiajs/react';\nimport { useSharedProps } from '../../hooks/useSharedProps';\nimport { useDashboardNotifications } from './useDashboardNotifications';\nimport type { DashboardUserData } from '../../types/dashboard';\nimport { Package, History, AlertTriangle, Boxes } from 'lucide-react';\nimport {\n  WelcomeHeader,\n  KpiCard,\n  AktivitasInventoryCard,\n  CalendarCard,\n  NotifikasiCard,\n  DashboardSkeleton,\n} from './widgets';\n\n// Dashboard user = halaman \"home\" personal -- cuma nampilin data milik si\n// user sendiri (inventory yang lagi dia pinjam, riwayat & kalender pemakaian\n// dia, notifikasi dia). Sengaja TIDAK ada data organisasi-lebar (total\n// karyawan, distribusi departemen, dst) -- role ini gak berhak lihat itu,\n// jadi useDashboardCore dipanggil dengan includeDepartemen: false biar\n// query-nya juga gak pernah di-fetch, bukan cuma disembunyiin di UI.\n//\n// Semua 4 KPI di sini murni angka personal/faktual & real (gak ada kartu\n// \"Menunggu Persetujuan\" -- app ini gak punya alur request/approve buat\n// pinjam inventory, admin serah-terima langsung -- dan gak ada kartu status\n// akun statis kayak \"Verified\" yang isinya bukan data beneran).\n// [F8-INERTIA] Data dari props `pribadi` (deferred; DashboardPageController -> DashboardQuery::pribadi), bukan axios/useQuery.\nexport default function DashboardUser() {\n  const { auth } = useSharedProps();\n  const user = auth?.user ?? null;\n  const { notifications, handleMarkAsRead } = useDashboardNotifications(user?.id);\n  const pribadi = (usePage().props as unknown as { pribadi?: DashboardUserData | null }).pribadi ?? null;\n\n  if (!pribadi) {\n    return <DashboardSkeleton variant=\"simple\" />;\n  }\n\n  const { sedangDipinjam, totalTersedia, totalPernahDipinjam, totalLaporRusak, aktivitasTerbaru: aktivitasInventoryTerbaru, aktivitasKalender: aktivitasInventoryKalender } = pribadi;\n\n  return (\n    <div className=\"space-y-3\">\n      <WelcomeHeader user={user} />\n\n      {/* KPI Cards -- semuanya personal & real, gak ada angka lintas-organisasi */}\n      <div className=\"grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3\">\n        <KpiCard\n          icon={Package}\n          label=\"Sedang Dipinjam\"\n          value={sedangDipinjam}\n          tone={sedangDipinjam > 0 ? 'emerald' : 'default'}\n          badge={sedangDipinjam > 0 ? 'Aktif' : 'Kosong'}\n          hint=\"Inventory di tangan kamu\"\n        />\n        <KpiCard\n          icon={History}\n          label=\"Total Pernah Dipinjam\"\n          value={totalPernahDipinjam}\n          tone=\"sky\"\n          badge=\"Riwayat\"\n          hint=\"Sepanjang waktu\"\n        />\n        <KpiCard\n          icon={AlertTriangle}\n          label=\"Laporan Kerusakan\"\n          value={totalLaporRusak}\n          tone={totalLaporRusak > 0 ? 'amber' : 'default'}\n          badge={totalLaporRusak > 0 ? 'Pernah Lapor' : 'Nol'}\n          hint=\"Yang pernah kamu buat\"\n        />\n        <KpiCard\n          icon={Boxes}\n          label=\"Total Inventory Tersedia\"\n          value={totalTersedia}\n          tone=\"default\"\n          badge=\"Siap Pinjam\"\n          hint=\"Bisa kamu ajukan pinjam\"\n        />\n      </div>\n\n      {/* Main Grid: aktivitas & notifikasi milik sendiri */}\n      <div className=\"grid grid-cols-1 md:grid-cols-2 gap-2.5 sm:gap-3 items-stretch\">\n        <AktivitasInventoryCard aktivitasInventoryTerbaru={aktivitasInventoryTerbaru} />\n        <NotifikasiCard notifications={notifications} onMarkAsRead={handleMarkAsRead} />\n      </div>\n\n      {/* Kalender aktivitas pemakaian inventory milik sendiri */}\n      <div>\n        <CalendarCard aktivitas={aktivitasInventoryKalender} />\n      </div>\n    </div>\n  );\n}",
        "sha": "32a2beb5323263ae743511b255bea86a80fa19164557190adbc874611b5314b5"
      }
    ]
  },
  {
    "file": "resources/js/pages/dashboard/widgets/AktivitasInventoryCard.tsx",
    "marker": "[F8-INERTIA]",
    "steps": [
      {
        "find": "import type { AktivitasInventoryTerbaru } from '../useDashboardData';",
        "with": "import type { AktivitasInventoryTerbaru } from '../../../types/dashboard'; // [F8-INERTIA]"
      }
    ]
  },
  {
    "file": "resources/js/pages/dashboard/widgets/AktivitasTimelineList.tsx",
    "marker": "[F8-INERTIA]",
    "steps": [
      {
        "find": "import type { AktivitasInventoryTerbaru } from '../useDashboardData';",
        "with": "import type { AktivitasInventoryTerbaru } from '../../../types/dashboard'; // [F8-INERTIA]"
      }
    ]
  },
  {
    "file": "resources/js/pages/dashboard/widgets/CalendarCard.tsx",
    "marker": "[F8-INERTIA]",
    "steps": [
      {
        "find": "import type { AktivitasInventoryTerbaru } from '../useDashboardData';",
        "with": "import type { AktivitasInventoryTerbaru } from '../../../types/dashboard'; // [F8-INERTIA]"
      }
    ]
  },
  {
    "file": "resources/js/pages/dashboard/widgets/DepartemenDistribusiCard.tsx",
    "marker": "[F8-INERTIA]",
    "steps": [
      {
        "find": "import type { DepartemenDistribusi } from '../useDashboardData';",
        "with": "import type { DepartemenDistribusi } from '../../../types/dashboard'; // [F8-INERTIA]"
      }
    ]
  },
  {
    "file": "resources/js/pages/dashboard/widgets/HeroTrenPembelianInventoryChart.tsx",
    "marker": "[F8-INERTIA]",
    "steps": [
      {
        "find": "import type { TrenPembelianInventory } from '../useDashboardData';",
        "with": "import type { TrenPembelianInventory } from '../../../types/dashboard'; // [F8-INERTIA]"
      }
    ]
  },
  {
    "file": "resources/js/pages/dashboard/widgets/InventoryPerhatianCard.tsx",
    "marker": "[F8-INERTIA]",
    "steps": [
      {
        "find": "import type { InventoryPerhatian } from '../useDashboardData';",
        "with": "import type { InventoryPerhatian } from '../../../types/dashboard'; // [F8-INERTIA]"
      }
    ]
  },
  {
    "file": "resources/js/pages/dashboard/widgets/NotifikasiCard.tsx",
    "marker": "[F8-INERTIA]",
    "steps": [
      {
        "find": "import type { NotificationItem } from '../useDashboardData';",
        "with": "import type { NotificationItem } from '../../../types/dashboard'; // [F8-INERTIA]"
      }
    ]
  },
  {
    "file": "resources/js/pages/dashboard/widgets/RingkasanInventoryCard.tsx",
    "marker": "[F8-INERTIA]",
    "steps": [
      {
        "find": "import type { RingkasanInventory } from '../useDashboardData';",
        "with": "import type { RingkasanInventory } from '../../../types/dashboard'; // [F8-INERTIA]"
      }
    ]
  },
  {
    "file": "resources/js/pages/dashboard/widgets/RiwayatAktivitasTableCard.tsx",
    "marker": "[F8-INERTIA]",
    "steps": [
      {
        "find": "import type { AktivitasInventoryTerbaru } from '../useDashboardData';",
        "with": "import type { AktivitasInventoryTerbaru } from '../../../types/dashboard'; // [F8-INERTIA]"
      }
    ]
  },
  {
    "file": "resources/js/pages/dashboard/widgets/StatusInventoryDonutCard.tsx",
    "marker": "[F8-INERTIA]",
    "steps": [
      {
        "find": "import type { StatusInventoryDistribusi } from '../useDashboardData';",
        "with": "import type { StatusInventoryDistribusi } from '../../../types/dashboard'; // [F8-INERTIA]"
      }
    ]
  },
  {
    "file": "resources/js/pages/dashboard/widgets/TopInventoryCard.tsx",
    "marker": "[F8-INERTIA]",
    "steps": [
      {
        "find": "import type { InventoryPerMerek } from '../useDashboardData';",
        "with": "import type { InventoryPerMerek } from '../../../types/dashboard'; // [F8-INERTIA]"
      }
    ]
  },
  {
    "file": "resources/js/pages/dashboard/widgets/aktivitas.ts",
    "marker": "[F8-INERTIA]",
    "steps": [
      {
        "find": "import type { AktivitasInventoryTerbaru } from '../useDashboardData';",
        "with": "import type { AktivitasInventoryTerbaru } from '../../../types/dashboard'; // [F8-INERTIA]"
      }
    ]
  },
  {
    "file": "resources/js/inertia/pages/Dashboard/Index.tsx",
    "marker": "[F8-INERTIA]",
    "steps": [
      {
        "find": "// Tahap P8: SHELL doang. Data tetap lewat react-query (useDashboardData) ke /api.\n// DashboardAdmin / DashboardUser / widgets / useDashboardData TETAP di pages/dashboard/ dan di-import dari sini.\n",
        "with": "// [F8-INERTIA] SHELL: pilih DashboardAdmin / DashboardUser dari role. Data masing-masing = deferred props server\n// (analitik / pribadi) yang dibaca komponennya lewat usePage(); tidak ada react-query/axios untuk data dashboard\n// (notifikasi baru pindah di F9). Komponen & widgets masih di pages/dashboard/.\n"
      }
    ]
  }
];

// ---------------------------------------------------------------- RUNTIME

const abs = (rel) => path.join(ROOT, ...rel.split('/'));
const log = (...a) => console.log(...a);
const toLF = (s) => s.replace(/\r\n/g, '\n');

function countOccurrences(hay, needle) {
  if (!needle) return 0;
  let n = 0;
  let i = hay.indexOf(needle);
  while (i !== -1) {
    n++;
    i = hay.indexOf(needle, i + needle.length);
  }
  return n;
}

function fail(msg) {
  console.error('\n[BERHENTI] ' + msg);
  console.error('Tidak ada file yang diubah.');
  process.exit(1);
}

if (!fs.existsSync(abs('artisan')) || !fs.existsSync(abs('package.json'))) {
  fail('Jalankan dari root project (folder yang berisi `artisan` dan `package.json`). Sekarang di: ' + ROOT);
}

// ------------------------------------------------------------------ REVERT
if (REVERT) {
  if (!fs.existsSync(MANIFEST)) {
    log('Tidak ada manifest backup untuk ' + FASE + ' (belum pernah dijalankan, atau sudah di-revert). Selesai.');
    process.exit(0);
  }
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const restored = [];
  const removed = [];
  const undeleted = [];
  for (const rel of [...(m.modified || []), ...(m.deleted || [])]) {
    const bak = path.join(BACKUP_DIR, ...rel.split('/'));
    if (!fs.existsSync(bak)) fail('Backup hilang untuk ' + rel + ' (' + bak + '). Revert dibatalkan.');
  }
  for (const rel of m.modified || []) {
    const bak = path.join(BACKUP_DIR, ...rel.split('/'));
    if (!DRY) fs.copyFileSync(bak, abs(rel));
    restored.push(rel);
  }
  for (const rel of m.deleted || []) {
    const bak = path.join(BACKUP_DIR, ...rel.split('/'));
    if (!DRY) {
      fs.mkdirSync(path.dirname(abs(rel)), { recursive: true });
      fs.copyFileSync(bak, abs(rel));
    }
    undeleted.push(rel);
  }
  for (const rel of m.created || []) {
    if (fs.existsSync(abs(rel))) {
      if (!DRY) {
        fs.rmSync(abs(rel));
        // rapikan folder kosong yang tadinya dibuat F8 (berhenti di folder pertama yang masih berisi)
        let dir = path.dirname(abs(rel));
        while (dir.startsWith(ROOT) && dir !== ROOT && fs.existsSync(dir) && fs.readdirSync(dir).length === 0) {
          fs.rmdirSync(dir);
          dir = path.dirname(dir);
        }
      }
      removed.push(rel);
    }
  }
  if (!DRY) fs.rmSync(MANIFEST);
  log((DRY ? '[DRY] ' : '') + 'REVERT ' + FASE.toUpperCase());
  restored.forEach((r) => log('  dikembalikan     : ' + r));
  undeleted.forEach((r) => log('  dipulihkan       : ' + r));
  removed.forEach((r) => log('  dihapus (baru)   : ' + r));
  process.exit(0);
}

// ------------------------------------------------------------ SYARAT: F1-F8 SUDAH TERPASANG
for (const rel of [
  'app/Queries/InventoryQuery.php',
  'app/Queries/RiwayatInventoryQuery.php',
  'app/Queries/FotoInventoryQuery.php',
  'resources/js/types/laporan.ts',
  'resources/js/hooks/useSharedProps.ts',
]) {
  if (!fs.existsSync(abs(rel))) fail('F8 butuh F1-F8 yang sudah terpasang (' + rel + ' tidak ditemukan). Jalankan fase sebelumnya dulu.');
}

// -------------------------------------------------------------------- PLAN
const problems = [];
const toCreate = []; // { rel, content }
const toModify = []; // { rel, original(raw), output(raw) }
const toDelete = []; // { rel, original(raw) }
const skipped = [];

for (const nf of NEW_FILES) {
  const p = abs(nf.path);
  if (fs.existsSync(p)) {
    const cur = fs.readFileSync(p, 'utf8');
    if (cur.includes('[F8-INERTIA]')) skipped.push(nf.path + ' (sudah ada)');
    else problems.push('File sudah ada tapi bukan hasil F8, tidak ditimpa: ' + nf.path);
    continue;
  }
  toCreate.push({ rel: nf.path, content: nf.content });
}

for (const ed of EDITS) {
  const p = abs(ed.file);
  if (!fs.existsSync(p)) {
    problems.push('File tidak ditemukan: ' + ed.file);
    continue;
  }
  const raw = fs.readFileSync(p, 'utf8');
  const hadCRLF = raw.includes('\r\n');
  let text = toLF(raw);

  if (text.includes(ed.marker)) {
    skipped.push(ed.file + ' (sudah terpasang)');
    continue;
  }

  let ok = true;
  ed.steps.forEach((st, i) => {
    const label = ed.file + ' langkah ' + (i + 1);
    if ('replaceAll' in st) {
      const sha = crypto.createHash('sha256').update(text).digest('hex');
      if (sha !== st.sha) {
        ok = false;
        problems.push(label + ': isi file lokal BERBEDA dari versi zip yang dipakai menyusun script ini (sha ' + sha.slice(0, 12) + ' != ' + st.sha.slice(0, 12) + '), tidak ditimpa.');
        return;
      }
      text = st.replaceAll;
      return;
    }
    if ('find' in st) {
      const c = countOccurrences(text, st.find);
      if (c !== 1) {
        ok = false;
        problems.push(label + ': anchor ' + (c === 0 ? 'TIDAK ketemu' : 'ketemu ' + c + 'x (harus tepat 1)') + ' -> ' + JSON.stringify(st.find.slice(0, 90)));
        return;
      }
      text = text.replace(st.find, () => st.with);
    } else {
      const cs = countOccurrences(text, st.start);
      if (cs !== 1) {
        ok = false;
        problems.push(label + ': anchor awal ' + (cs === 0 ? 'TIDAK ketemu' : 'ketemu ' + cs + 'x (harus tepat 1)') + ' -> ' + JSON.stringify(st.start.slice(0, 90)));
        return;
      }
      const a = text.indexOf(st.start);
      if (!('end' in st)) {
        // ganti dari anchor awal sampai akhir file
        text = text.slice(0, a) + st.with;
        return;
      }
      const b = text.indexOf(st.end, a + st.start.length);
      const ce = countOccurrences(text, st.end);
      if (b === -1 || ce !== 1) {
        ok = false;
        problems.push(label + ': anchor akhir ' + (b === -1 ? 'TIDAK ketemu setelah anchor awal' : 'ketemu ' + ce + 'x (harus tepat 1)') + ' -> ' + JSON.stringify(st.end.slice(0, 90)));
        return;
      }
      // ganti [a, b) -- anchor akhir tetap dipertahankan
      text = text.slice(0, a) + st.with + text.slice(b);
    }
  });
  if (!ok) continue;

  const output = hadCRLF ? text.replace(/\n/g, '\r\n') : text;
  toModify.push({ rel: ed.file, original: raw, output });
}

for (const rel of DELETES) {
  const p = abs(rel);
  if (!fs.existsSync(p)) {
    skipped.push(rel + ' (sudah terhapus)');
    continue;
  }
  toDelete.push({ rel, original: fs.readFileSync(p, 'utf8') });
}

if (problems.length) {
  console.error('\nPre-check GAGAL:');
  problems.forEach((p) => console.error('  - ' + p));
  console.error('\nKemungkinan file lokal kamu sudah berbeda dari versi zip yang dipakai untuk menyusun script ini.');
  console.error('Kirim isi pesan ini + file terkait ke Claude untuk disesuaikan.');
  fail('Pre-check tidak lolos.');
}

// ------------------------------------------------------------------- APPLY
log((DRY ? '[DRY RUN] ' : '') + 'F8 - Dashboard -> Inertia deferred props');
if (!DRY) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  // Run baru (belum ada manifest, mis. sesudah --revert) -> backup SELALU diperbarui dari kondisi file sekarang,
  // supaya revert berikutnya tidak mengembalikan backup basi. Run lanjutan (manifest ada) -> backup asli dipertahankan.
  const freshRun = !fs.existsSync(MANIFEST);
  let manifest = { created: [], modified: [], deleted: [] };
  if (!freshRun) manifest = { created: [], modified: [], deleted: [], ...JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) };

  const backup = (rel, original) => {
    const bak = path.join(BACKUP_DIR, ...rel.split('/'));
    if (freshRun || !fs.existsSync(bak)) {
      fs.mkdirSync(path.dirname(bak), { recursive: true });
      fs.writeFileSync(bak, original, 'utf8');
    }
  };

  // 1) semua backup + manifest ditulis DULU sebelum ada file proyek yang disentuh
  for (const m of toModify) {
    backup(m.rel, m.original);
    if (!manifest.modified.includes(m.rel)) manifest.modified.push(m.rel);
  }
  for (const d of toDelete) {
    backup(d.rel, d.original);
    if (!manifest.deleted.includes(d.rel)) manifest.deleted.push(d.rel);
  }
  for (const c of toCreate) {
    if (!manifest.created.includes(c.rel)) manifest.created.push(c.rel);
  }
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');

  // 2) baru terapkan
  for (const m of toModify) fs.writeFileSync(abs(m.rel), m.output, 'utf8');
  for (const c of toCreate) {
    fs.mkdirSync(path.dirname(abs(c.rel)), { recursive: true });
    fs.writeFileSync(abs(c.rel), c.content, 'utf8');
  }
  for (const d of toDelete) fs.rmSync(abs(d.rel));
}

// ----------------------------------------------------------------- SUMMARY
log('');
log('Dibuat   (' + toCreate.length + ')');
toCreate.forEach((c) => log('  + ' + c.rel));
log('Diubah   (' + toModify.length + ')');
toModify.forEach((m) => log('  ~ ' + m.rel));
log('Dihapus  (' + toDelete.length + ')  -- dipindah ke backup, bisa dikembalikan dengan --revert');
toDelete.forEach((d) => log('  - ' + d.rel));
log('Dilewati (' + skipped.length + ')');
skipped.forEach((s) => log('  = ' + s));

if (DRY) {
  log('\nDry run selesai, tidak ada yang ditulis. Jalankan tanpa --dry untuk menerapkan.');
} else {
  log('\nBackup asli: .migrasi-backup/f8/   (kembalikan: node f8.mjs --revert)');
}
log('\nLangkah berikut (jalankan sendiri):');
log('  php artisan route:list --path=dashboard');
log('  npx tsc --noEmit');
log('  npm run build');
