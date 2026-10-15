#!/usr/bin/env node
// F9 — Auth / Settings / Notifikasi -> Inertia.
// Jalankan dari root project:  node f9.mjs --dry | node f9.mjs | node f9.mjs --revert
import fs from 'node:fs';
import path from 'node:path';

const R = String.raw;
const ROOT = process.cwd();
const PHASE = 'f9';
const BACKUP_DIR = path.join(ROOT, '.migrasi-backup', PHASE);
const MANIFEST = path.join(BACKUP_DIR, 'manifest.json');
const argv = new Set(process.argv.slice(2));
const DRY = argv.has('--dry');
const REVERT = argv.has('--revert');

const P = (p) => path.join(ROOT, ...p.split('/'));
const exists = (p) => fs.existsSync(P(p));

if (!exists('artisan') || !exists('routes/web.php')) {
  console.error('GAGAL: jalankan dari root project Laravel (artisan / routes/web.php tidak ditemukan).');
  process.exit(1);
}

// ---------------------------------------------------------------------------------------------
// ISI FILE BARU
// ---------------------------------------------------------------------------------------------
const NEW_FILES = {};

NEW_FILES['resources/js/lib/http.ts'] = R`// [F9-INERTIA] Helper fetch JSON same-origin, pengganti axios untuk 3 pengecualian JSON:
// (1) polling notifikasi + aksinya, (2) push-subscription, (3) autentikasi channel Echo (/broadcasting/auth).
// Cookie sesi ikut otomatis; CSRF lewat header X-XSRF-TOKEN yang dibaca dari cookie XSRF-TOKEN.
// Mutasi halaman TIDAK lewat sini -- pakai router/useForm Inertia.

export class HttpError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, data: unknown) {
    super('HTTP ' + status);
    this.name = 'HttpError';
    this.status = status;
    this.data = data;
  }
}

function xsrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)XSRF-TOKEN=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : '';
}

export async function requestJson<T = unknown>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  };

  const token = xsrfToken();
  if (token) headers['X-XSRF-TOKEN'] = token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(url, {
    method,
    headers,
    credentials: 'same-origin',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) throw new HttpError(res.status, data);
  return data as T;
}
`;

NEW_FILES['resources/js/types/notification.ts'] = R`// [F9-INERTIA] Tipe notifikasi (dulu di api/notifications.ts + types/dashboard.ts).
export interface AppNotification {
  id: string;
  type?: string;
  data: {
    message: string;
    url?: string;
    silent?: boolean;
    status?: string;
    [key: string]: any;
  };
  read_at: string | null;
  created_at: string;
}

export interface NotificationResponse {
  data: AppNotification[];
  unread_count: number;
}
`;

