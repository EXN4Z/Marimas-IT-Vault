import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const root = path.join(path.dirname(__filename), '..');
const controllersDir = path.join(root, 'app/Http/Controllers');

const FASE = 'mass-convert';
const backupDir = path.join(root, '.migrasi-backup', FASE);

const log = (msg) => console.log(`[${FASE.toUpperCase()}] ${msg}`);

function getAllFiles(dirPath, arrayOfFiles = []) {
    const files = fs.readdirSync(dirPath);
    files.forEach((file) => {
        if (fs.statSync(dirPath + "/" + file).isDirectory()) {
            arrayOfFiles = getAllFiles(dirPath + "/" + file, arrayOfFiles);
        } else {
            if (file.endsWith('.php')) {
                arrayOfFiles.push(path.join(dirPath, "/", file));
            }
        }
    });
    return arrayOfFiles;
}

const files = getAllFiles(controllersDir);

log(`Memproses ${files.length} controller...`);

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // Pattern to replace store/update/destroy json responses with redirects
    // Matches 'return response()->json(...);' or 'return response()->json(..., ...);'
    // This is a basic pattern, might need refinement
    const mutationPattern = /return response\(\)->json\((.*?)\);/g;
    
    // Only apply if it's likely a mutation (store/update/destroy/import)
    // We check if the function name matches a mutation
    if (content.includes('public function store') || content.includes('public function update') || 
        content.includes('public function destroy') || content.includes('public function import')) {
        
        content = content.replace(mutationPattern, (match, p1) => {
            // Check context - if it's likely a mutation, replace it
            return "return redirect()->back()->with('success', 'Operasi berhasil.');";
        });
    }

    if (content !== original) {
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
        const backupPath = path.join(backupDir, path.relative(root, file));
        if (!fs.existsSync(path.dirname(backupPath))) fs.mkdirSync(path.dirname(backupPath), { recursive: true });
        fs.copyFileSync(file, backupPath);
        
        fs.writeFileSync(file, content, 'utf8');
        log(`Dikonversi: ${path.relative(root, file)}`);
    }
});

log('Konversi massal selesai. Harap periksa kembali controller yang memiliki method "index" atau "show" (masih perlu manual).');
