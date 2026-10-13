<?php

namespace App\Queries;

use App\Models\AuditLog;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/**
 * Logika query Audit Log, dipakai bareng oleh:
 *  - API  : App\Http\Controllers\AuditLog\AuditLogController
 *  - Web  : App\Http\Controllers\AuditLog\AuditLogPageController (Inertia)
 * Bentuk hasil (paginator) sama persis dengan respons /api/audit-log yang lama.
 */
class AuditLogQuery
{
    // log aktif (belum di-trash)
    public static function active(Request $request): LengthAwarePaginator
    {
        $query = AuditLog::with('user:id,name')->latest();

        if ($request->filled('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->filled('method')) {
            $query->where('method', $request->method);
        }

        if ($request->filled('search')) {
            self::applySearch($query, $request->search);
        }

        return $query->paginate($request->get('per_page', 20));
    }

    // log yang sudah di-trash
    public static function trash(Request $request): LengthAwarePaginator
    {
        $query = AuditLog::onlyTrashed()
            ->with('user:id,name')
            ->latest('deleted_at');

        if ($request->filled('search')) {
            self::applySearch($query, $request->search);
        }

        return $query->paginate($request->get('per_page', 20));
    }

    // Cari di deskripsi, endpoint, ip_address, dan nama user terkait.
    private static function applySearch(Builder $query, string $search): void
    {
        $query->where(function (Builder $q) use ($search) {
            $q->where('deskripsi', 'like', "%{$search}%")
                ->orWhere('endpoint', 'like', "%{$search}%")
                ->orWhere('ip_address', 'like', "%{$search}%")
                ->orWhereHas('user', function (Builder $userQuery) use ($search) {
                    $userQuery->where('name', 'like', "%{$search}%");
                });
        });
    }
}
