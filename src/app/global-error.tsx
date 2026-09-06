'use client';

import { reportClientError } from '@/components/observability-reporter';
import { useEffect } from 'react';

/**
 * Last-resort boundary: it only renders when the ROOT layout itself crashed,
 * which means no providers, no i18n, no theme — so the copy is intentionally
 * hard-coded and the markup self-contained. It must also supply its own
 * <html>/<body> (Next.js requirement for global-error).
 */
export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    reportClientError('global-boundary', error.message, error.stack);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', margin: 0 }}>
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '12px',
            padding: '24px',
            textAlign: 'center',
            background: '#faf9f7',
            color: '#1c1b1a',
          }}
        >
          <h1 style={{ fontSize: '22px', margin: 0 }}>Something went wrong</h1>
          <p style={{ maxWidth: '420px', margin: 0, color: '#5f5e5a' }}>
            The app hit an unexpected error. Your data is safe — reloading usually fixes it.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: '8px',
              padding: '12px 24px',
              borderRadius: '12px',
              border: 'none',
              background: '#00685f',
              color: '#ffffff',
              fontSize: '15px',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
