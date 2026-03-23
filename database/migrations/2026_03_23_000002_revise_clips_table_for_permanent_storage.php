<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clips', function (Blueprint $table) {
            $table->string('clip_path')->after('filename');
            $table->string('thumbnail_path')->nullable()->after('clip_path');
            $table->decimal('duration', 8, 2)->after('end_time');
        });
    }

    public function down(): void
    {
        Schema::table('clips', function (Blueprint $table) {
            $table->dropColumn(['clip_path', 'thumbnail_path', 'duration']);
        });
    }
};
