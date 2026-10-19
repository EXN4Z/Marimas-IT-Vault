import { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSharedProps } from '../hooks/useSharedProps';

// Dipasang di dalam layout Inertia (P5). Tiap navigasi Inertia, auth.user di shared
// props bisa berubah (mis. habis update profil) -- komponen ini menyamakan AuthContext
// dengannya supaya komponen yang pakai useAuth() ikut ter-update.
export default function InertiaAuthSync() {
  const { auth } = useSharedProps();
  const { setUser } = useAuth();
  const serialized = JSON.stringify(auth?.user ?? null);

  useEffect(() => {
    setUser(auth?.user ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized]);

  return null;
}
