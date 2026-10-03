import type { MetadataRoute } from "next";
import { APP_NAME, APP_TAGLINE } from "@/config/brand";

export const dynamic = "force-static";

const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} (demo)`,
    short_name: APP_NAME,
    description: APP_TAGLINE,
    start_url: `${base}/`,
    scope: `${base}/`,
    display: "standalone",
    orientation: "any",
    background_color: "#f5f7f8",
    theme_color: "#0d6b63",
    icons: [
      { src: `${base}/icons/icon-192.png`, sizes: "192x192", type: "image/png" },
      { src: `${base}/icons/icon-512.png`, sizes: "512x512", type: "image/png" },
      { src: `${base}/icons/icon-maskable-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: `${base}/icons/icon.svg`, sizes: "any", type: "image/svg+xml" },
    ],
  };
}
