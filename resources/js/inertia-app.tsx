import './index.css';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { createInertiaApp } from '@inertiajs/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import InertiaAppLayout from './components/layout/InertiaAppLayout';

// Halaman Inertia ditaruh di resources/js/inertia/pages/<Menu>/<Halaman>.tsx
// dan dipanggil dari Laravel: Inertia::render('<Menu>/<Halaman>')
const pages = import.meta.glob<any>('./inertia/pages/**/*.tsx');

createInertiaApp({
  resolve: async (name) => {
    const loader = pages[`./inertia/pages/${name}.tsx`];
    if (!loader) throw new Error(`Halaman Inertia tidak ditemukan: ${name}`);
    const page = await loader();
    // Persistent layout: halaman yang TIDAK mendefinisikan Page.layout otomatis dibungkus
    // InertiaAppLayout. Halaman tanpa sidebar/header (Login, VerifyOtp di P13) cukup set
    // `Page.layout = null` (atau fungsi yang return page apa adanya).
    if (page.default.layout === undefined) {
      page.default.layout = (node: ReactNode) => <InertiaAppLayout>{node}</InertiaAppLayout>;
    }
    return page;
  },
  setup({ el, App, props }) {
    // User dari shared props halaman pertama -> AuthProvider masuk mode Inertia (tanpa token/GET /user).
    const initialUser = (props as any).initialPage?.props?.auth?.user ?? null;

    createRoot(el).render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider initialUser={initialUser}>
              <Toaster position="top-center" />
              <App {...props} />
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </StrictMode>,
    );
  },
});
