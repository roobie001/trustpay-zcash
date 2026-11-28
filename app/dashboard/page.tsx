"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SellerDashboard } from "@/components/SellerDashboard";
import { PageShell } from "@/components/page-shell";
import { secondaryButtonClass } from "@/lib/ui";

function DashboardContent() {
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(true);

  return (
    <PageShell role="seller">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/"
          className={`${secondaryButtonClass} text-xs`}
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to TrustPay</span>
        </Link>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs font-semibold text-amber-500 hover:underline"
        >
          Re-open Seller Ledger
        </button>
      </div>

      <SellerDashboard
        open={open}
        onClose={() => setOpen(false)}
        initialLookup={searchParams.get("lookup") || searchParams.get("key") || undefined}
      />
    </PageShell>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <DashboardContent />
    </Suspense>
  );
}
