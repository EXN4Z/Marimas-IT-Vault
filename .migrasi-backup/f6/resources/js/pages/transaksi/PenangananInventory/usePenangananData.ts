import { useEffect, useRef, useState } from 'react';
import { getInventoryPenanganan, type InventoryPenanganan } from '../../../api/transaksi/inventoryPenanganan';

export function usePenangananData(onCount?: (count: number) => void) {
  const [penangananList, setPenangananList] = useState<InventoryPenanganan[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');

  const load = () => {
    setLoading(true);
    setError('');
    getInventoryPenanganan()
      .then(setPenangananList)
      .catch((err) => {
        setError('Gagal memuat laporan penanganan aset.');
        console.error(err);
      })
      .finally(() => setLoading(false));
  };

  const loadSilent = () => {
    getInventoryPenanganan()
      .then(setPenangananList)
      .catch((err) => console.error(err));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const interval = setInterval(loadSilent, 10000);
    return () => clearInterval(interval);
  }, []);

  const lastCount = useRef<number | null>(null);

  useEffect(() => {
    if (loading) return;
    const belumDitangani = penangananList.filter((p) => !p.tanggal_selesai).length;
    if (lastCount.current !== belumDitangani) {
      lastCount.current = belumDitangani;
      onCount?.(belumDitangani);
    }
  }, [penangananList, loading, onCount]);

  return { penangananList, setPenangananList, loading, error, load };
}
