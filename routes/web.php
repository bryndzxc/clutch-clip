<?php

use App\Http\Controllers\VideoController;
use Illuminate\Support\Facades\Route;

// Upload page (home)
Route::get('/', [VideoController::class, 'index'])->name('home');

// Upload video (form submit)
Route::post('/videos', [VideoController::class, 'store'])->name('videos.store');

// Chunked upload — receive one chunk at a time, then assemble
Route::post('/videos/chunks',   [VideoController::class, 'storeChunk'])->name('videos.storeChunk');
Route::post('/videos/assemble', [VideoController::class, 'assembleChunks'])->name('videos.assemble');

// Results page (Inertia)
Route::get('/videos/{video}', [VideoController::class, 'results'])->name('videos.show');

// JSON API: poll status
Route::get('/api/videos/{video}/status', [VideoController::class, 'status'])->name('videos.status');

// JSON API: get clips list
Route::get('/api/videos/{video}/clips', [VideoController::class, 'clips'])->name('videos.clips');

// Serve a clip file
Route::get('/clips/{video}/{clip}', [VideoController::class, 'serveClip'])->name('clips.serve');
