import { useEffect, useRef, useState } from 'react';
import { getInventory, type Inventory } from '../../../../api/masterData/inventory';
import { getSupplier, type Supplier } from '../../../../api/masterData/supplier';
import { getKategori, type Kategori } from '../../../../api/masterData/kategori';

export function useInventoryList(onCount?: (count: number) => void) {
  const [inventoryList, setInventoryList] = useState<Inventory[]>([]);

  const [supplierOptions, setSupplierOptions] = useState<Supplier[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');

  const [kategoriOptions, setKategoriOptions] = useState<Kategori[]>([]);

  const loadList = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getInventory();
      setInventoryList(data);
    } catch (err) {
      setError('Gagal memuat data inventory. Coba refresh halaman.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // BARU: versi "diam-diam" buat polling — gak nyalain loading spinner /
  // error state, biar gak ganggu tampilan yang lagi dilihat user.
  const loadListSilent = async () => {
    try {
      const data = await getInventory();
      setInventoryList(data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadList();
    getSupplier().then(setSupplierOptions).catch(() => {});
    getKategori().then(setKategoriOptions).catch(() => {});
  }, []);

  const lastCount = useRef<number | null>(null);

  useEffect(() => {
    if (loading) return; // hindari kedip ke 0 sebelum fetch pertama kelar
    if (lastCount.current !== inventoryList.length) {
      lastCount.current = inventoryList.length;
      onCount?.(inventoryList.length);
    }
  }, [inventoryList, loading, onCount]);

  return { inventoryList, setInventoryList, supplierOptions, kategoriOptions, loading, error, loadList, loadListSilent };
}
