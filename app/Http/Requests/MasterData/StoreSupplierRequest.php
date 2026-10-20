<?php

namespace App\Http\Requests\MasterData;

use Illuminate\Foundation\Http\FormRequest;

// Dipindah dari SupplierController::store() -- aturan validasi identik.
class StoreSupplierRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'nama' => 'required|string|unique:supplier,nama',
            'alamat' => 'nullable|string',
            'telepon' => 'nullable|string',
        ];
    }
}
