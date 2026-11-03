"use client";

import { useEffect, useState } from "react";
import { VocabularyPage } from "@/components/vocabulary/vocabulary-page";

export default function Page() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <VocabularyPage /> : <main aria-busy="true" />;
}
