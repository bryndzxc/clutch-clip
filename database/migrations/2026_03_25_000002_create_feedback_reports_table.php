<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('feedback_reports', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type'); // bug_report | feature_request | general
            $table->string('subject');
            $table->text('message');
            $table->string('page')->nullable();
            $table->unsignedBigInteger('related_project_id')->nullable();
            $table->string('status')->default('new'); // new | reviewed | fixed | closed
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('feedback_reports');
    }
};
