<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('folios', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hotel_id')->constrained('hotels')->cascadeOnDelete();
            $table->foreignId('stay_id')->constrained('stays')->restrictOnDelete()->unique();
            $table->string('folio_number')->unique(); // FL-YYYY-NNNNNN
            $table->enum('status', ['open', 'closed'])->default('open');
            $table->dateTime('opened_at');
            $table->dateTime('closed_at')->nullable();
            $table->timestamps();

            $table->index('hotel_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('folios');
    }
};
