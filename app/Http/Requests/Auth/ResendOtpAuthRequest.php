<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

// Dipindah dari AuthController::resendOtp() -- aturan validasi identik.
class ResendOtpAuthRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'registration_id' => 'required|string',
        ];
    }
}
