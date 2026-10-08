import './index.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createInertiaApp } from '@inertiajs/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';

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
    // TODO saat menu pertama dimigrasi: tambahin ThemeProvider, AuthProvider, <Toaster /> di sini
    // (sama seperti yang dipasang di App.tsx lama).
    createRoot(el).render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <App {...props} />
        </QueryClientProvider>
      </StrictMode>,
    );
  },
});
