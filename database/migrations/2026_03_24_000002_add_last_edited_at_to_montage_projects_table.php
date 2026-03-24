<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('montage_projects', function (Blueprint $table) {
            $table->timestamp('last_edited_at')->nullable()->after('status');
        });

        DB::table('montage_projects')
            ->whereNull('last_edited_at')
            ->update(['last_edited_at' => DB::raw('updated_at')]);
    }

    public function down(): void
    {
        Schema::table('montage_projects', function (Blueprint $table) {
            $table->dropColumn('last_edited_at');
        });
    }
};
