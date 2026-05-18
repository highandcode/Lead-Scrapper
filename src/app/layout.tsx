import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "Clinic Lead Intelligence | clinicgrowthwithankit.com",
  description: "AI-powered clinic lead discovery and outreach platform for Clinic Growth with Ankit",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background antialiased">
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: "hsl(222 47% 7%)",
              color: "hsl(210 40% 98%)",
              border: "1px solid hsl(217 33% 17%)",
              borderRadius: "0.75rem",
              fontSize: "0.875rem",
            },
            success: {
              iconTheme: { primary: "#10b981", secondary: "#fff" },
            },
            error: {
              iconTheme: { primary: "#ef4444", secondary: "#fff" },
            },
          }}
        />
      </body>
    </html>
  );
}
