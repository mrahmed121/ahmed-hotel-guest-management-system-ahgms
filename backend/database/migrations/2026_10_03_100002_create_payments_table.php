<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('hotel_id')->constrained('hotels')->cascadeOnDelete();
            $table->foreignId('folio_id')->constrained('folios')->restrictOnDelete();
            $table->string('receipt_number')->unique(); // RCPT-YYYY-NNNNNN
            $table->enum('method', ['cash', 'card', 'bank_transfer', 'other']);
            $table->decimal('amount', 12, 2);
            $table->dateTime('paid_at');
            $table->string('reference')->nullable();
            $table->string('idempotency_key')->unique();
            $table->foreignId('received_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index('folio_id');
            $table->index('hotel_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
