import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-context";
import { ScaleProvider } from "@/lib/scale-context";
import { AppShell } from "@/components/layout/AppShell";

export const metadata: Metadata = {
  title: "Smart-Weigh Management System",
  description: "Next-gen automated weighbridge management desktop application",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#fbfbfb] text-zinc-900">
        <AuthProvider>
          <ScaleProvider>
            <AppShell>{children}</AppShell>
          </ScaleProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
