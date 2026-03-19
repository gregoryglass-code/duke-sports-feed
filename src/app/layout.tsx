import type { Metadata } from "next";
import { NavBar } from "@/components/NavBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "Duke Sports Feed — All Blue Devils News",
  description:
    "Aggregated Duke University Blue Devils sports news from across the internet. Basketball, football, and all sports.",
  openGraph: {
    title: "Duke Sports Feed",
    description: "All Duke Blue Devils sports news in one place",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;500;600;700&family=Poppins:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
