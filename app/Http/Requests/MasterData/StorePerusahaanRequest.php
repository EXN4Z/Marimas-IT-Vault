<?php

namespace App\Http\Requests\MasterData;

use Illuminate\Foundation\Http\FormRequest;

// Dipindah dari PerusahaanController::store() -- aturan validasi identik.
class StorePerusahaanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'nama' => 'required|string|max:150',
            'alamat' => 'required|string|max:1000|unique:perusahaan,alamat',
            'telepon' => 'required|string|max:30',
            'link' => 'required|string|max:255|unique:perusahaan,link',
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
