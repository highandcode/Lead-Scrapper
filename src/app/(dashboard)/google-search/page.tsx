"use client";

import { useState } from "react";
import Header from "@/components/dashboard/Header";
import GoogleSearchPanel from "@/components/search/GoogleSearchPanel";

export default function GoogleSearchPage() {
  const [, setLastCount] = useState<number | null>(null);

  return (
    <div>
      <Header
        title="Google Search"
        subtitle="Scrape leads straight from Google — business profiles and top websites"
      />
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <GoogleSearchPanel onSearchComplete={setLastCount} />
        </div>
      </div>
    </div>
  );
}
