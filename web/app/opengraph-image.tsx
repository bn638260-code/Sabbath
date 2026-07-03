import { ImageResponse } from "next/og";
import { SITE } from "./_lib/site";

export const dynamic = "force-static";
export const alt = `${SITE.name} — ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(0,153,255,0.28) 0%, rgba(0,153,255,0.06) 40%, transparent 70%), #000000",
          color: "#FFFFFF",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            color: "rgba(255,255,255,0.7)",
            fontSize: 28,
            letterSpacing: "-0.02em",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 12,
              background: "#0099FF",
              color: "#000000",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: 0,
            }}
          >
            SC
          </div>
          <span style={{ color: "#FFFFFF", fontWeight: 600 }}>{SITE.name}</span>
          <span>·</span>
          <span>github.com/Bongisto/SabbathCue</span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            maxWidth: 1000,
          }}
        >
          <div
            style={{
              fontSize: 88,
              lineHeight: 1.02,
              letterSpacing: "-0.05em",
              fontWeight: 600,
              color: "#FFFFFF",
            }}
          >
            Your Pastor speaks.
          </div>
          <div
            style={{
              fontSize: 88,
              lineHeight: 1.02,
              letterSpacing: "-0.05em",
              fontWeight: 600,
              color: "#0099FF",
            }}
          >
            SabbathCue finds the verse.
          </div>
          <div
            style={{
              fontSize: 28,
              lineHeight: 1.4,
              color: "rgba(255,255,255,0.7)",
              maxWidth: 880,
              marginTop: 12,
            }}
          >
            Real-time AI Bible verse detection for live sermons. Scripture
            on screen the instant it&apos;s spoken — broadcast-ready via NDI.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 12,
            alignItems: "center",
            color: "rgba(255,255,255,0.6)",
            fontSize: 22,
          }}
        >
          <span
            style={{
              padding: "8px 16px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.18)",
            }}
          >
            Free · Open source
          </span>
          <span
            style={{
              padding: "8px 16px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.18)",
            }}
          >
            Windows · macOS
          </span>
          <span
            style={{
              padding: "8px 16px",
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.18)",
            }}
          >
            NDI · OBS · vMix
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