NEW_FILES['resources/js/context/NotificationsContext.tsx'] = R`import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { router } from '@inertiajs/react';
import { useAuth } from './AuthContext';
import { HttpError, requestJson } from '../lib/http';
import type { AppNotification, NotificationResponse } from '../types/notification';

// [F9-INERTIA] Satu sumber data notifikasi untuk bell (NotificationDropDown) dan kartu Notifikasi di Dashboard,
// menggantikan react-query ['notifications'].
// Keputusan: SENGAJA tetap JSON (bukan props Inertia):
//  - dipoll tiap 5 detik dan dipasang di SEMUA halaman. Polling lewat router.reload akan menjalankan ulang controller
//    halaman aktif tiap 5 detik dan bisa membatalkan visit/submit form yang sedang berjalan;
//  - tandai-dibaca/hapus dikerjakan optimistic dari state lokal dan tidak mengubah props halaman manapun.
// Endpoint: GET /notifications, POST /notifications/{id}/read, POST /notifications/read-all, DELETE /notifications/{id}
// (route web, controller NotificationController yang sama dengan route /api lama).

const POLL_INTERVAL_MS = 5000;
const MAX_ITEMS = 20;

interface NotificationsContextType {
  items: AppNotification[];
  unreadCount: number;
  loaded: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Tambah notif dari luar polling (realtime Echo di Dashboard). */
  addLocal: (item: AppNotification) => void;
}

const NotificationsContext = createContext<NotificationsContextType | undefined>(undefined);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;

  const [feed, setFeed] = useState<NotificationResponse | null>(null);
  const version = useRef(0); // naik tiap perubahan lokal; hasil polling yang mulai sebelum perubahan dibuang
  const inFlight = useRef(false);
  const lastJson = useRef<string | null>(null); // skip setState kalau isi polling sama (hindari render ulang Dashboard)

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const startedAt = version.current;

    try {
      const res = await requestJson<NotificationResponse>('GET', '/notifications');
      if (version.current !== startedAt) return;

      const json = JSON.stringify(res);
      if (json !== lastJson.current) {
        lastJson.current = json;
        setFeed(res);
      }
    } catch (err) {
      // Sesi habis -> balik ke login (sama seperti interceptor 401 axios dulu). Error lain: coba lagi di tick berikutnya.
      if (err instanceof HttpError && err.status === 401 && !window.location.pathname.startsWith('/login')) {
        router.visit('/login');
      }
    } finally {
      inFlight.current = false;
    }
  }, []);

  useEffect(() => {
    if (!userId) return;

    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(timer);
  }, [userId, refresh]);

  const mutate = useCallback((fn: (old: NotificationResponse) => NotificationResponse) => {
    version.current += 1;
    lastJson.current = null;
    setFeed((old) => (old ? fn(old) : old));
  }, []);

  const markAsRead = useCallback(
    async (id: string) => {
      mutate((old) => {
        const target = old.data.find((n) => n.id === id);
        if (!target || target.read_at) return old;
        return {
          data: old.data.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)),
          unread_count: Math.max(0, old.unread_count - 1),
        };
      });

      try {
        await requestJson('POST', '/notifications/' + encodeURIComponent(id) + '/read');
      } catch {
        void refresh(); // gagal -> sinkron ulang dari server
      }
    },
    [mutate, refresh],
  );

  const markAllAsRead = useCallback(async () => {
    mutate((old) => ({
      data: old.data.map((n) => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })),
      unread_count: 0,
    }));

    try {
      await requestJson('POST', '/notifications/read-all');
    } catch {
      void refresh();
    }
  }, [mutate, refresh]);

  const remove = useCallback(
    async (id: string) => {
      mutate((old) => {
        const target = old.data.find((n) => n.id === id);
        return {
          data: old.data.filter((n) => n.id !== id),
          unread_count: target && !target.read_at ? Math.max(0, old.unread_count - 1) : old.unread_count,
        };
      });

      try {
        await requestJson('DELETE', '/notifications/' + encodeURIComponent(id));
      } catch {
        void refresh();
      }
    },
    [mutate, refresh],
  );

  const addLocal = useCallback((item: AppNotification) => {
    version.current += 1;
    lastJson.current = null;
    setFeed((old) => {
      const base = old ?? { data: [], unread_count: 0 };
      if (base.data.some((n) => n.id === item.id)) return base;
      return {
        data: [item, ...base.data].slice(0, MAX_ITEMS),
        unread_count: base.unread_count + (item.read_at ? 0 : 1),
      };
    });
  }, []);

  const items = useMemo(() => feed?.data ?? [], [feed]);

  const value = useMemo<NotificationsContextType>(
    () => ({
      items,
      unreadCount: feed?.unread_count ?? 0,
      loaded: feed !== null,
      markAsRead,
      markAllAsRead,
      remove,
      addLocal,
    }),
    [items, feed, markAsRead, markAllAsRead, remove, addLocal],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const context = useContext(NotificationsContext);
  if (!context) throw new Error('useNotifications must be used within NotificationsProvider');
  return context;
}
`;

NEW_FILES['app/Actions/Auth/ResendRegistrationOtp.php'] = R`<?php

namespace App\Actions\Auth;

use App\Mail\OtpMail;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Mail;
use Illuminate\Validation\ValidationException;

/**
 * Kirim ulang OTP registrasi (dipindah apa adanya dari AuthController::resendOtp).
 * Dipakai bareng oleh API (AuthController::resendOtp) dan web (WebAuthController::resendOtp).
 */
class ResendRegistrationOtp
{
    public static function run(string $registrationId): void
    {
        $data = Cache::get("register:{$registrationId}");

        if (!$data) {
            throw ValidationException::withMessages([
                'registration_id' => ['Sesi registrasi kedaluwarsa, silakan daftar ulang.'],
            ]);
        }

        $otp = rand(100000, 999999);
        $data['otp_code'] = $otp;

        Cache::put("register:{$registrationId}", $data, now()->addMinutes(5));

        Mail::to($data['email'])->send(new OtpMail($otp));
    }
}
`;

