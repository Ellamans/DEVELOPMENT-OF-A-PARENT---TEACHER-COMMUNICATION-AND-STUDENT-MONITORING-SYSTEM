"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

// Next.js App Router convention: this file catches any uncaught error thrown
// while rendering anything under the (app) route group and shows a
// recoverable screen instead of the framework's default full-page
// "Application error: a client-side exception has occurred" crash, which
// previously took down the entire app for a bug in a single page/component.
export default function AppSectionError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the real error in the browser console so it can be diagnosed
    // (screenshotted / copy-pasted) without needing server log access.
    console.error("Unhandled error in (app) section:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-card border border-border rounded-lg p-6 text-center">
        <AlertTriangle className="h-10 w-10 text-orange-500 mx-auto mb-3" />
        <h2 className="text-lg font-semibold text-text mb-1">Something went wrong</h2>
        <p className="text-sm text-text/60 mb-4">
          This page hit an unexpected error. You can try again, or head back to the dashboard.
        </p>
        {error?.message && (
          <pre className="text-xs text-left bg-background border border-border rounded p-3 mb-4 overflow-x-auto whitespace-pre-wrap text-text/70">
            {error.message}
          </pre>
        )}
        <div className="flex justify-center gap-2">
          <button
            onClick={reset}
            className="px-4 py-2 text-sm rounded bg-primary text-white font-medium hover:opacity-90"
          >
            Try again
          </button>
          <a
            href="/dashboard"
            className="px-4 py-2 text-sm rounded border border-border text-text"
          >
            Back to Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
