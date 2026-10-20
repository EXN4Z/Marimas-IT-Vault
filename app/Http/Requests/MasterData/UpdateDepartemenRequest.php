<?php

namespace App\Http\Requests\MasterData;

use Illuminate\Foundation\Http\FormRequest;

// Dipindah dari DepartemenController::update() -- aturan validasi identik ({id} diambil dari route, sama dengan $model->id).
class UpdateDepartemenRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'nama' => 'required|string|unique:departemen,nama,' . $this->route('id'),
        ];
    }
}