// ---------------------------------------------------------------------------------------------
// EDIT FILE YANG SUDAH ADA
//  { name, marker, find, replace }            -> ganti teks persis (harus ketemu tepat 1x)
//  { name, marker, start, end, replace }      -> ganti region dari awal `start` sampai akhir `end` (masing-masing tepat 1x)
//  marker = teks yang HANYA ada setelah edit diterapkan (dipakai untuk deteksi sudah-diterapkan -> skip)
// ---------------------------------------------------------------------------------------------
const EDITS = {};

// ----- routes/web.php
EDITS['routes/web.php'] = [
  {
    name: 'use controller notifikasi',
    marker: R`use App\Http\Controllers\Notifikasi\NotificationController;`,
    find: R`use App\Http\Middleware\LogActivity;`,
    replace: R`use App\Http\Controllers\Notifikasi\NotificationController;
use App\Http\Controllers\Notifikasi\PushSubscriptionController;
use App\Http\Middleware\LogActivity;`,
  },
  {
    name: 'route resend-otp (guest)',
    marker: `'/resend-otp'`,
    find: R`Route::post('/verify-otp', [WebAuthController::class, 'verifyOtp']);`,
    replace: R`Route::post('/verify-otp', [WebAuthController::class, 'verifyOtp']);
Route::post('/resend-otp', [WebAuthController::class, 'resendOtp']); // [F9-INERTIA] tombol "Kirim ulang kode" di halaman verifikasi OTP`,
  },
  {
    name: 'route notifikasi + push-subscription',
    marker: `'/notifications/read-all'`,
    find: `    // Settings (semua role yang login)`,
    replace: R`    // [F9-INERTIA] Notifikasi (bell + kartu Dashboard) & push subscription: SENGAJA tetap JSON, bukan Inertia (pengecualian).
    //  - GET /notifications dipoll klien tiap 5 detik; aksinya (tandai dibaca / hapus) optimistic dari state lokal dan
    //    tidak mengubah props halaman manapun, jadi tidak perlu redirect + render ulang halaman aktif.
    //  - /push-subscriptions dipanggil di background (izin browser, dan sebelum logout), bukan aksi halaman.
    // Controller-nya SAMA dengan route /api lama (tidak ada logic ganda). LogActivity sengaja tidak dipasang: ini bukan
    // perubahan data bisnis (dulu tercatat generik di audit log lewat grup 'api').
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead']); // statis di atas {id}
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
    Route::delete('/notifications/{id}', [NotificationController::class, 'destroy']);
    Route::post('/push-subscriptions', [PushSubscriptionController::class, 'store']);
    Route::delete('/push-subscriptions', [PushSubscriptionController::class, 'destroy']);

    // Settings (semua role yang login)`,
  },
];

// ----- WebAuthController
EDITS['app/Http/Controllers/Auth/WebAuthController.php'] = [
  {
    name: 'use action resend',
    marker: R`use App\Actions\Auth\ResendRegistrationOtp;`,
    find: R`use App\Actions\Auth\ResolveLoginUser;`,
    replace: R`use App\Actions\Auth\ResendRegistrationOtp;
use App\Actions\Auth\ResolveLoginUser;`,
  },
  {
    name: 'method resendOtp',
    marker: `public function resendOtp`,
    find: `    // POST /logout\n`,
    replace: R`    // POST /resend-otp   (sesi registrasi kedaluwarsa -> props errors.registration_id, halaman VerifyOtp yang menampilkan)
    public function resendOtp(Request $request)
    {
        $request->validate([
            'registration_id' => 'required|string',
        ]);

        ResendRegistrationOtp::run((string) $request->input('registration_id'));

        return back()->with('success', 'Kode OTP baru sudah dikirim ke email kamu');
    }

    // POST /logout
`,
  },
];

// ----- AuthController (API): logic resend pindah ke Action bersama
EDITS['app/Http/Controllers/Auth/AuthController.php'] = [
  {
    name: 'use action resend',
    marker: R`use App\Actions\Auth\ResendRegistrationOtp;`,
    find: R`use App\Actions\Profile\UpdatePassword;`,
    replace: R`use App\Actions\Auth\ResendRegistrationOtp;
use App\Actions\Profile\UpdatePassword;`,
  },
  {
    name: 'resendOtp -> Action',
    marker: `ResendRegistrationOtp::run(`,
    start: `        $data = Cache::get("register:{$request->registration_id}");`,
    end: `        $this->sendOtpEmail($data['email'], $otp);`,
    replace: `        // Logic ada di App\\Actions\\Auth\\ResendRegistrationOtp (dipakai juga WebAuthController::resendOtp).
        ResendRegistrationOtp::run((string) $request->registration_id);`,
  },
];

