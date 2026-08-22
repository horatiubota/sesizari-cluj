import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Sesizări Cluj',
  description:
    'Toate sesizările publice trimise Primăriei Cluj-Napoca prin platforma My Cluj, din 2017 până azi — căutabile, pe hartă și analizate.',
  openGraph: {
    title: 'Sesizări Cluj',
    description: 'Sesizările publice din Cluj-Napoca, din 2017 până azi.',
    locale: 'ro_RO',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ro">
      <body className="bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        {children}
      </body>
    </html>
  );
}
