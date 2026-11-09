import type { Metadata, Viewport } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-sans-kr",
});

export const metadata: Metadata = {
  title: "서류 위험도 점검",
  description: "전세대출 병합 PDF의 개인정보 위험도 등급을 확인합니다.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" className={notoSansKr.variable}>
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
