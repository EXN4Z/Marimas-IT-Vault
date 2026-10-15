import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..'); // Root project is parent of 'scripts'

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry');
const isRevert = args.includes('--revert');

const FASE = 'f10';
const backupDir = path.join(root, '.migrasi-backup', FASE);

const log = (msg) => console.log(`[${FASE.toUpperCase()}] ${msg}`);

const backupFolder = (relative) => {
    const src = path.join(root, relative);
    if (!fs.existsSync(src)) return;
    const dest = path.join(backupDir, relative);
    if (!fs.existsSync(path.dirname(dest))) fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.cpSync(src, dest, { recursive: true });
    log(`Backed up ${relative}`);
};

const deleteFolder = (relative) => {
    const fullPath = path.join(root, relative);
    if (!fs.existsSync(fullPath)) return;

    if (isDryRun) {
        log(`[DRY] Would delete folder: ${relative}`);
        return;
    }

    backupFolder(relative);
    fs.rmSync(fullPath, { recursive: true, force: true });
    log(`Deleted: ${relative}`);
};

// Execution
if (isRevert) {
    log('Reverting changes (Manual restoration required for folders)...');
    process.exit(0);
}

log('Mulai pembersihan...');

// 1. Hapus Folder SPA Lama
deleteFolder('resources/js/pages');

// 2. Hapus Folder API
deleteFolder('resources/js/api');

log('Pembersihan file selesai.');
log('========================================================');
log('TINDAKAN SELANJUTNYA:');
log('1. Jalankan: npm uninstall axios @tanstack/react-query');
log('2. Hapus route yang tidak terpakai di routes/api.php');
log('3. Hapus method controller API yang sudah kosong.');
log('4. Cek apakah masih ada error TypeScript karena import dari api/ sudah dihapus.');
log('========================================================');
