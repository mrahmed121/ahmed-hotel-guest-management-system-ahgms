<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('guests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hotel_id')->constrained('hotels')->cascadeOnDelete();
            $table->string('first_name', 60);
            $table->string('last_name', 60);
            $table->string('email', 120)->nullable();
            $table->string('phone', 30);
            $table->string('country', 60)->nullable();
            $table->string('id_type', 30)->nullable(); // passport, cnic, driving_license, other
            $table->string('id_number', 60)->nullable();
            $table->string('address', 255)->nullable();
            $table->text('notes')->nullable();
            $table->boolean('vip')->default(false);
            $table->string('status', 20)->default('active'); // active, blacklisted
            $table->timestamps();

            $table->index(['hotel_id', 'phone']);
            $table->index(['hotel_id', 'last_name']);
            $table->index(['hotel_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('guests');
    }
};
