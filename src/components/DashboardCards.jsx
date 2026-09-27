import { Badge } from './OperationPanel'
import { ABSENT_LEAVE_NOTE } from './AttendanceReport'

const UNAVAILABLE_HINT =
  'Stellar has no leave-management data and no teacher roster to diff against, so this number cannot be derived from the API. It needs Pathshala-side logic.'

function Card({ label, value, tone, note, unavailable, tooltip }) {
  const tones = {
    slate: 'border-slate-200',
    emerald: 'border-emerald-200',
    amber: 'border-amber-200',
  }
  return (
    <div className={`rounded-lg border bg-white p-4 shadow-sm ${tones[tone] || tones.slate}`} title={tooltip}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${unavailable ? 'text-slate-400' : 'text-slate-800'}`}>{value}</p>
      {unavailable ? (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
          <span
            className="cursor-help rounded bg-slate-200 px-1 font-semibold text-slate-700"
            title={UNAVAILABLE_HINT}
          >
            ?
          </span>
          Cannot be derived from Stellar
        </p>
      ) : null}
      {note ? <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{note}</p> : null}
    </div>
  )
}

export default function DashboardCards({ summary, date, shiftStart, hasLogs, hasUsers }) {
  const empty = !summary || (!hasLogs && !hasUsers)

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Dashboard summary</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Date <span className="font-mono">{date || '—'}</span> · shift start{' '}
            <span className="font-mono">{shiftStart}</span>
          </p>
        </div>
        <Badge tone="amber">DERIVED · computed in browser</Badge>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card
          label="Total Users"
          value={empty ? '—' : summary.totalUsers}
          tone="slate"
          tooltip="Distinct registration_id / registraton_id values in the fetch_user_list response."
          note="Every registered user, not just teachers — Stellar has no role field."
        />
        <Card
          label="Present"
          value={empty ? '—' : summary.present}
          tone="emerald"
          tooltip="Distinct registration_ids with at least one fetch_log entry on this date."
          note="Distinct users with ≥1 log entry that date."
        />
        <Card
          label="Late"
          value={empty ? '—' : summary.late}
          tone="amber"
          tooltip="Distinct registration_ids whose earliest access_time is later than the shift start."
          note={`In Time after ${shiftStart}.`}
        />
        <Card label="Absent" value="N/A" tone="slate" unavailable tooltip={UNAVAILABLE_HINT} />
        <Card label="Leave" value="N/A" tone="slate" unavailable tooltip={UNAVAILABLE_HINT} />
      </div>

      <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
        {ABSENT_LEAVE_NOTE} Present and Late are counted from <span className="font-mono">fetch_log</span> only; Total
        Users comes from <span className="font-mono">fetch_user_list</span>.
      </p>

      {!empty && summary.skippedLogRows > 0 ? (
        <p className="mt-2 text-[11px] text-slate-500">
          {summary.skippedLogRows} log row(s) skipped as unparsable; Present/Late may undercount.
        </p>
      ) : null}
      {!empty && summary.unresolvedNames > 0 ? (
        <p className="mt-1 text-[11px] text-slate-500">
          {summary.unresolvedNames} user(s) in the log were not found in fetch_user_list, so no display name is joined.
        </p>
      ) : null}
    </section>
  )
}
