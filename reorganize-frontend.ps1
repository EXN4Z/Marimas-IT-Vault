# Jalankan di root repo marimas-one-front (folder yang ada src/, package.json)
# Cara pakai: buka PowerShell di folder itu, jalankan: .\reorganize-frontend.ps1
$ErrorActionPreference = "Stop"

Write-Host "== Bikin folder baru ==" -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path "src/components/absensi" | Out-Null
New-Item -ItemType Directory -Force -Path "src/components/karyawan" | Out-Null
New-Item -ItemType Directory -Force -Path "src/components/shared" | Out-Null

Write-Host "== Hapus file junk ==" -ForegroundColor Cyan
if (Test-Path ".git_disabled") { Remove-Item -Recurse -Force ".git_disabled" }
if (Test-Path ".gitingore") { Remove-Item -Force ".gitingore" }
if (Test-Path "src/pages/Dashboard22.tsx") { Remove-Item -Force "src/pages/Dashboard22.tsx" }

Write-Host "== Pindah modal Aset -> components/inventaris/ ==" -ForegroundColor Cyan
git mv src/components/AsetFormModal.tsx src/components/inventaris/AsetFormModal.tsx
git mv src/components/AsetLaporKerusakanModal.tsx src/components/inventaris/AsetLaporKerusakanModal.tsx
git mv src/components/AsetPenangananSelesaiModal.tsx src/components/inventaris/AsetPenangananSelesaiModal.tsx
git mv src/components/AsetPengembalianModal.tsx src/components/inventaris/AsetPengembalianModal.tsx
git mv src/components/AsetPinjamModal.tsx src/components/inventaris/AsetPinjamModal.tsx
git mv src/components/AsetSerahTerimaModal.tsx src/components/inventaris/AsetSerahTerimaModal.tsx
git mv src/components/AsetSparepartModal.tsx src/components/inventaris/AsetSparepartModal.tsx

Write-Host "== Pindah ke components/absensi/ ==" -ForegroundColor Cyan
git mv src/components/DaftarWajahModal.tsx src/components/absensi/DaftarWajahModal.tsx
git mv src/components/FaceCapture.tsx src/components/absensi/FaceCapture.tsx

Write-Host "== Pindah ke components/karyawan/ ==" -ForegroundColor Cyan
git mv src/components/KaryawanQrModal.tsx src/components/karyawan/KaryawanQrModal.tsx

Write-Host "== Pindah ke components/shared/ ==" -ForegroundColor Cyan
git mv src/components/AppLayout.tsx src/components/shared/AppLayout.tsx
git mv src/components/AdminRoute.tsx src/components/shared/AdminRoute.tsx
git mv src/components/RouteModal.tsx src/components/shared/RouteModal.tsx
git mv src/components/ScanQrModal.tsx src/components/shared/ScanQrModal.tsx
git mv src/components/Chatwidget.tsx src/components/shared/Chatwidget.tsx
git mv src/components/NotificationDropDown.tsx src/components/shared/NotificationDropDown.tsx

Write-Host "== Fix import path di file yang pindah ==" -ForegroundColor Cyan

function Replace-InFile($path, $find, $replace) {
    if (Test-Path $path) {
        (Get-Content $path -Raw) -replace [regex]::Escape($find), $replace | Set-Content $path -NoNewline
    }
}

# modal Aset: '../api/' -> '../../api/'
$asetModals = @(
    "src/components/inventaris/AsetFormModal.tsx",
    "src/components/inventaris/AsetLaporKerusakanModal.tsx",
    "src/components/inventaris/AsetPenangananSelesaiModal.tsx",
    "src/components/inventaris/AsetPengembalianModal.tsx",
    "src/components/inventaris/AsetPinjamModal.tsx",
    "src/components/inventaris/AsetSerahTerimaModal.tsx",
    "src/components/inventaris/AsetSparepartModal.tsx"
)
foreach ($f in $asetModals) {
    Replace-InFile $f "from '../api/" "from '../../api/"
}
Replace-InFile "src/components/inventaris/AsetPengembalianModal.tsx" "from './inventaris/asetHelpers'" "from './asetHelpers'"

# shared/absensi/karyawan: '../context|api|lib/' -> '../../context|api|lib/'
$others = @(
    "src/components/shared/AppLayout.tsx",
    "src/components/shared/AdminRoute.tsx",
    "src/components/shared/Chatwidget.tsx",
    "src/components/shared/NotificationDropDown.tsx",
    "src/components/absensi/DaftarWajahModal.tsx",
    "src/components/absensi/FaceCapture.tsx",
    "src/components/karyawan/KaryawanQrModal.tsx"
)
foreach ($f in $others) {
    Replace-InFile $f "from '../context/" "from '../../context/"
    Replace-InFile $f "from '../api/" "from '../../api/"
    Replace-InFile $f "from '../lib/" "from '../../lib/"
}

Write-Host "== Fix import di TabAset.tsx ==" -ForegroundColor Cyan
$tabAset = "src/components/inventaris/TabAset.tsx"
Replace-InFile $tabAset "from '../AsetFormModal'" "from './AsetFormModal'"
Replace-InFile $tabAset "from '../AsetSerahTerimaModal'" "from './AsetSerahTerimaModal'"
Replace-InFile $tabAset "from '../AsetPengembalianModal'" "from './AsetPengembalianModal'"
Replace-InFile $tabAset "from '../AsetLaporKerusakanModal'" "from './AsetLaporKerusakanModal'"
Replace-InFile $tabAset "from '../AsetPenangananSelesaiModal'" "from './AsetPenangananSelesaiModal'"
Replace-InFile $tabAset "from '../AsetSparepartModal'" "from './AsetSparepartModal'"

Write-Host "== Fix import di pages/ & App.tsx ==" -ForegroundColor Cyan
$allTsx = Get-ChildItem -Path "src" -Recurse -Include *.tsx,*.ts

foreach ($file in $allTsx) {
    $content = Get-Content $file.FullName -Raw
    $orig = $content
    $content = $content -replace "components/AppLayout'", "components/shared/AppLayout'"
    $content = $content -replace "components/AdminRoute'", "components/shared/AdminRoute'"
    $content = $content -replace "components/RouteModal'", "components/shared/RouteModal'"
    $content = $content -replace "components/ScanQrModal'", "components/shared/ScanQrModal'"
    $content = $content -replace "components/DaftarWajahModal'", "components/absensi/DaftarWajahModal'"
    $content = $content -replace "components/FaceCapture'", "components/absensi/FaceCapture'"
    if ($content -ne $orig) {
        Set-Content -Path $file.FullName -Value $content -NoNewline
    }
}

Write-Host ""
Write-Host "== Selesai. Verifikasi wajib sebelum commit: ==" -ForegroundColor Yellow
Write-Host "   npx tsc --noEmit"
Write-Host "   (harus 0 error, kalau ada error berarti ada import yg belum tersentuh script ini)"
