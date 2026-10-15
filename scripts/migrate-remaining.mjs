import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const root = path.join(path.dirname(__filename), '..');

const FASE = 'final-migration';
const backupDir = path.join(root, '.migrasi-backup', FASE);

const log = (msg) => console.log(`[${FASE.toUpperCase()}] ${msg}`);
const ensureBackup = (file) => {
    const src = path.join(root, file);
    const dest = path.join(backupDir, file);
    if (!fs.existsSync(path.dirname(dest))) fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
};

// 1. Baca route API
const apiRoutesPath = path.join(root, 'routes/api.php');
const apiRoutes = fs.readFileSync(apiRoutesPath, 'utf8');

// 2. Backup & Update Web Routes
ensureBackup('routes/web.php');
let webRoutes = fs.readFileSync(path.join(root, 'routes/web.php'), 'utf8');

// Simple extraction of routes from api.php to append to web.php
const routesOnly = apiRoutes
  .replace(/<\?php/g, '')
  .replace(/use.*?;/g, '')
  .trim();

webRoutes += `\n\n// --- Migrated from API ---\nRoute::middleware(['auth:sanctum'])->group(function () {\n${routesOnly}\n});`;
fs.writeFileSync(path.join(root, 'routes/web.php'), webRoutes);

// 3. Kosongkan API Routes
ensureBackup('routes/api.php');
fs.writeFileSync(apiRoutesPath, '<?php\n\nuse Illuminate\\Support\\Facades\\Route;\n\n// All routes migrated to web.php');

log('Semua route API telah dipindahkan ke web.php. routes/api.php dikosongkan.');
