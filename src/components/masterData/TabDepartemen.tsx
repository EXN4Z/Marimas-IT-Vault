import { Building2 } from 'lucide-react';
import GenericMasterTab, { type GenericMasterTabConfig } from './GenericMasterTab';
import { getDepartemen, createDepartemen, updateDepartemen, deleteDepartemen, importDepartemen } from '../../api/masterData/departemen';

// Departemen = CRUD nama doang (tanpa alamat/telepon). Semua UI-nya ada di
// GenericMasterTab; file ini cuma nyambungin API Departemen ke komponen itu.
// Didefinisikan di luar komponen supaya referensinya stabil (dipakai sebagai
// dependency effect load data di GenericMasterTab).
const config: GenericMasterTabConfig = {
  label: 'Departemen',
  singular: 'Departemen',
  icon: Building2,
  namaPlaceholder: 'Divisi Finance & Accounting',
  get: getDepartemen,
  create: (payload) => createDepartemen(payload.nama),
  update: (id, payload) => updateDepartemen(id, payload.nama),
  remove: deleteDepartemen,
  import: importDepartemen,
  exportHeaders: ['Nama'],
  exportRow: (item) => [item.nama],
};

export default function TabDepartemen() {
  return <GenericMasterTab config={config} />;
}
