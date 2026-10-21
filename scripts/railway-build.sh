#!/usr/bin/env bash
# Build aset frontend di Railway (Nixpacks PHP cuma punya Node 18, Vite 8/rolldown butuh Node >= 22.12).
# Taruh di scripts/railway-build.sh. Dipanggil dari nixpacks.toml.
set -euo pipefail

NODE_VER=22.12.0
NODE_DIR="/tmp/node-v${NODE_VER}-linux-x64"

curl -fsSL "https://nodejs.org/dist/v${NODE_VER}/node-v${NODE_VER}-linux-x64.tar.gz" | tar -xz -C /tmp
export PATH="${NODE_DIR}/bin:${PATH}"
echo "Node: $(node -v)  npm: $(npm -v)"

# Install ulang dengan Node 22 supaya dependency opsional (binding native rolldown) ikut terpasang.
rm -rf node_modules
npm ci

# Fallback kalau lockfile tidak memuat binding linux (bug npm dengan optional dependency).
if [ ! -d node_modules/@rolldown/binding-linux-x64-gnu ]; then
  RD_VER=$(node -p "JSON.parse(require('fs').readFileSync('node_modules/rolldown/package.json','utf8')).version")
  echo "Binding rolldown linux tidak ada, pasang manual versi ${RD_VER}"
  npm i --no-save "@rolldown/binding-linux-x64-gnu@${RD_VER}"
fi

npm run build
