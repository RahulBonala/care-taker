import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { APP_NAME, APP_TAGLINE } from "@/config/brand";
import { Providers } from "@/components/shell/Providers";
import { Shell } from "@/components/shell/Shell";
import "./globals.css";

const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

// No title here: the shell renders <title> itself so it follows the demo language and screen.
export const metadata: Metadata = {
  description: `${APP_TAGLINE}. Clickable demo with sample data.`,
  applicationName: APP_NAME,
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
  icons: {
    icon: [{ url: `${base}/icons/icon.svg`, type: "image/svg+xml" }, { url: `${base}/icons/icon-192.png`, sizes: "192x192", type: "image/png" }],
    apple: [{ url: `${base}/icons/apple-touch-icon.png`, sizes: "180x180" }],
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0d6b63" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1215" },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
