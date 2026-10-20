<?php

namespace App\Http\Requests\Notifikasi;

use Illuminate\Foundation\Http\FormRequest;

// Dipindah dari PushSubscriptionController::store() -- aturan validasi identik.
class StorePushSubscriptionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'endpoint' => 'required|string',
            'keys.p256dh' => 'required|string',
            'keys.auth' => 'required|string',
        ];
    }
}
