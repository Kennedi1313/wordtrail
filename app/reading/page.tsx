"use client";

import { useEffect, useState } from "react";
import { ReadingPage } from "@/components/reading/reading-page";

export default function Page() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <ReadingPage /> : <main aria-busy="true" />;
}
