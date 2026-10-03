<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rooms', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hotel_id')->constrained('hotels')->cascadeOnDelete();
            $table->foreignId('floor_id')->nullable()->constrained('floors')->nullOnDelete();
            $table->foreignId('room_type_id')->constrained('room_types')->restrictOnDelete();
            $table->string('number', 20);
            $table->string('status', 20)->default('available');
            $table->json('features')->nullable();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->unique(['hotel_id', 'number']);
            $table->index(['hotel_id', 'status']);
            $table->index('room_type_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rooms');
    }
};
