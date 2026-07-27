import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { clientEnv } from "@/env";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(clientEnv.NEXT_PUBLIC_APP_URL),
  title: {
    default: `${clientEnv.NEXT_PUBLIC_SCHOOL_NAME} Alumni Network`,
    template: `%s · ${clientEnv.NEXT_PUBLIC_SCHOOL_NAME} Alumni Network`,
  },
  description: `Reconnect with graduates of ${clientEnv.NEXT_PUBLIC_SCHOOL_NAME}. Verified alumni only.`,
  openGraph: {
    type: "website",
    siteName: `${clientEnv.NEXT_PUBLIC_SCHOOL_NAME} Alumni Network`,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        {children}
        <Toaster />
      </body>
    </html>
  );
}
