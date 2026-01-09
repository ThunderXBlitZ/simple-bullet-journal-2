import type React from "react"
import type { Metadata, Viewport } from "next"
import { Crimson_Pro, JetBrains_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { ThemeProvider } from "@/components/theme-provider"
import "./globals.css"

const crimsonPro = Crimson_Pro({
  subsets: ["latin"],
  variable: "--font-crimson",
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
})

export const metadata: Metadata = {
  title: "Bullet Journal",
  description: "A minimalist digital bullet journal for rapid logging, habit tracking, and journaling",
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f7f4" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a2e" },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${crimsonPro.variable} ${jetbrainsMono.variable} font-serif antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
