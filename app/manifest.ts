// app/manifest.ts
// PWA用マニフェスト（Next.js標準機能。Service Workerは導入しない）

import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "街歩きコンパス",
    short_name: "街歩きコンパス",
    description: "目的地の方角だけを頼りに歩く体験を検証するスマホ向けWebアプリ",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
