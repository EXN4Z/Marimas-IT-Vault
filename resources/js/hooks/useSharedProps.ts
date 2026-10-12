import { usePage } from '@inertiajs/react';
import type { SharedProps } from '../types/inertia';

// Akses props bersama (auth, flash) dengan tipe yang benar, tanpa bergantung
// pada mekanisme augmentasi tipe milik versi Inertia tertentu.
export function useSharedProps(): SharedProps {
  return usePage().props as unknown as SharedProps;
}
