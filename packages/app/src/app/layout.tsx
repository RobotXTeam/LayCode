import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Layrr",
  description: "Point, click, and edit any web app with AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistMono.variable} dark`}>
      <body className="min-h-screen bg-zinc-950 text-zinc-100 font-mono antialiased">
        {children}
      </body>
    </html>
  );
}
