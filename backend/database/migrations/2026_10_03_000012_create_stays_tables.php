<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('stays', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hotel_id')->constrained('hotels')->cascadeOnDelete();
            $table->foreignId('reservation_id')->constrained('reservations')->restrictOnDelete()->unique();
            $table->foreignId('guest_id')->constrained('guests')->restrictOnDelete();
            $table->foreignId('room_id')->constrained('rooms')->restrictOnDelete();
            $table->dateTime('checked_in_at');
            $table->dateTime('checked_out_at')->nullable();
            $table->date('expected_checkout');
            $table->string('status', 20)->default('in_house'); // in_house, checked_out
            $table->unsignedInteger('adults')->default(1);
            $table->unsignedInteger('children')->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['hotel_id', 'status']);
            $table->index(['room_id', 'status']);
            $table->index(['guest_id', 'status']);
        });

        Schema::create('stay_room_history', function (Blueprint $table) {
            $table->id();
            $table->foreignId('stay_id')->constrained('stays')->cascadeOnDelete();
            $table->foreignId('from_room_id')->constrained('rooms')->restrictOnDelete();
            $table->foreignId('to_room_id')->constrained('rooms')->restrictOnDelete();
            $table->text('reason');
            $table->foreignId('actor_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->index(['stay_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('stay_room_history');
        Schema::dropIfExists('stays');
    }
};
