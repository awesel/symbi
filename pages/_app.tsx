import '../styles/globals.css'; // Assuming you have a global stylesheet
import type { AppProps } from 'next/app';
import { AuthProvider } from '../contexts/AuthContext'; // Adjust path if your context is elsewhere
import { Analytics } from '@vercel/analytics/react';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <AuthProvider>
      <Component {...pageProps} />
      <Analytics />
    </AuthProvider>
  );
}

export default MyApp; 