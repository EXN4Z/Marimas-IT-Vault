import { useCallback } from 'react';
import { router } from '@inertiajs/react';

type AppNavigateOptions = { replace?: boolean };

// Pengganti useNavigate() untuk halaman Inertia: navigate('/path', { replace }) atau navigate(-1).
export function useAppNavigate() {
  return useCallback((to: string | number, opts?: AppNavigateOptions) => {
    if (typeof to === 'number') {
      window.history.go(to);
      return;
    }
    router.visit(to, { replace: opts?.replace });
  }, []);
}