// ----- VerifyOtp
EDITS['resources/js/inertia/pages/Auth/VerifyOtp.tsx'] = [
  {
    name: 'hapus import api/auth',
    marker: `[F9-INERTIA] tanpa api/auth`,
    find: `import { router } from '@inertiajs/react';\nimport { resendOtp } from '../../../api/auth';`,
    replace: `import { router } from '@inertiajs/react';\n// [F9-INERTIA] tanpa api/auth: kirim ulang OTP lewat router.post (route web)`,
  },
  {
    name: 'handleResend -> router.post',
    marker: `onSuccess: () => setResendMsg(`,
    start: `  const handleResend = async () => {`,
    end: `      setResendMsg('Gagal mengirim ulang OTP');\n    }\n  };`,
    replace: `  // [F9-INERTIA] resend: POST /resend-otp (WebAuthController). Halaman ini tanpa layout, jadi pesan ditampilkan lokal
  // (bukan lewat FlashToaster). preserveState supaya kode OTP yang sudah diketik tidak hilang.
  const handleResend = () => {
    setResendMsg('');
    router.post(
      '/resend-otp',
      { registration_id: registrationId },
      {
        preserveState: true,
        preserveScroll: true,
        onSuccess: () => setResendMsg('Kode OTP baru sudah dikirim ke email kamu'),
        onError: (errors) => setResendMsg(errors.registration_id || 'Gagal mengirim ulang OTP'),
      },
    );
  };`,
  },
];

// ----- api/pushNotifications.ts (tetap dipakai hook + logout; axios diganti requestJson, route web)
EDITS['resources/js/api/pushNotifications.ts'] = [
  {
    name: 'import http',
    marker: `import { requestJson } from '../lib/http';`,
    find: `import api from './axios';`,
    replace: `import { requestJson } from '../lib/http'; // [F9-INERTIA] route web /push-subscriptions (JSON), bukan /api + axios`,
  },
  {
    name: 'save',
    marker: `await requestJson('POST', '/push-subscriptions'`,
    find: `  await api.post('/push-subscriptions', {\n    endpoint: json.endpoint,\n    keys: json.keys,\n  });`,
    replace: `  await requestJson('POST', '/push-subscriptions', {\n    endpoint: json.endpoint,\n    keys: json.keys,\n  });`,
  },
  {
    name: 'remove',
    marker: `await requestJson('DELETE', '/push-subscriptions'`,
    find: `  await api.delete('/push-subscriptions', { data: { endpoint } });`,
    replace: `  await requestJson('DELETE', '/push-subscriptions', { endpoint });`,
  },
];

// ----- lib/echo.ts
EDITS['resources/js/lib/echo.ts'] = [
  {
    name: 'import http',
    marker: `import { requestJson } from './http';`,
    find: `import api from '../api/axios';`,
    replace: `import { requestJson } from './http';`,
  },
  {
    name: 'komentar',
    marker: `dikirim lewat requestJson`,
    start: `// Autentikasi channel private lewat session cookie: POST /broadcasting/auth (route web, middleware`,
    end: `// Instance dibuat sekali; waktu user ganti/logout halaman di-reload penuh (atau disconnectEcho()).`,
    replace: `// Autentikasi channel private lewat session cookie: POST /broadcasting/auth (route web, middleware
// web+auth, lihat withBroadcasting di bootstrap/app.php) dikirim lewat requestJson (lib/http.ts: same-origin,
// cookie + header X-XSRF-TOKEN otomatis).
// Instance dibuat sekali; waktu user ganti/logout halaman di-reload penuh (atau disconnectEcho()).`,
  },
  {
    name: 'authorizer',
    marker: `requestJson('POST', '/broadcasting/auth'`,
    find: `        api
          .post('/broadcasting/auth', { socket_id: socketId, channel_name: channel.name }, { baseURL: '/' })
          .then((response) => callback(false, response.data))
          .catch((error) => callback(true, error));`,
    replace: `        requestJson('POST', '/broadcasting/auth', { socket_id: socketId, channel_name: channel.name })
          .then((data) => callback(false, data))
          .catch((error) => callback(true, error));`,
  },
];

