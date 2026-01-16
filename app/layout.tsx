import type { Metadata } from 'next';
import { Open_Sans, IBM_Plex_Mono, Source_Serif_4 } from 'next/font/google';
import './globals.css';
import { ConvexClientProvider } from './providers/ConvexClientProvider';
import { ThemeProvider } from './providers/ThemeProvider';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { Toaster } from 'sonner';

const openSans = Open_Sans({
  variable: '--font-sans',
  subsets: ['latin'],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: '--font-mono',
  weight: ['400', '500', '600', '700'],
  subsets: ['latin'],
});

const sourceSerif4 = Source_Serif_4({
  variable: '--font-serif',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Realty - Real Estate Application',
  description: 'Real estate application built with Next.js and Convex',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body
        className={`${openSans.variable} ${ibmPlexMono.variable} ${sourceSerif4.variable} antialiased`}
      >
        <ThemeProvider
          attribute='class'
          defaultTheme='system'
          enableSystem
          disableTransitionOnChange
        >
          <ConvexClientProvider>
            <div className='flex h-screen overflow-hidden'>
              <Sidebar />
              <div className='flex flex-1 flex-col overflow-hidden'>
                <TopBar />
                <main className='flex-1 overflow-y-auto'>{children}</main>
              </div>
            </div>
            <Toaster richColors position='top-right' />
          </ConvexClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
