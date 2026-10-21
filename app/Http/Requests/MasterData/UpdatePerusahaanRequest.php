<?php

namespace App\Http\Requests\MasterData;

use Illuminate\Foundation\Http\FormRequest;

// Dipindah dari PerusahaanController::update() -- aturan validasi identik.
class UpdatePerusahaanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'nama' => 'sometimes|required|string|max:150',
            'alamat' => 'sometimes|required|string|max:1000',
            'telepon' => 'sometimes|required|string|max:30',
            'link' => 'sometimes|required|string|max:255',
        ];
    }

    public function messages(): array
    {
        return [
        ];
    }
}