// ----- AuthContext
EDITS['resources/js/context/AuthContext.tsx'] = [
  {
    name: 'imports',
    marker: `import { router } from '@inertiajs/react';`,
    start: `import { createContext, useContext, useRef, useState, type ReactNode } from 'react';`,
    end: `import { unsubscribeThisDevice } from '../api/pushNotifications';`,
    replace: `import { createContext, useContext, useState, type ReactNode } from 'react';
import { router } from '@inertiajs/react';
import type { User } from '../types/user';
import { disconnectEcho } from '../lib/echo';
import { unsubscribeThisDevice } from '../api/pushNotifications';`,
  },
  {
    name: 'tipe logout',
    marker: `logout: () => Promise<void>;`,
    find: `  logout: () => Promise<{ password_direset?: boolean } | undefined>;`,
    replace: `  logout: () => Promise<void>;`,
  },
  {
    name: 'provider body',
    marker: `const stopInvalid = router.on('httpException'`,
    start: `// initialUser = auth.user dari shared props Inertia halaman pertama (session cookie). Setelah itu`,
    end: `    </AuthContext.Provider>\n  );\n}`,
    replace: `// initialUser = auth.user dari shared props Inertia halaman pertama (session cookie). Setelah itu
// InertiaAuthSync (di dalam layout) menyamakannya tiap navigasi, jadi sumber kebenaran = server.
// Tidak ada lagi token / user di localStorage dan tidak ada GET /user.
export function AuthProvider({ children, initialUser }: { children: ReactNode; initialUser: User | null }) {
  const [user, setUser] = useState<User | null>(initialUser);

  // Urutan: unsubscribe push DULU (DELETE /push-subscriptions butuh sesi yang masih valid), baru POST /logout
  // (route web, WebAuthController::logout -> Inertia::location('/login')). Redirect ke /login = tugas pemanggil (layout).
  const logout = async (): Promise<void> => {
    await unsubscribeThisDevice();
    disconnectEcho();

    await new Promise<void>((resolve) => {
      // 'httpException' (Inertia v3) = respons non-Inertia (mis. 419 karena sesi sudah habis): jangan tampilkan modal error,
      // tujuannya sama saja (balik ke /login).
      const stopInvalid = router.on('httpException', (event) => event.preventDefault());
      router.post(
        '/logout',
        {},
        {
          onFinish: () => {
            stopInvalid();
            resolve();
          },
        },
      );
    });

    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}`,
  },
];

// ----- InertiaAppLayout
EDITS['resources/js/components/layout/InertiaAppLayout.tsx'] = [
  {
    name: 'import provider',
    marker: `import { NotificationsProvider }`,
    find: `import FlashToaster from './FlashToaster';`,
    replace: `import FlashToaster from './FlashToaster';\nimport { NotificationsProvider } from '../../context/NotificationsContext';`,
  },
  {
    name: 'komentar logout',
    marker: `POST /logout (route web)`,
    find: `    // logout() (AuthContext, mode Inertia): unsubscribe push -> POST /api/logout -> bersihin state.`,
    replace: `    // logout() (AuthContext): unsubscribe push -> POST /logout (route web) -> bersihin state.`,
  },
  {
    name: 'bungkus provider',
    marker: `<NotificationsProvider>`,
    start: `    <AppLayoutShell pathname={pathname} search={search} onNavigate={onNavigate} onLogout={onLogout}>`,
    end: `    </AppLayoutShell>`,
    replace: `    <NotificationsProvider>
      <AppLayoutShell pathname={pathname} search={search} onNavigate={onNavigate} onLogout={onLogout}>
        <InertiaAuthSync />
        <FlashToaster />
        {children}
      </AppLayoutShell>
    </NotificationsProvider>`,
  },
];

