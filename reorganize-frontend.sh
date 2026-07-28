#!/bin/bash
# Jalankan di root repo marimas-one-front-main
# git mv preserves history — lebih aman daripada extract-timpa zip
set -e

echo "== Bikin folder baru =="
mkdir -p src/components/absensi src/components/karyawan src/components/shared

echo "== Hapus file junk =="
rm -rf .git_disabled .gitingore
git add -A
git rm -r --cached .git_disabled .gitingore 2>/dev/null || true
rm -f src/pages/Dashboard22.tsx

echo "== Pindah modal Aset -> components/inventaris/ =="
git mv src/components/AsetFormModal.tsx src/components/inventaris/AsetFormModal.tsx
git mv src/components/AsetLaporKerusakanModal.tsx src/components/inventaris/AsetLaporKerusakanModal.tsx
git mv src/components/AsetPenangananSelesaiModal.tsx src/components/inventaris/AsetPenangananSelesaiModal.tsx
git mv src/components/AsetPengembalianModal.tsx src/components/inventaris/AsetPengembalianModal.tsx
git mv src/components/AsetPinjamModal.tsx src/components/inventaris/AsetPinjamModal.tsx
git mv src/components/AsetSerahTerimaModal.tsx src/components/inventaris/AsetSerahTerimaModal.tsx
git mv src/components/AsetSparepartModal.tsx src/components/inventaris/AsetSparepartModal.tsx

echo "== Pindah ke components/absensi/ =="
git mv src/components/DaftarWajahModal.tsx src/components/absensi/DaftarWajahModal.tsx
git mv src/components/FaceCapture.tsx src/components/absensi/FaceCapture.tsx

echo "== Pindah ke components/karyawan/ =="
git mv src/components/KaryawanQrModal.tsx src/components/karyawan/KaryawanQrModal.tsx

echo "== Pindah ke components/shared/ =="
git mv src/components/AppLayout.tsx src/components/shared/AppLayout.tsx
git mv src/components/AdminRoute.tsx src/components/shared/AdminRoute.tsx
git mv src/components/RouteModal.tsx src/components/shared/RouteModal.tsx
git mv src/components/ScanQrModal.tsx src/components/shared/ScanQrModal.tsx
git mv src/components/Chatwidget.tsx src/components/shared/Chatwidget.tsx
git mv src/components/NotificationDropDown.tsx src/components/shared/NotificationDropDown.tsx

echo "== Fix import path di dalam file yang pindah (relative import nambah 1 level) =="

# modal Aset: '../api/...' -> '../../api/...', dan referensi ke asetHelpers
sed -i "s#from '\.\./api/#from '../../api/#g" \
  src/components/inventaris/AsetFormModal.tsx \
  src/components/inventaris/AsetLaporKerusakanModal.tsx \
  src/components/inventaris/AsetPenangananSelesaiModal.tsx \
  src/components/inventaris/AsetPengembalianModal.tsx \
  src/components/inventaris/AsetPinjamModal.tsx \
  src/components/inventaris/AsetSerahTerimaModal.tsx \
  src/components/inventaris/AsetSparepartModal.tsx
sed -i "s#from '\./inventaris/asetHelpers'#from './asetHelpers'#" src/components/inventaris/AsetPengembalianModal.tsx

# absensi & karyawan & shared: '../context|api|lib/' -> '../../context|api|lib/'
sed -i "s#from '\.\./context/#from '../../context/#g; s#from '\.\./api/#from '../../api/#g; s#from '\.\./lib/#from '../../lib/#g" \
  src/components/shared/AppLayout.tsx \
  src/components/shared/AdminRoute.tsx \
  src/components/shared/Chatwidget.tsx \
  src/components/shared/NotificationDropDown.tsx \
  src/components/absensi/DaftarWajahModal.tsx \
  src/components/absensi/FaceCapture.tsx \
  src/components/karyawan/KaryawanQrModal.tsx

echo "== Fix import di TabAset.tsx (yg manggil modal Aset) =="
sed -i \
  -e "s#from '\.\./AsetFormModal'#from './AsetFormModal'#" \
  -e "s#from '\.\./AsetSerahTerimaModal'#from './AsetSerahTerimaModal'#" \
  -e "s#from '\.\./AsetPengembalianModal'#from './AsetPengembalianModal'#" \
  -e "s#from '\.\./AsetLaporKerusakanModal'#from './AsetLaporKerusakanModal'#" \
  -e "s#from '\.\./AsetPenangananSelesaiModal'#from './AsetPenangananSelesaiModal'#" \
  -e "s#from '\.\./AsetSparepartModal'#from './AsetSparepartModal'#" \
  src/components/inventaris/TabAset.tsx

echo "== Fix import di pages/ & App.tsx yg manggil komponen pindahan =="
grep -rl "components/AppLayout'" src --include=*.tsx | xargs -r sed -i "s#components/AppLayout'#components/shared/AppLayout'#g"
grep -rl "components/AdminRoute'" src --include=*.tsx | xargs -r sed -i "s#components/AdminRoute'#components/shared/AdminRoute'#g"
grep -rl "components/RouteModal'" src --include=*.tsx | xargs -r sed -i "s#components/RouteModal'#components/shared/RouteModal'#g"
grep -rl "components/ScanQrModal'" src --include=*.tsx | xargs -r sed -i "s#components/ScanQrModal'#components/shared/ScanQrModal'#g"
grep -rl "components/DaftarWajahModal'" src --include=*.tsx | xargs -r sed -i "s#components/DaftarWajahModal'#components/absensi/DaftarWajahModal'#g"
grep -rl "components/FaceCapture'" src --include=*.tsx | xargs -r sed -i "s#components/FaceCapture'#components/absensi/FaceCapture'#g"

echo "== Selesai. Verifikasi wajib sebelum commit: =="
echo "   npx tsc --noEmit"
echo "   (harus 0 error, kalau ada error berarti ada import yg belum tersentuh script ini)"
