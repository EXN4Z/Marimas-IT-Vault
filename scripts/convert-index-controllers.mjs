import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const root = path.join(path.dirname(__filename), '..');

const controllers = [
    { file: 'app/Http/Controllers/AuditLog/AuditLogController.php', target: 'AuditLog/Index', tab: null },
    { file: 'app/Http/Controllers/Dashboard/DashboardController.php', target: 'Dashboard/Index', tab: null },
    { file: 'app/Http/Controllers/MasterData/DepartemenController.php', target: 'MasterData/Index', tab: 'departemen' },
    { file: 'app/Http/Controllers/MasterData/InventoryController.php', target: 'MasterData/Index', tab: 'inventory' },
    { file: 'app/Http/Controllers/MasterData/KategoriController.php', target: 'MasterData/Index', tab: 'kategori' },
    { file: 'app/Http/Controllers/MasterData/SupplierController.php', target: 'MasterData/Index', tab: 'supplier' },
];

controllers.forEach(({ file, target, tab }) => {
    const fullPath = path.join(root, file);
    if (!fs.existsSync(fullPath)) return;
    
    let content = fs.readFileSync(fullPath, 'utf8');
    
    // Replace index method
    const indexPattern = /public function index\(\)[\s\S]*?return response\(\)->json\((.*?)\);/g;
    
    content = content.replace(indexPattern, (match, data) => {
        let render = `return Inertia::render('${target}', [`;
        if (tab) {
            render += `\n            'tab' => '${tab}',`;
        }
        render += `\n        ]);`;
        return render;
    });
    
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`Converted: ${file}`);
});
