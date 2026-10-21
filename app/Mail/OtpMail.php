<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class OtpMail extends Mailable
{
    use Queueable, SerializesModels;

    public function __construct(public int $otp)
    {
    }

    public function build()
    {
        return $this->subject('Kode Verifikasi MARIMAS IT VAULT')
            ->view('emails.otp')
            ->with(['otp' => $this->otp]);
    }
}