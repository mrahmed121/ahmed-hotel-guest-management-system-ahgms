<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('folio_lines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('folio_id')->constrained('folios')->cascadeOnDelete();
            $table->enum('line_type', ['room', 'service', 'tax', 'fee', 'adjustment', 'discount']);
            $table->string('description');
            $table->decimal('quantity', 10, 2)->default(1);
            $table->decimal('unit_price', 12, 2);
            // Signed: discounts are stored negative. amount = quantity × unit_price (sign preserved).
            $table->decimal('amount', 12, 2);
            $table->date('service_date')->nullable();
            $table->string('ref_type')->nullable();
            $table->unsignedBigInteger('ref_id')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['folio_id', 'line_type']);
            $table->index(['folio_id', 'service_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('folio_lines');
    }
};
