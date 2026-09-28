/**
 * Shown when the Supabase environment variables are missing. Rendering a clear
 * checklist beats a stack trace for a freshly cloned repository.
 */
export default function SetupPage() {
  const rows: Array<[string, string]> = [
    ['NEXT_PUBLIC_SUPABASE_URL', 'Supabase dashboard → Project settings → API → Project URL'],
    [
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'Supabase dashboard → Project settings → API → anon/publishable key',
    ],
    [
      'SUPABASE_SERVICE_ROLE_KEY',
      'Optional, server-only. Needed for the maintenance scripts, never for the UI.',
    ],
    ['NEXT_PUBLIC_APP_URL', 'http://localhost:3000 in development'],
  ];

  return (
    <main id="main" className="mx-auto w-full max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold text-slate-900">Finish the setup</h1>
      <p className="mt-2 text-sm text-slate-600">
        The application is running but is not connected to a database yet. Create
        <code className="mx-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs">.env.local</code>
        from <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">.env.example</code>, fill
        in the values below, then run the SQL migrations (see <code>docs/SETUP.md</code>).
      </p>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs tracking-wide text-slate-500 uppercase">
            <tr>
              <th scope="col" className="px-4 py-2.5">
                Variable
              </th>
              <th scope="col" className="px-4 py-2.5">
                Where to find it
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(([name, where]) => (
              <tr key={name}>
                <td className="px-4 py-3 font-mono text-xs text-slate-800">{name}</td>
                <td className="px-4 py-3 text-slate-600">{where}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm text-slate-600">
        <li>
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
            npx supabase link --project-ref &lt;your-project&gt;
          </code>
        </li>
        <li>
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
            npx supabase db push
          </code>{' '}
          — applies every migration in <code>supabase/migrations</code>.
        </li>
        <li>
          Restart <code>npm run dev</code> and create the first account.
        </li>
      </ol>
    </main>
  );
}
