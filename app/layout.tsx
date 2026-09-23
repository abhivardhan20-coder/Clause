import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clause — Understand before you agree",
  description:
    "Understand legal documents, compare agreements, and prepare your next steps with source-linked assistance.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <a href="#main-content" className="skip-link">
          Skip to document workspace
        </a>
        {children}
      </body>
    </html>
  );
}
