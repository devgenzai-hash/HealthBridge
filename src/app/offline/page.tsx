/**
 * Offline fallback page.
 * Shown when the user is offline and the page isn't cached.
 */

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-bg p-6 text-center">
      <div className="mb-4 text-4xl">📡</div>
      <h1 className="mb-2 text-xl font-bold text-text">You&apos;re offline</h1>
      <p className="mb-6 max-w-sm text-sm text-muted">
        It looks like you&apos;ve lost your internet connection. Your cached reports are still available.
      </p>
      <button
        onClick={() => window.location.reload()}
        className="btn-primary"
      >
        Try Again
      </button>
    </div>
  )
}
