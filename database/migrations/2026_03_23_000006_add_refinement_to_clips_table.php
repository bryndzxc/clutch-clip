<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clips', function (Blueprint $table) {
            // User-assigned label / rename
            $table->string('label', 120)->nullable()->after('score');

            // Path to the refined export (null = no refinement done yet)
            $table->string('refined_path')->nullable()->after('label');

            // Whether the refined export was muted
            $table->boolean('muted')->default(false)->after('refined_path');

            // When the last refinement was produced
            $table->timestamp('refined_at')->nullable()->after('muted');
        });
    }

    public function down(): void
    {
        Schema::table('clips', function (Blueprint $table) {
            $table->dropColumn(['label', 'refined_path', 'muted', 'refined_at']);
        });
    }
};
