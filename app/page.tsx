"use client";

import { useEffect, useState } from "react";
import { HomePage } from "@/components/home/home-page";

export default function Page() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <HomePage /> : <main aria-busy="true" />;
}
