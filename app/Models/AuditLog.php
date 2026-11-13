<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class AuditLog extends Model
{
    use SoftDeletes;

    protected $table = 'audit_logs';

    protected $fillable = [
        'user_id',
        'method',
        'endpoint',
        'deskripsi',
        'ip_address',
        'subject_type',
        'subject_id',
        'meta',
        'dipulihkan_at',
        'dipulihkan_oleh',
    ];

    protected $casts = [
        'meta' => 'array',
        'dipulihkan_at' => 'datetime',
    ];

    public function user()
    {
        return $this->belongsTo(User::class)->withTrashed();
    }
}