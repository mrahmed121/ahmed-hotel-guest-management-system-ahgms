<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('folio_adjustments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('folio_id')->constrained('folios')->cascadeOnDelete();
            $table->enum('type', ['discount', 'additional_charge', 'correction']);
            // Signed: discounts are negative, additional charges positive.
            $table->decimal('amount', 12, 2);
            $table->text('reason');
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index('folio_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('folio_adjustments');
    }
};
