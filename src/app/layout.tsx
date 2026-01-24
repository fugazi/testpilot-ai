import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ToastProvider } from '@/components/providers/ToastProvider';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "TestPilot AI - Generate automated tests for any web application",
  description: "TestPilot AI uses GitHub Copilot SDK to analyze your web application and generate professional Playwright test suites automatically.",
  icons: {
    icon: '/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* ToastProvider adds lightweight toasts for user feedback */}
        <script dangerouslySetInnerHTML={{__html: `/** tailwind prefers body classes for dark */`}} />
        <ToastProvider>
          {children}
        </ToastProvider>
      </body>
    </html>
  );
}
