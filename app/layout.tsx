import type { Metadata, Viewport } from "next";
import "@fontsource-variable/orbitron";
import "@fontsource-variable/space-grotesk";
import "@fontsource/chakra-petch/500.css";
import "@fontsource/chakra-petch/600.css";
import "@fontsource/chakra-petch/700.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "DESIGNATHON X — THE FINAL 12", template: "%s · DESIGNATHON X" },
  description: "12 Hours. One Mission. Infinite Possibilities. The official mission clock of Designathon X.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#020611",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body>{children}</body>
    </html>
  );
}
