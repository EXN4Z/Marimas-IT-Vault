<?php

namespace App\Http\Requests\Transaksi;

use Illuminate\Foundation\Http\FormRequest;

// Dipindah dari InventoryPenangananController::import() -- aturan validasi identik.
class ImportInventoryPenangananRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'file' => 'required|file|mimes:xlsx,xls|max:10240', // max 10MB
        ];
    }
}
