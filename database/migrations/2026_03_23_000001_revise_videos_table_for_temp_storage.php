<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('videos', function (Blueprint $table) {
            $table->string('temp_path')->nullable()->after('original_name');
            $table->decimal('duration', 10, 2)->nullable()->after('status');
            $table->timestamp('uploaded_at')->nullable()->after('error_message');
            $table->timestamp('processed_at')->nullable()->after('uploaded_at');
            $table->timestamp('failed_at')->nullable()->after('processed_at');
            $table->timestamp('deleted_temp_at')->nullable()->after('failed_at');
        });
    }

    public function down(): void
    {
        Schema::table('videos', function (Blueprint $table) {
            $table->dropColumn([
                'temp_path',
                'duration',
                'uploaded_at',
                'processed_at',
                'failed_at',
                'deleted_temp_at',
            ]);
        });
    }
};
