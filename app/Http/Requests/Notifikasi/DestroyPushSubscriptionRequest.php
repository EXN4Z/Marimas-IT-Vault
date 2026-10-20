<?php

namespace App\Http\Requests\Notifikasi;

use Illuminate\Foundation\Http\FormRequest;

// Dipindah dari PushSubscriptionController::destroy() -- aturan validasi identik.
class DestroyPushSubscriptionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'endpoint' => 'required|string',
        ];
    }
}
