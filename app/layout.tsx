import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Booth — AI Sports Officiating Analysis",
  description:
    "Upload a sports video clip and get an AI-powered fair/bad call verdict grounded in official rules. Powered by Gemini.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
