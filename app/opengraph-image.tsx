import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "FC Help - INFO · SQUAD · ALARM · COMMUNITY";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          alignItems: "center",
          justifyContent: "center",
          background: "#070908",
          color: "white",
          overflow: "hidden",
          fontFamily: "Arial, Helvetica, sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            background:
              "linear-gradient(120deg, rgba(0,255,96,.10), transparent 32%), linear-gradient(300deg, rgba(0,255,96,.12), transparent 38%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: -70,
            top: -120,
            width: 290,
            height: 900,
            display: "flex",
            transform: "rotate(28deg)",
            background: "rgba(0,255,96,.16)",
            borderRight: "5px solid #00ef62",
          }}
        />
        <div
          style={{
            position: "absolute",
            right: -120,
            bottom: -180,
            width: 330,
            height: 920,
            display: "flex",
            transform: "rotate(28deg)",
            background: "rgba(0,255,96,.14)",
            borderLeft: "5px solid #00ef62",
          }}
        />
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <div
              style={{
                width: 150,
                height: 150,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "14px solid white",
                borderRightColor: "#00ef62",
                borderRadius: 34,
                transform: "rotate(45deg)",
                boxShadow: "0 0 28px rgba(0,239,98,.22)",
              }}
            >
              <div
                style={{
                  width: 76,
                  height: 76,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 999,
                  background: "white",
                  color: "#070908",
                  fontSize: 46,
                  fontWeight: 900,
                  transform: "rotate(-45deg)",
                }}
              >
                ⚽
              </div>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                fontSize: 122,
                fontWeight: 900,
                fontStyle: "italic",
                letterSpacing: -7,
              }}
            >
              <span>FC </span>
              <span style={{ color: "#00ef62" }}>H</span>
              <span>elp</span>
            </div>
          </div>
          <div
            style={{
              marginTop: 34,
              display: "flex",
              alignItems: "center",
              gap: 24,
              fontSize: 28,
              fontWeight: 800,
              fontStyle: "italic",
              letterSpacing: 3,
            }}
          >
            <span>INFO</span><span style={{ color: "#00ef62" }}>/</span>
            <span>SQUAD</span><span style={{ color: "#00ef62" }}>/</span>
            <span>ALARM</span><span style={{ color: "#00ef62" }}>/</span>
            <span>COMMUNITY</span>
          </div>
        </div>
      </div>
    ),
    size
  );
}
