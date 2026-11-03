import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { WordtrailProvider } from "@/hooks/use-wordtrail";
import { Suspense } from "react";
export const metadata = {
  title: "Wordtrail",
  description: "Um companheiro de leitura para aprender inglês",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <WordtrailProvider>
          <Suspense fallback={<main>{children}</main>}>
            <AppShell>{children}</AppShell>
          </Suspense>
        </WordtrailProvider>
      </body>
    </html>
  );
}
