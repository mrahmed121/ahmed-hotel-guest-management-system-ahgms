<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('rate_plans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hotel_id')->constrained('hotels')->cascadeOnDelete();
            $table->foreignId('room_type_id')->constrained('room_types')->cascadeOnDelete();
            $table->string('name', 80);
            $table->decimal('base_rate', 10, 2);
            $table->date('valid_from');
            $table->date('valid_to');
            $table->decimal('tax_percent', 5, 2)->default(0);
            $table->decimal('service_charge_percent', 5, 2)->default(0);
            $table->integer('min_stay')->default(1);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['hotel_id', 'room_type_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('rate_plans');
    }
};
