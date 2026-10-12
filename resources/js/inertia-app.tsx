import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createInertiaApp } from '@inertiajs/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';

// Halaman Inertia ditaruh di resources/js/inertia/pages/<Menu>/<Halaman>.tsx
// dan dipanggil dari Laravel: Inertia::render('<Menu>/<Halaman>')
const pages = import.meta.glob<any>('./inertia/pages/**/*.tsx');

createInertiaApp({
  resolve: (name) => {
    const page = pages[`./inertia/pages/${name}.tsx`];
    if (!page) throw new Error(`Halaman Inertia tidak ditemukan: ${name}`);
    return page();
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
