'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: 24, background: '#0f1419', color: '#f5f5f5', minHeight: '100vh' }}>
        <div style={{ maxWidth: 480, margin: '15vh auto', textAlign: 'center' }}>
          <h1 style={{ fontSize: 32, fontWeight: 700 }}>Critical error</h1>
          <p style={{ marginTop: 12, color: '#aaa' }}>
            {error.message || 'The application crashed unexpectedly.'}
          </p>
          {error.digest && (
            <p style={{ marginTop: 8, fontSize: 12, color: '#888', fontFamily: 'monospace' }}>
              Reference: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              marginTop: 20,
              padding: '8px 16px',
              background: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
