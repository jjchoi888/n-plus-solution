import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// 💡 1. 방금 만든 플로팅 뒤로 가기 버튼을 정확한 경로에서 불러옵니다.
import FloatingBackButton from "../components/FloatingBackButton";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// (참고: 나중에 title과 description을 실제 호텔/서비스 이름으로 바꾸시면 검색엔진에 더 좋습니다!)
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
        {/* 💡 2. 화면 전체에 공통으로 떠 있도록 body 태그 바로 안쪽에 쏙 넣습니다! */}
        <FloatingBackButton />
        
        {children}
      </body>
    </html>
  );
}