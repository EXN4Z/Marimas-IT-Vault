<?php

namespace App\Http\Requests\MasterData;

use Illuminate\Foundation\Http\FormRequest;

// Dipindah dari SupplierController::update() -- aturan validasi identik ({id} diambil dari route, sama dengan $model->id).
class UpdateSupplierRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'nama' => 'required|string|unique:supplier,nama,' . $this->route('id'),
            'alamat' => 'nullable|string',
            'telepon' => 'nullable|string',
        ];
    }
}
