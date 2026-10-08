import { QueryClient } from '@tanstack/react-query';

// singleton dipisah dari main.tsx biar bisa di-import & di-clear() dari
// AuthContext pas login/logout — cegah data user lama (dashboard, stats,
// dsb) numpang keliatan pas ganti akun tanpa refresh manual.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 menit data dianggap fresh, ga refetch
      refetchOnWindowFocus: false,
    },
  },
});