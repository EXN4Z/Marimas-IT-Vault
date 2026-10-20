<?php

namespace App\Http\Controllers\AuditLog;

use App\Http\Controllers\Controller;
use App\Queries\AuditLog\AuditLogQuery;
use Illuminate\Http\Request;
use Inertia\Inertia;

class AuditLogPageController extends Controller
{
    // GET /audit-log?tab=aktif|trash&page=&search=   (middleware: auth + role:admin, lihat routes/web.php)
    public function __invoke(Request $request)
    {
        $tab = $request->query('tab') === 'trash' ? 'trash' : 'aktif';

        $logs = $tab === 'trash'
            ? AuditLogQuery::trash($request)
            : AuditLogQuery::active($request);

        return Inertia::render('AuditLog/Index', [
            'tab' => $tab,
            'filters' => ['search' => (string) $request->query('search', '')],
            'logs' => $logs, // bentuk paginator sama dengan JSON /api/audit-log
        ]);
    }
}
