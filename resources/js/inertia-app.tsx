import './index.css';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { createInertiaApp } from '@inertiajs/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import AppLayout from './components/layout/AppLayout';

// Halaman Inertia ditaruh di resources/js/inertia/pages/<Menu>/<Halaman>.tsx
// dan dipanggil dari Laravel: Inertia::render('<Menu>/<Halaman>')
const pages = import.meta.glob<any>('./inertia/pages/**/*.tsx');

createInertiaApp({
  resolve: async (name) => {
    const loader = pages[`./inertia/pages/${name}.tsx`];
    if (!loader) throw new Error(`Halaman Inertia tidak ditemukan: ${name}`);
    const mod = await loader();
    const Page = mod.default;
    // Semua halaman dibungkus AppLayout (sidebar) KECUALI halaman Auth/*.
    // Layout persisten: gak di-remount tiap pindah halaman.
    if (Page && Page.layout === undefined && !name.startsWith('Auth/')) {
      Page.layout = (page: ReactNode) => <AppLayout>{page}</AppLayout>;
    }
    return mod;
  },
  setup({ el, App, props }) {
    createRoot(el).render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <Toaster position="top-center" />
              <App {...props} />
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </StrictMode>,
    );
  },
});
