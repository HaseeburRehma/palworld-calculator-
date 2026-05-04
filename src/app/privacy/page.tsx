import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How the Palworld Breeding Calculator handles your data.",
};

/**
 * Static, server-rendered. Lists exactly what is and isn't done with the
 * data the user gives this app.
 */
export default function PrivacyPage() {
  return (
    <div className="space-y-6 text-sm">
      <header>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Privacy</h1>
        <p className="mt-1 text-[rgb(var(--muted))]">
          The short version: nothing you put in this app leaves your browser. The longer
          version is below.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">What we don&apos;t collect</h2>
        <ul className="list-disc space-y-1 pl-5">
          <li>No account, no signup, no email collection.</li>
          <li>No analytics, telemetry, error tracking, or third-party SDKs.</li>
          <li>No cookies are set by this app. (Your browser may set its own session cookies for Next.js — those don&apos;t leave your machine.)</li>
          <li>
            Your save file is <strong>never uploaded</strong>. The{" "}
            <Link href="/import" className="hover:underline">
              import flow
            </Link>{" "}
            parses it entirely in a Web Worker on your device.
          </li>
          <li>Your roster, goals, and shared-link contents stay in your browser&apos;s <code>localStorage</code>.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">How to verify the no-upload claim</h2>
        <ol className="list-decimal space-y-1 pl-5">
          <li>Open this site in Chrome, Firefox, or Safari.</li>
          <li>Open DevTools → Network tab. Clear the log.</li>
          <li>
            Go to{" "}
            <Link href="/import" className="hover:underline">
              /import
            </Link>
            .
          </li>
          <li>Drop a save file. Watch the Network tab.</li>
          <li>
            You should see no requests to anywhere except internal Next.js bundles
            (paths starting with <code>/_next/</code>). No <code>POST</code>, no
            <code>PUT</code>, no third-party hosts.
          </li>
        </ol>
        <p className="text-[rgb(var(--muted))]">
          We also ship a development-mode sentinel (<code>useNetworkSentinel</code>) that
          logs a console error if anything in the import flow ever calls{" "}
          <code>fetch</code> or <code>XMLHttpRequest</code>. It&apos;s a tripwire we use
          internally; you can also see it firing in DevTools → Console if you build
          locally.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Where things are stored</h2>
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-[max-content_1fr] sm:gap-x-6">
          <dt className="font-medium">Roster</dt>
          <dd>
            Browser <code>localStorage</code> under <code>palworld-roster-v1</code>.
            Cleared by your browser&apos;s &quot;Clear site data&quot; tools.
          </dd>
          <dt className="font-medium">Goals</dt>
          <dd>
            Browser <code>localStorage</code> under <code>palworld-goals-v1</code>.
          </dd>
          <dt className="font-medium">Save file (during import)</dt>
          <dd>
            In-memory only. The byte buffer is <em>transferred</em> (zero-copy) to the
            parse worker, parsed, and discarded. It is never written to{" "}
            <code>localStorage</code>, <code>IndexedDB</code>, or anywhere else.
          </dd>
          <dt className="font-medium">Share links</dt>
          <dd>
            Roster contents are LZ-compressed and embedded in the URL when you click
            <em> Copy share link</em>. Anyone you share that link with sees the same
            roster. No server is involved.
          </dd>
        </dl>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">What we do collect</h2>
        <p>Nothing. There is no server-side component to this app.</p>
        <p className="text-[rgb(var(--muted))]">
          If you found this page because you&apos;re evaluating whether to trust the
          import flow with a real save: please verify with the steps above. You should
          never have to take a privacy claim at face value.
        </p>
      </section>

      <p className="text-xs text-[rgb(var(--muted))]">
        Source code:{" "}
        <Link href="/" className="hover:underline">
          ←
        </Link>{" "}
        check the repository linked in the footer for the parser, the worker, and the
        import page.
      </p>
    </div>
  );
}
