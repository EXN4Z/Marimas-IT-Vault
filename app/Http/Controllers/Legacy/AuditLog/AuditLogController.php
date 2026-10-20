<?php

namespace App\Http\Controllers\Legacy\AuditLog;

use App\Http\Controllers\Controller;
use App\Queries\AuditLog\AuditLogQuery;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    // GET /api/audit-log — log aktif (belum di-trash)
    // Logika query ada di App\Queries\AuditLog\AuditLogQuery (dipakai juga oleh AuditLogPageController).
    public function index(Request $request)
    {
        return response()->json(AuditLogQuery::active($request));
    }

    // GET /api/audit-log/trash — log yang sudah di-trash
    public function trash(Request $request)
    {
        return response()->json(AuditLogQuery::trash($request));
    }
}
