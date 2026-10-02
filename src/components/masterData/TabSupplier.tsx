import { Truck } from 'lucide-react';
import GenericMasterTab, { type GenericMasterTabConfig } from './GenericMasterTab';
import { getSupplier, createSupplier, updateSupplier, deleteSupplier, importSupplier } from '../../api/masterData/supplier';

// Supplier = CRUD nama + alamat + telepon (withContact). Semua UI-nya ada di
// GenericMasterTab; file ini cuma nyambungin API Supplier ke komponen itu.
// Didefinisikan di luar komponen supaya referensinya stabil (dipakai sebagai
// dependency effect load data di GenericMasterTab).
const config: GenericMasterTabConfig = {
  label: 'Supplier',
  singular: 'Supplier',
  icon: Truck,
  namaPlaceholder: 'PT Sumber Makmur Solusindo',
  withContact: true,
  get: getSupplier,
  create: (payload) => createSupplier(payload),
  update: (id, payload) => updateSupplier(id, { nama: payload.nama, alamat: payload.alamat, telepon: payload.telepon }),
  remove: deleteSupplier,
  import: importSupplier,
  exportHeaders: ['Nama', 'Alamat', 'Telepon'],
  exportRow: (item) => [item.nama, item.alamat || '', item.telepon || ''],
};

export default function TabSupplier() {
  return <GenericMasterTab config={config} />;
}
