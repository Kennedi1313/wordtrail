import "./globals.css";
import { AppShell } from "@/components/layout/app-shell";
import { WordtrailProvider } from "@/hooks/use-wordtrail";
import { Suspense } from "react";
import { PwaRegister } from "./pwa-register";
export const metadata = {
  title: "Wordtrail",
  description: "Um companheiro de leitura para aprender inglês",
  applicationName: "Wordtrail",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Wordtrail" },
  icons: { icon: "/icons/icon.svg", apple: "/icons/apple-touch-icon.svg" },
};
export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f4ee",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <PwaRegister />
        <WordtrailProvider>
          <Suspense fallback={<main>{children}</main>}>
            <AppShell>{children}</AppShell>
          </Suspense>
        </WordtrailProvider>
      </body>
    </html>
  );
}
