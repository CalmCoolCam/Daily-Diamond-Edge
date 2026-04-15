import './globals.css'

export const metadata = {
  title: 'Daily Diamond Edge',
  description: 'Your daily edge on the diamond — MLB fantasy & betting analytics',
  icons: {
    icon: '/favicon.ico',
  },
  openGraph: {
    title: 'Daily Diamond Edge',
    description: 'Your daily edge on the diamond',
    type: 'website',
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#f8fafc',
}

/**
 * Inline script that runs before hydration to set the correct theme class,
 * preventing a flash of the wrong theme on first load.
 * Reads 'dde_theme' from localStorage; defaults to 'light'.
 */
const ThemeScript = () => (
  <script
    dangerouslySetInnerHTML={{
      __html: `
        (function() {
          try {
            var theme = localStorage.getItem('dde_theme') || 'light';
            if (theme === 'dark') {
              document.documentElement.classList.add('dark');
            } else {
              document.documentElement.classList.remove('dark');
            }
          } catch(e) {}
        })();
      `,
    }}
  />
)

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <ThemeScript />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,opsz,wght@0,9..40,300..700;1,9..40,300..700&display=swap"
          rel="stylesheet"
        />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
