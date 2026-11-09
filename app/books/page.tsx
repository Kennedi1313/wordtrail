"use client";

import { useEffect, useState } from "react";
import { BooksPage } from "@/components/books/books-page";

export default function Page() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <BooksPage /> : <main aria-busy="true" />;
}