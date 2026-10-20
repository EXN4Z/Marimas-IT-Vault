<?php

namespace App\Http\Requests\Auth;

use Illuminate\Foundation\Http\FormRequest;

// Dipindah dari AuthController::verifyOtp() -- aturan validasi identik.
class VerifyOtpAuthRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'registration_id' => 'required|string',
            'otp_code' => 'required|string',
        ];
    }
}
