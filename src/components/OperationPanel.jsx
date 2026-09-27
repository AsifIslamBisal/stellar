import { useStellarCall } from '../hooks/useStellarCall'
import { TRANSPORTS } from '../api/stellarClient'

export function Badge({ tone = 'slate', children, title }) {
  const tones = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    blue: 'bg-sky-50 text-sky-700 border-sky-200',
    amber: 'bg-amber-50 text-amber-800 border-amber-200',
    red: 'bg-rose-50 text-rose-700 border-rose-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  }
  return (
    <span
      title={title}
      className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

export function JsonBlock({ data, emptyHint = 'No response yet.' }) {
  if (data === null || data === undefined) {
    return <p className="text-xs text-slate-400">{emptyHint}</p>
  }
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  return (
    <pre className="max-h-96 overflow-auto rounded border border-slate-200 bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">
      {text}
    </pre>
  )
}

const ERROR_TONES = {
  cors: 'border-rose-300 bg-rose-50 text-rose-800',
  auth: 'border-amber-300 bg-amber-50 text-amber-900',
  server: 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-900',
  ratelimit: 'border-amber-300 bg-amber-50 text-amber-900',
  http: 'border-rose-300 bg-rose-50 text-rose-800',
}

function ErrorBox({ error }) {
  return (
    <div className={`rounded border p-3 text-xs ${ERROR_TONES[error.kind] || ERROR_TONES.http}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="red">{error.kind}</Badge>
        <span className="font-semibold">{error.message}</span>
        {error.status ? <span className="opacity-70">HTTP {error.status}</span> : null}
      </div>
      {error.hint ? <p className="mt-2 leading-relaxed opacity-90">{error.hint}</p> : null}
    </div>
  )
}

export default function OperationPanel({
  operation,
  title,
  subtitle,
  params = {},
  transport,
  disabled = false,
  onData,
  children,
  renderDerived,
}) {
  const { loading, data, error, meta, run, reset } = useStellarCall(operation, { transport, onData })

  return (
    <section className="flex flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-mono text-sm font-semibold text-slate-800">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p> : null}
        </div>
        <Badge tone="blue">RAW · from Stellar</Badge>
      </div>

      {children ? <div className="mt-3">{children}</div> : null}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => run(params)}
          disabled={loading || disabled}
          className="rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          {loading ? 'Running…' : 'Run'}
        </button>
        {data !== null || error !== null ? (
          <button
            type="button"
            onClick={reset}
            className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
          >
            Clear
          </button>
        ) : null}
        {meta ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone={meta.transport === 'text' ? 'amber' : 'blue'} title={TRANSPORTS[meta.transport]?.note}>
              {meta.transportLabel}
            </Badge>
            {meta.status ? <Badge tone="slate">HTTP {meta.status}</Badge> : null}
            <Badge tone="slate">{meta.ms} ms</Badge>
          </div>
        ) : null}
      </div>

      <div className="mt-3">
        {loading ? (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
            Waiting for Stellar…
          </div>
        ) : null}
        {error ? <ErrorBox error={error} /> : null}
        {!loading && !error ? <JsonBlock data={data} /> : null}
      </div>

      {renderDerived && data !== null && !error ? (
        <div className="mt-3 rounded border border-amber-200 bg-amber-50/60 p-3">
          <div className="flex items-center gap-2">
            <Badge tone="amber">DERIVED · computed in browser</Badge>
          </div>
          <div className="mt-2">{renderDerived(data)}</div>
        </div>
      ) : null}
    </section>
  )
}
