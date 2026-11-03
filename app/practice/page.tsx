"use client";

import { useEffect, useState } from "react";
import { PracticePage } from "@/components/practice/practice-page";

export default function Page() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <PracticePage /> : <main aria-busy="true" />;
}
