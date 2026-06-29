import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// 💡 1. Import the floating back button from the correct path.
import FloatingBackButton from "@/components/FloatingBackButton";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// (Note: Updating the title and description with the actual hotel/service name later is highly recommended for better SEO!)
export const metadata = {
  title: "N Plus Solution",
  description: "Smart Hotel PMS & Kiosk Web Service",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* 💡 2. Placed globally right inside the body tag so it floats across all screens! */}
        <FloatingBackButton />

        {children}
      </body>
    </html>
  );
}