// ----- NotificationDropDown
EDITS['resources/js/components/layout/NotificationDropDown.tsx'] = [
  {
    name: 'imports',
    marker: `import { useNotifications } from '../../context/NotificationsContext';`,
    start: `import { useQuery, useQueryClient } from '@tanstack/react-query';`,
    end: `} from '../../api/notifications';`,
    replace: `import { Bell, Check, Trash2, CheckCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNotifications } from '../../context/NotificationsContext';
import type { AppNotification } from '../../types/notification';`,
  },
  {
    name: 'data & toast notif baru',
    marker: `const { items, unreadCount, loaded, markAsRead, markAllAsRead, remove } = useNotifications();`,
    start: `  const queryClient = useQueryClient();`,
    end: `  }, [data]);`,
    replace: `  const navigate = useAppNavigate();

  // [F9-INERTIA] Sumber data = NotificationsProvider (context/NotificationsContext.tsx): satu poller JSON
  // (GET /notifications, tiap 5 detik) + aksi tandai-dibaca/hapus, dipakai bareng kartu Notifikasi di Dashboard,
  // jadi badge di sini dan di Dashboard selalu sinkron.
  const { items, unreadCount, loaded, markAsRead, markAllAsRead, remove } = useNotifications();
  const isLoading = !loaded;

  // Notif baru (ID yang belum pernah kelihatan, belum dibaca, bukan data.silent) -> toast alert. Notif silent
  // (mis. laporan kerusakan untuk pelapornya sendiri) tetap masuk list & unread_count, cuma toast-nya di-skip.
  const seenIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!loaded) return;

    const currentIds = new Set(items.map((n) => n.id));

    if (seenIdsRef.current) {
      const belumPernahMuncul = items.filter(
        (n) => !seenIdsRef.current!.has(n.id) && !n.read_at && !n.data?.silent
      );

      belumPernahMuncul.forEach((n) => {
        toast(n.data?.message ?? 'Notifikasi baru.', { icon: '🔔' });
      });
    }

    seenIdsRef.current = currentIds;
  }, [items, loaded]);`,
  },
  {
    name: 'handler aksi',
    marker: `void markAsRead(id)`,
    start: `  const handleMarkAsRead = async (id: string) => {`,
    end: `      console.error('Gagal menghapus notifikasi.', err);\n      queryClient.invalidateQueries({ queryKey: ['notifications'] });\n    }\n  };`,
    replace: `  // Aksi optimistic + sinkron ke server ada di NotificationsProvider.
  const handleMarkAsRead = (id: string) => {
    void markAsRead(id);
  };

  const handleMarkAllAsRead = () => {
    void markAllAsRead();
  };

  const handleDelete = (id: string) => {
    void remove(id);
  };`,
  },
];

// ----- useDashboardNotifications: data & aksi dari context
EDITS['resources/js/pages/dashboard/useDashboardNotifications.ts'] = [
  {
    name: 'rewrite hook',
    marker: `useNotifications()`,
    start: `import { useEffect, useRef } from 'react';`,
    end: `    handleMarkAsRead,\n  };\n}`,
    replace: `import { useEffect, useRef } from 'react';
import { useNotifications } from '../../context/NotificationsContext';
import { getEcho } from '../../lib/echo';

// [F9-INERTIA] Notifikasi Dashboard: data & aksi (tandai-dibaca/hapus) datang dari NotificationsProvider (satu poller
// JSON bareng NotificationDropDown), bukan axios/useQuery. Yang tersisa di sini: realtime Echo, notif browser, dan
// auto-hapus 30 menit setelah dibaca.

const AUTO_DELETE_AFTER_READ_MS = 30 * 60 * 1000; // 30 menit

export function useDashboardNotifications(userId?: number) {
  const { items: notifications, markAsRead, remove, addLocal } = useNotifications();

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Realtime notifikasi via Echo/Pusher
  useEffect(() => {
    if (!userId) return;
    const echo = getEcho();
    if (!echo) return;

    const channelName = 'App.Models.User.' + userId;
    const channel = echo.private(channelName);

    channel.notification((payload: any) => {
      addLocal({
        id: payload.id,
        data: {
          message: payload.message,
          status: payload.status,
        },
        read_at: null,
        created_at: new Date().toISOString(),
      });

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Notifikasi Baru', {
          body: payload.message,
          icon: '/logo.png',
        });
      }
    });

    return () => {
      if (echo && typeof echo.leave === 'function') {
        echo.leave(channelName);
      }
    };
  }, [userId, addLocal]);

  const handleMarkAsRead = (id: string) => {
    void markAsRead(id);
  };

  // Auto-hapus notifikasi 30 menit setelah dibaca
  const scheduledDeletes = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    notifications.forEach((n) => {
      if (!n.read_at || scheduledDeletes.current[n.id]) return;

      const readAt = new Date(n.read_at).getTime();
      const deleteAt = readAt + AUTO_DELETE_AFTER_READ_MS;
      const delay = deleteAt - Date.now();

      if (delay <= 0) {
        void remove(n.id);
        return;
      }

      scheduledDeletes.current[n.id] = setTimeout(() => {
        void remove(n.id);
        delete scheduledDeletes.current[n.id];
      }, delay);
    });

    const currentIds = new Set(notifications.map((n) => n.id));
    Object.keys(scheduledDeletes.current).forEach((id) => {
      if (!currentIds.has(id)) {
        clearTimeout(scheduledDeletes.current[id]);
        delete scheduledDeletes.current[id];
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notifications]);

  useEffect(() => {
    return () => {
      Object.values(scheduledDeletes.current).forEach(clearTimeout);
    };
  }, []);

  return {
    notifications,
    handleMarkAsRead,
  };
}`,
  },
];

