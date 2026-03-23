<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\SocialAuthController;
use App\Http\Controllers\VideoController;
use Illuminate\Support\Facades\Route;

// ── Public ────────────────────────────────────────────────────────────────────
Route::get('/', [VideoController::class, 'landing'])->name('home');

// ── Auth (guests only) ────────────────────────────────────────────────────────
Route::middleware('guest')->group(function () {
    Route::get('/login',    [AuthController::class, 'showLogin'])->name('login');
    Route::post('/login',   [AuthController::class, 'login']);
    Route::get('/register', [AuthController::class, 'showRegister'])->name('register');
    Route::post('/register',[AuthController::class, 'register']);
});

Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth')->name('logout');

// ── Google OAuth ──────────────────────────────────────────────────────────────
Route::get('/auth/google',          [SocialAuthController::class, 'redirect'])->name('auth.google');
Route::get('/auth/google/callback', [SocialAuthController::class, 'callback']);

// ── Protected (authenticated users only) ─────────────────────────────────────
Route::middleware('auth')->group(function () {
    // Upload page
    Route::get('/upload', [VideoController::class, 'index'])->name('upload');

    // Upload video
    Route::post('/videos',          [VideoController::class, 'store'])->name('videos.store');
    Route::post('/videos/chunks',   [VideoController::class, 'storeChunk'])->name('videos.storeChunk');
    Route::post('/videos/assemble', [VideoController::class, 'assembleChunks'])->name('videos.assemble');

    // History page
    Route::get('/history', [VideoController::class, 'history'])->name('history');

    // Settings page
    Route::get('/settings',  [SettingsController::class, 'show'])->name('settings');
    Route::post('/settings', [SettingsController::class, 'update'])->name('settings.update');

    // Results page
    Route::get('/videos/{video}', [VideoController::class, 'results'])->name('videos.show');

    // Delete video + clips
    Route::delete('/videos/{video}', [VideoController::class, 'destroy'])->name('videos.destroy');

    // JSON API
    Route::get('/api/videos/{video}/status', [VideoController::class, 'status'])->name('videos.status');
    Route::get('/api/videos/{video}/clips',  [VideoController::class, 'clips'])->name('videos.clips');

    // Serve clip file
    Route::get('/clips/{video}/{clip}', [VideoController::class, 'serveClip'])->name('clips.serve');
});
