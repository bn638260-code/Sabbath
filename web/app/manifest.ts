import type { MetadataRoute } from "next";
import { SITE } from "./_lib/site";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: SITE.name,
    short_name: SITE.name,
    description: SITE.description,
    start_url: "/SabbathCue/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    icons: [
      {
        src: "/SabbathCue/sabbathcue-icon.png",
        sizes: "1280x1280",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
