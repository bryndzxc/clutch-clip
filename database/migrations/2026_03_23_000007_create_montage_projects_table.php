<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('montage_projects', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('video_id')->constrained()->cascadeOnDelete();

            // Project metadata
            $table->string('title', 160)->default('My Montage');

            // Edit decisions — all stored as JSON
            // clip_order:    [3, 1, 5] — ordered clip IDs
            // clip_settings: { "3": { trim_start: 0, trim_end: 8.5, muted: false } }
            // title_card:    { enabled: true, text: "Best Plays", duration: 3 }
            $table->json('clip_order')->nullable();
            $table->json('clip_settings')->nullable();
            $table->json('title_card')->nullable();

            // Export lifecycle
            // pending | queued | processing | done | failed
            $table->string('status', 20)->default('pending');
            $table->string('output_path')->nullable();   // relative to storage/app/
            $table->text('error_message')->nullable();
            $table->timestamp('queued_at')->nullable();
            $table->timestamp('completed_at')->nullable();

            $table->timestamps();

            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('montage_projects');
    }
};