// ----- types/dashboard.ts: tipe notifikasi jadi alias ke types/notification.ts (tanpa duplikasi)
EDITS['resources/js/types/dashboard.ts'] = [
  {
    name: 'alias tipe notifikasi',
    marker: `from './notification';`,
    start: `export interface NotificationItem {`,
    end: `export interface NotificationsResponse {\n  data: NotificationItem[];\n  unread_count: number;\n}`,
    replace: `// [F9-INERTIA] Tipe notifikasi dipindah ke types/notification.ts (satu definisi); nama lama tetap bisa diimport.
export type { AppNotification as NotificationItem, NotificationResponse as NotificationsResponse } from './notification';`,
  },
];

// ---------------------------------------------------------------------------------------------
// MESIN (tidak perlu diubah)
// ---------------------------------------------------------------------------------------------
const log = (...a) => console.log(...a);

function readFile(rel) {
  const raw = fs.readFileSync(P(rel), 'utf8');
  const eol = raw.includes('\r\n') ? '\r\n' : '\n';
  return { raw, eol, text: eol === '\r\n' ? raw.replace(/\r\n/g, '\n') : raw };
}

const withEol = (text, eol) => (eol === '\r\n' ? text.replace(/\n/g, '\r\n') : text);
const countOf = (hay, needle) => (needle === '' ? 0 : hay.split(needle).length - 1);

function applyOps(rel, text, ops) {
  const report = [];
  let cur = text;
  for (const op of ops) {
    if (cur.includes(op.marker)) {
      report.push({ op: op.name, status: 'skip' });
      continue;
    }
    if (op.find !== undefined) {
      const n = countOf(cur, op.find);
      if (n !== 1) return { error: `[${rel}] anchor "${op.name}" ${n === 0 ? 'TIDAK ketemu' : 'ketemu ' + n + 'x (harus tepat 1x)'}.` };
      cur = cur.replace(op.find, () => op.replace);
    } else {
      const ns = countOf(cur, op.start);
      const ne = countOf(cur, op.end);
      if (ns !== 1) return { error: `[${rel}] anchor awal "${op.name}" ${ns === 0 ? 'TIDAK ketemu' : 'ketemu ' + ns + 'x (harus tepat 1x)'}.` };
      if (ne !== 1) return { error: `[${rel}] anchor akhir "${op.name}" ${ne === 0 ? 'TIDAK ketemu' : 'ketemu ' + ne + 'x (harus tepat 1x)'}.` };
      const si = cur.indexOf(op.start);
      const ei = cur.indexOf(op.end);
      if (ei < si) return { error: `[${rel}] anchor "${op.name}": akhir berada sebelum awal.` };
      cur = cur.slice(0, si) + op.replace + cur.slice(ei + op.end.length);
    }
    if (!cur.includes(op.marker)) return { error: `[${rel}] "${op.name}": marker tidak muncul setelah edit (bug script).` };
    report.push({ op: op.name, status: 'apply' });
  }
  return { text: cur, report };
}

function copyToBackup(rel) {
  const dest = path.join(BACKUP_DIR, ...rel.split('/'));
  if (fs.existsSync(dest)) return; // jangan timpa backup asli
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(P(rel), dest);
}

