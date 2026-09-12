import type { Metadata } from "next";
import { Baloo_Da_2 } from "next/font/google";
import "./globals.css";

/**
 * Baloo Da 2 carries both Bengali and Latin, so product names typed in
 * Bengali render in the same typeface as the rest of the interface instead
 * of falling back to whatever the device happens to have.
 *
 * Self-hosted by next/font at build time: no request to Google from the
 * browser, and no flash of unstyled text.
 */
const baloo = Baloo_Da_2({
  subsets: ["bengali", "latin"],
  // The face tops out at 800; `font-black` renders at that weight.
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-baloo",
  display: "swap",
});
import { AuthProvider } from "@/components/providers/AuthProvider";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "Ozipco Inventory",
  description: "Inventory management system for Ozipco",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={baloo.variable}>
      <body>
        <AuthProvider>
          <ToastProvider>{children}</ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
