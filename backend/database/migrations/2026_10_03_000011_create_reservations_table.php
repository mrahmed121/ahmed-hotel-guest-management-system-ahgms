<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reservations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hotel_id')->constrained('hotels')->cascadeOnDelete();
            $table->foreignId('guest_id')->constrained('guests')->restrictOnDelete();
            $table->foreignId('room_id')->nullable()->constrained('rooms')->nullOnDelete();
            $table->foreignId('room_type_id')->constrained('room_types')->restrictOnDelete();
            $table->string('confirmation_code', 20)->unique(); // RSV-YYYY-NNNNNN
            $table->string('status', 20)->default('reserved');
            // inquiry, reserved, confirmed, checked_in, checked_out, cancelled, no_show
            $table->date('check_in');
            $table->date('check_out');
            $table->unsignedInteger('adults')->default(1);
            $table->unsignedInteger('children')->default(0);
            $table->foreignId('rate_plan_id')->nullable()->constrained('rate_plans')->nullOnDelete();
            $table->decimal('nightly_rate', 10, 2);
            $table->decimal('total_estimate', 12, 2);
            $table->string('source', 30)->nullable(); // direct, phone, online, agent
            $table->text('notes')->nullable();
            $table->timestamp('cancelled_at')->nullable();
            $table->string('cancellation_reason', 255)->nullable();
            $table->timestamp('checked_in_at')->nullable();
            $table->timestamp('checked_out_at')->nullable();
            $table->timestamps();

            $table->index(['hotel_id', 'status']);
            $table->index(['hotel_id', 'check_in']);
            $table->index(['room_id', 'check_in', 'check_out']);
            $table->index(['guest_id', 'status']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reservations');
    }
};
