import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shikkha Squared | Elevate Your Potential",
  description: "Explore O and A Level learning at Shikkha Squared.",
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
      <body className="antialiased">{children}</body>
    </html>
  );
}
