import type { Metadata } from "next";
import "@/styles/globals.css";
import { AuthProvider } from "@/context/auth-context";
import { ThemeProvider } from "@/context/theme-context";
import { QueryProvider } from "@/lib/query-provider";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "Parent-Teacher Communication and Student Monitoring System",
  description: "Production system for Nigerian secondary schools",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <QueryProvider>
          <ThemeProvider>
            <AuthProvider>
              {children}
              <Toaster richColors position="top-right" />
            </AuthProvider>
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
