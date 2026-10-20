<?php

namespace App\Http\Controllers\Legacy\MasterData;

use Illuminate\Http\Request;
use App\Queries\MasterData\RoleQuery;
use App\Http\Controllers\Controller;

class RoleController extends Controller
{
    public function index() {
        return response()->json(RoleQuery::daftar());
    }
}
