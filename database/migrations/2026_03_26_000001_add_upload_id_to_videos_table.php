<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Adds `upload_id` to the videos table.
 *
 * Purpose: idempotent chunk-upload assembly.
 * The chunked upload flow sends a UUID `upload_id` from the browser.
 * If the browser retries the assemble request (e.g. after a network timeout
 * where the first attempt may have already succeeded), we can detect the
 * duplicate by looking up this column and return the existing Video record
 * instead of assembling a second time.
 *
 * The UNIQUE constraint is the final race-condition guard: if two parallel
 * assembly requests slip through the early check, only one INSERT will succeed.
 * Only populated for chunked uploads; single-file uploads leave it NULL.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('videos', function (Blueprint $table) {
            $table->string('upload_id', 36)
                  ->nullable()
                  ->unique()
                  ->after('user_id')
                  ->comment('Browser-generated UUID for chunked uploads; guards against duplicate assembly');
        });
    }

    public function down(): void
    {
        Schema::table('videos', function (Blueprint $table) {
            $table->dropColumn('upload_id');
        });
    }
};
