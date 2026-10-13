import { useEffect } from 'react';
import { router } from '@inertiajs/react';
import toast from 'react-hot-toast';
import type { Flash } from '../../types/inertia';

// [F1-INERTIA] Satu-satunya tempat yang menampilkan toast dari flash server (session success/error).
// Controller cukup `back()->with('success', '...')`; komponen tidak perlu toast manual setelah mutasi.
// Dipasang sekali di InertiaAppLayout (persistent layout). Pakai event 'success' per visit, jadi pesan yang
// sama dua kali berturut-turut tetap muncul dua kali.
export default function FlashToaster() {
  useEffect(() => {
    return router.on('success', (event) => {
      const flash = (event.detail.page.props as { flash?: Flash }).flash;
      if (flash?.success) toast.success(flash.success);
      if (flash?.error) toast.error(flash.error);
    });
  }, []);

  return null;
}