function revert() {
  if (!fs.existsSync(MANIFEST)) {
    log('Tidak ada manifest F9 (.migrasi-backup/f9/manifest.json): tidak ada yang bisa di-revert.');
    return;
  }
  const m = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const restored = [];
  const removed = [];
  for (const rel of m.modified ?? []) {
    const src = path.join(BACKUP_DIR, ...rel.split('/'));
    if (!fs.existsSync(src)) {
      console.error(`PERINGATAN: backup ${rel} hilang, dilewati.`);
      continue;
    }
    if (!DRY) fs.copyFileSync(src, P(rel));
    restored.push(rel);
  }
  for (const rel of m.created ?? []) {
    if (exists(rel)) {
      if (!DRY) fs.unlinkSync(P(rel));
      removed.push(rel);
    }
  }
  if (!DRY) fs.unlinkSync(MANIFEST);
  log(`\n${DRY ? '[DRY] ' : ''}REVERT F9 selesai`);
  log(`  dikembalikan: ${restored.length}`);
  restored.forEach((f) => log('    ~ ' + f));
  log(`  file baru dihapus: ${removed.length}`);
  removed.forEach((f) => log('    - ' + f));
}

function main() {
  if (REVERT) return revert();

  const eolNew = readFile('routes/web.php').eol; // file baru ikut line ending project
  const results = [];
  const errors = [];

  for (const [rel, content] of Object.entries(NEW_FILES)) {
    const text = withEol(content, eolNew);
    if (exists(rel)) {
      const cur = fs.readFileSync(P(rel), 'utf8');
      if (cur === text) results.push({ rel, kind: 'skip', note: 'sudah ada (identik)' });
      else errors.push(`[${rel}] sudah ada tapi isinya beda dari yang diharapkan F9. Hapus/periksa dulu, script tidak menimpa.`);
    } else {
      results.push({ rel, kind: 'create', text });
    }
  }

  for (const [rel, ops] of Object.entries(EDITS)) {
    if (!exists(rel)) {
      errors.push(`[${rel}] file tidak ditemukan.`);
      continue;
    }
    const { raw, eol, text } = readFile(rel);
    const r = applyOps(rel, text, ops);
    if (r.error) {
      errors.push(r.error);
      continue;
    }
    const changed = r.report.some((x) => x.status === 'apply');
    results.push({
      rel,
      kind: changed ? 'modify' : 'skip',
      note: r.report.map((x) => `${x.status === 'apply' ? '+' : '='} ${x.op}`).join('; '),
      text: changed ? withEol(r.text, eol) : raw,
    });
  }

  if (errors.length) {
    console.error('\nGAGAL — tidak ada file yang diubah:');
    errors.forEach((e) => console.error('  ✗ ' + e));
    console.error('\nKemungkinan file sudah berbeda dari kondisi saat F9 ditulis. Kirim isi file terkait, jangan edit manual dulu.');
    process.exit(1);
  }

  const created = results.filter((r) => r.kind === 'create');
  const modified = results.filter((r) => r.kind === 'modify');
  const skipped = results.filter((r) => r.kind === 'skip');

  if (!DRY) {
    for (const r of modified) copyToBackup(r.rel);
    for (const r of [...created, ...modified]) {
      fs.mkdirSync(path.dirname(P(r.rel)), { recursive: true });
      fs.writeFileSync(P(r.rel), r.text, 'utf8');
    }
    if (created.length || modified.length) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
      let prev = { created: [], modified: [] };
      if (fs.existsSync(MANIFEST)) prev = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
      const uni = (a, b) => [...new Set([...(a ?? []), ...b])];
      fs.writeFileSync(
        MANIFEST,
        JSON.stringify(
          {
            created: uni(prev.created, created.map((r) => r.rel)),
            modified: uni(prev.modified, modified.map((r) => r.rel)),
            deleted: [],
          },
          null,
          2,
        ),
        'utf8',
      );
    }
  }

  log(`\n${DRY ? '[DRY RUN — tidak ada yang ditulis] ' : ''}RINGKASAN F9`);
  log(`  dibuat   (${created.length})`);
  created.forEach((r) => log('    + ' + r.rel));
  log(`  diubah   (${modified.length})`);
  modified.forEach((r) => log('    ~ ' + r.rel + '   [' + r.note + ']'));
  log(`  dihapus  (0)`);
  log(`  dilewati (${skipped.length})${skipped.length ? ' — sudah diterapkan / identik' : ''}`);
  skipped.forEach((r) => log('    = ' + r.rel));

  if (!DRY && (created.length || modified.length)) {
    log(`\nBackup: .migrasi-backup/${PHASE}/   (kembalikan: node f9.mjs --revert)`);
  }
  log('\nPerintah verifikasi (jalankan sendiri):');
  log('  npx tsc --noEmit');
  log('  npm run build');
  log('  php artisan route:list --path=notifications');
  log('  php artisan route:list --path=push-subscriptions');
  log('  php artisan route:list --path=resend-otp');
}

main();
