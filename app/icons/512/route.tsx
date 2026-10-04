import { ImageResponse } from "next/og";

export function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2f8cf0",
          color: "#ffffff",
          fontSize: 300,
          fontWeight: 800,
        }}
      >
        UF
      </div>
    ),
    { width: 512, height: 512 },
  );
}
