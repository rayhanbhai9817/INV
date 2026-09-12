"use client";

import { StockMovementForm } from "@/components/modules/StockMovementForm";

export default function StockOutPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-6 rounded-[20px] border border-[#f4f7fe] bg-white p-6 shadow-sm md:flex-row md:items-center">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-[#2b3674]">Stock OUT</h1>
          <p className="text-sm font-medium text-[#a3aed0]">
            Record outgoing products. The system ensures you don&apos;t dispatch more than
            available stock.
          </p>
        </div>
      </div>

      <StockMovementForm mode="STOCK_OUT" />
    </div>
  );
}
