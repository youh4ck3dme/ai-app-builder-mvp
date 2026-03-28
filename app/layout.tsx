import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AI App Builder MVP',
  description: 'Durable workflow-based starter for an AI app builder.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
