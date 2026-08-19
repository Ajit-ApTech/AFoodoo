import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '../components/Providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'AFoodoo Operational Admin Portal 🍲',
  description:
    'Web-based operational dashboard for managing users, food/menu data, orders, delivery zones, and revenue for AFoodoo.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full bg-slate-900 text-slate-100 antialiased">
      <body className={`${inter.className} min-h-full flex flex-col`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
