import "./globals.css";

export const metadata = {
  title: "Journey to Jannah",
  description:
    "A Muslim learning and community ecosystem — beginning with Miftah, guided Qur'an memorization with real-time correction.",
  icons: {
    icon: [
      { url: "/logo-mark.svg", type: "image/svg+xml" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
        <link
          href="https://fonts.googleapis.com/css2?family=Amiri:ital,wght@0,400;0,700;1,400&family=Space+Grotesk:wght@500;700&family=Manrope:wght@400;500;600;700;800&family=Fraunces:ital,wght@1,400;1,500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <div className="app-shell">
          <div className="bg-orbs" aria-hidden="true">
            <span></span>
            <span></span>
            <span></span>
          </div>
          {children}
        </div>
      </body>
    </html>
  );
}
