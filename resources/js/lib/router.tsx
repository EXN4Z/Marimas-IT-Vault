/**
 * Pengganti 'react-router-dom' di atas Inertia.
 *
 * Komponen lama (AppLayout, halaman, widget dashboard, dll) tetap pakai API
 * yang sama: useNavigate / useLocation / useSearchParams / useParams /
 * Navigate / Outlet -- cuma import-nya diarahkan ke file ini. Di balik layar
 * semuanya jalan lewat router Inertia (visit ke route Laravel).
 *
 * Catatan perilaku:
 *  - navigate(url, { state }) : state disimpan di memori (bukan history.state),
 *    jadi hilang kalau browser di-refresh.
 *  - backgroundLocation (pola overlay react-router) TIDAK dipakai lagi; halaman
 *    /karyawan/* di-render komposit (lihat inertia/pages/Karyawan/*).
 *  - useParams membaca props.params yang dikirim dari route Laravel.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { router, usePage } from '@inertiajs/react';

let navState: unknown = null;
let inAppNavigation = false;

if (typeof window !== 'undefined') {
  // 'before' hanya jalan untuk visit dari dalam app (bukan load awal), jadi
  // ini penanda "ada history internal yang aman dipakai buat navigate(-1)".
  router.on('before', () => {
    inAppNavigation = true;
  });
}

/** true kalau sudah pernah pindah halaman di dalam app sejak halaman ini dibuka. */
export function hasInAppNavigation(): boolean {
  return inAppNavigation;
}

function parseUrl(url: string) {
  const u = new URL(url, window.location.origin);
  return { pathname: u.pathname, search: u.search, hash: u.hash };
}

export interface NavigateOptions {
  replace?: boolean;
  state?: unknown;
}

export function useNavigate() {
  return useCallback((to: string | number, options?: NavigateOptions) => {
    if (typeof to === 'number') {
      window.history.go(to);
      return;
    }
    navState = options?.state ?? null;
    router.visit(to, { replace: options?.replace ?? false });
  }, []);
}

export function useLocation() {
  const { url } = usePage();
  return useMemo(
    () => ({ ...parseUrl(url), state: navState as any, key: url }),
    [url],
  );
}

// Dipakai halaman komposit (mis. /karyawan/create) buat "meminjamkan" query
// string ke komponen latar (MasterData) tanpa mengubah URL aslinya.
const SearchOverride = createContext<string | null>(null);

export function ForcedSearch({ search, children }: { search: string; children: ReactNode }) {
  return <SearchOverride.Provider value={search}>{children}</SearchOverride.Provider>;
}

type ParamsInput =
  | URLSearchParams
  | Record<string, string>
  | string[][]
  | ((prev: URLSearchParams) => URLSearchParams | Record<string, string>);

export function useSearchParams(): [
  URLSearchParams,
  (next: ParamsInput, options?: { replace?: boolean }) => void,
] {
  const location = useLocation();
  const override = useContext(SearchOverride);
  const raw = override ?? location.search;
  const searchParams = useMemo(() => new URLSearchParams(raw), [raw]);

  const setSearchParams = useCallback(
    (next: ParamsInput, options?: { replace?: boolean }) => {
      const resolved = typeof next === 'function' ? next(new URLSearchParams(raw)) : next;
      const qs = new URLSearchParams(resolved as any).toString();
      router.visit(location.pathname + (qs ? `?${qs}` : ''), {
        replace: options?.replace ?? false,
        preserveState: true,
        preserveScroll: true,
      });
    },
    [raw, location.pathname],
  );

  return [searchParams, setSearchParams];
}

export function useParams<
  T extends Record<string, string | undefined> = Record<string, string | undefined>,
>(): T {
  const { props } = usePage();
  return (((props as any).params ?? {}) as T);
}

export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  useEffect(() => {
    router.visit(to, { replace: !!replace });
  }, [to, replace]);
  return null;
}

/** Tidak dipakai lagi (layout Inertia memakai children), disisakan buat kompatibilitas. */
export function Outlet() {
  return null;
}
