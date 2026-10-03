import type { Metadata } from "next";
import { Shell } from "@/components/Shell";
import "./globals.css";
export const metadata: Metadata = {
  icons: {
    icon: "/branding/beacon-favicon.png",
    apple: "/branding/beacon-favicon.png",
  },
  title: "Beacon Health System | Credential Management",
  description:
    "Michigan RN credential monitoring and manager assistant for Beacon Health System.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
