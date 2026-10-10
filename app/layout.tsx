import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: { default: "Future Tech — 우리의 다음", template: "%s · Future Tech" },
  description: "함께 배우고, 기록하고, 미래를 만드는 우리 반의 공간.",
  icons: { icon: "/favicon.svg" },
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
