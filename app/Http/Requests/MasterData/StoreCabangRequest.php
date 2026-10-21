<?php

namespace App\Http\Requests\MasterData;

use Illuminate\Foundation\Http\FormRequest;

// Dipindah dari CabangController::store() -- aturan validasi identik.
class StoreCabangRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'nama' => 'required|string|max:150',
            'alamat' => 'required|string|max:1000|unique:lokasi_kantor,alamat',
            'telepon' => 'nullable|string|max:30',
            'link' => 'nullable|string|max:255|unique:lokasi_kantor,link',
        ];
    }

    public function messages(): array
    {
        return [
            'alamat.unique' => 'Alamat ini sudah terdaftar di cabang lain.',
            'link.unique'   => 'Link ini sudah digunakan oleh cabang lain.',
        ];
    }
}
