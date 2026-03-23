<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Run temp/orphan cleanup every hour
Schedule::command('clutchclip:cleanup')->hourly();

// Delete clips that have exceeded each user's retention period (runs every 6 hours)
Schedule::command('clutchclip:delete-expired-clips')->everySixHours();
