<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('clips', function (Blueprint $table) {
            // Quality confidence tier from the detector: high / medium / low.
            // Allows the frontend to visually distinguish strong highlights
            // from marginal fill candidates.
            $table->string('confidence', 10)->nullable()->after('score');
        });
    }

    public function down(): void
    {
        Schema::table('clips', function (Blueprint $table) {
            $table->dropColumn('confidence');
        });
    }
};
