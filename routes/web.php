<?php

use App\Http\Controllers\AiMontageController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\ClipController;
use App\Http\Controllers\MontageController;
use App\Http\Controllers\MontageProjectController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\SocialAuthController;
use App\Http\Controllers\VideoController;
use Illuminate\Support\Facades\Route;

Route::get('/', [VideoController::class, 'landing'])->name('home');

Route::middleware('guest')->group(function () {
    Route::get('/login', [AuthController::class, 'showLogin'])->name('login');
    Route::post('/login', [AuthController::class, 'login']);
    Route::get('/register', [AuthController::class, 'showRegister'])->name('register');
    Route::post('/register', [AuthController::class, 'register']);
});

Route::post('/logout', [AuthController::class, 'logout'])->middleware('auth')->name('logout');

Route::get('/auth/google', [SocialAuthController::class, 'redirect'])->name('auth.google');
Route::get('/auth/google/callback', [SocialAuthController::class, 'callback']);

Route::middleware('auth')->group(function () {
    Route::get('/upload', [VideoController::class, 'index'])->name('upload');

    Route::post('/videos', [VideoController::class, 'store'])->name('videos.store');
    Route::post('/videos/chunks', [VideoController::class, 'storeChunk'])->name('videos.storeChunk');
    Route::post('/videos/assemble', [VideoController::class, 'assembleChunks'])->name('videos.assemble');

    Route::get('/history', [VideoController::class, 'history'])->name('history');

    Route::get('/settings', [SettingsController::class, 'show'])->name('settings');
    Route::post('/settings', [SettingsController::class, 'update'])->name('settings.update');

    Route::get('/videos/{video}', [VideoController::class, 'results'])->name('videos.show');
    Route::delete('/videos/{video}', [VideoController::class, 'destroy'])->name('videos.destroy');

    Route::get('/api/videos/{video}/status', [VideoController::class, 'status'])->name('videos.status');
    Route::get('/api/videos/{video}/clips', [VideoController::class, 'clips'])->name('videos.clips');

    Route::get('/clips/{video}/{clip}', [VideoController::class, 'serveClip'])->name('clips.serve');
    Route::post('/clips/{video}/{clip}/refine', [ClipController::class, 'refine'])->name('clips.refine');
    Route::get('/clips/{video}/{clip}/refined', [ClipController::class, 'serveRefined'])->name('clips.serveRefined');

    Route::get('/videos/{video}/montage/new', [MontageProjectController::class, 'create'])->name('montage-projects.create');
    Route::post('/videos/{video}/ai-montage', [AiMontageController::class, 'generate'])->name('ai-montage.generate');

    Route::get('/montage-projects', [MontageProjectController::class, 'index'])->name('montage-projects.index');
    Route::post('/montage-projects', [MontageProjectController::class, 'store'])->name('montage-projects.store');
    Route::get('/montage-projects/{project}', [MontageProjectController::class, 'show'])->name('montage-projects.show');
    Route::put('/montage-projects/{project}', [MontageProjectController::class, 'update'])->name('montage-projects.update');
    Route::delete('/montage-projects/{project}', [MontageProjectController::class, 'destroy'])->name('montage-projects.destroy');

    Route::post('/montage-projects/{project}/export', [MontageProjectController::class, 'export'])->name('montage-projects.export');
    Route::get('/montage-projects/{project}/download', [MontageProjectController::class, 'download'])->name('montage-projects.download');
    Route::get('/api/montage-projects/{project}/status', [MontageProjectController::class, 'status'])->name('montage-projects.status');
    Route::post('/montage-projects/{project}/music', [MontageProjectController::class, 'uploadMusic'])->name('montage-projects.uploadMusic');
    Route::delete('/montage-projects/{project}/music', [MontageProjectController::class, 'deleteMusic'])->name('montage-projects.deleteMusic');

    // Built-in music preview (auth-gated, cached, whitelist-validated)
    Route::get('/music/builtin/{trackId}', function (string $trackId) {
        $allowed = ['energy-pulse', 'neon-nights', 'clutch-moment', 'smooth-grind', 'flash-zone'];
        if (!in_array($trackId, $allowed, true)) {
            abort(404);
        }
        $path = storage_path('app/music/builtin/' . $trackId . '.mp3');
        if (!file_exists($path)) {
            abort(404, 'Track not available yet.');
        }
        return response()->file($path, [
            'Content-Type'  => 'audio/mpeg',
            'Cache-Control' => 'public, max-age=86400',
        ]);
    })->name('music.builtin');

    Route::get('/montages', [MontageController::class, 'index'])->name('montages.index');
    Route::get('/montages/{montage}', [MontageController::class, 'show'])->name('montages.show');
    Route::get('/montages/{montage}/stream', [MontageController::class, 'stream'])->name('montages.stream');
    Route::delete('/montages/{montage}', [MontageController::class, 'destroy'])->name('montages.destroy');
});
