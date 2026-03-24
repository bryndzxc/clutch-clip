<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('montage_projects', function (Blueprint $table) {
            // Project-level export settings stored as JSON.
            // Structure:
            // {
            //   "outro_card":   { "enabled": false, "text": "", "duration": 3 },
            //   "aspect_ratio": "original" | "16:9" | "9:16" | "1:1",
            //   "quality":      "standard" | "high" | "smaller",
            //   "music":        { "volume": 0.5, "duck_clips": false, "mute_clips_globally": false }
            // }
            $table->json('project_settings')->nullable()->after('title_card');
        });
    }

    public function down(): void
    {
        Schema::table('montage_projects', function (Blueprint $table) {
            $table->dropColumn('project_settings');
        });
    }
};
