import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ConvexClientProvider } from './providers/ConvexClientProvider';
import { ThemeProvider } from './providers/ThemeProvider';
import { Sidebar } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { Toaster } from 'sonner';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
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
