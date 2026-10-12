import { useCallback } from 'react';
import { useInRouterContext, useNavigate, type NavigateOptions } from 'react-router-dom';
import { router } from '@inertiajs/react';
import { isInertiaPath } from '../lib/inertiaRoutes';

type AppNavigateOptions = { replace?: boolean; state?: unknown };

// Pengganti useNavigate() yang aman dipakai di DUA dunia:
//  - di SPA lama (ada <BrowserRouter>)  : react-router biasa; kalau target sudah Inertia -> full page load
//  - di halaman Inertia (tanpa router)  : router.visit; kalau target belum Inertia (SPA) -> full page load
// `state` (mis. backgroundLocation) hanya dipakai di mode SPA; di mode Inertia diabaikan.
export function useAppNavigate() {
  const inRouter = useInRouterContext();
  // Aman walau dipanggil kondisional: keberadaan router context tidak berubah selama
  // komponen hidup (kalau berpindah dunia, komponen di-mount ulang).
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const rrNavigate = inRouter ? useNavigate() : null;

  return useCallback(
    (to: string | number, opts?: AppNavigateOptions) => {
      if (typeof to === 'number') {
        if (rrNavigate) rrNavigate(to);
        else window.history.go(to);
        return;
      }

      const target = isInertiaPath(to);

      if (rrNavigate) {
        if (target) {
          if (opts?.replace) window.location.replace(to);
          else window.location.assign(to);
          return;
        }
        rrNavigate(to, opts as NavigateOptions);
        return;
      }

      if (target) {
        router.visit(to, { replace: opts?.replace });
        return;
      }
      if (opts?.replace) window.location.replace(to);
      else window.location.assign(to);
    },
    [rrNavigate],
  );
}
