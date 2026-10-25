import type { Metadata } from 'next';
import { Analytics } from '@vercel/analytics/next';
import 'katex/dist/katex.min.css';
import './globals.css';
export const metadata: Metadata = {title:'ensemble++ — Classroom',description:'Real-time classroom participation, response analysis, and reports.'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}<Analytics /></body></html>;}
