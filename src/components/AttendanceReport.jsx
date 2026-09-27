import { formatDuration } from '../utils/attendance'
import { Badge } from './OperationPanel'

export const ABSENT_LEAVE_NOTE =
  'Absent/Leave require your own teacher roster and leave system — not available from Stellar.'

const STATUS_TONES = {
  Present: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Late: 'bg-amber-50 text-amber-800 border-amber-200',
  Unknown: 'bg-slate-100 text-slate-600 border-slate-200',
}

function EmptyState({ hasLogs, hasUsers }) {
  return (
    <p className="rounded border border-dashed border-slate-300 bg-slate-50 p-4 text-xs text-slate-500">
      {hasLogs
        ? 'No usable rows for the selected date. Check the raw fetch_log response above, and confirm the selected date appears in its access_date values.'
        : hasUsers
          ? 'No fetch_log data loaded yet — run the fetch_log panel above for the selected date.'
          : 'Run fetch_user_list and fetch_log above; this table is derived from both.'}
    </p>
  )
}

export default function AttendanceReport({ rows, skipped, hasLogs, hasUsers, date, shiftStart }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">Derived teacher attendance preview</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Date <span className="font-mono">{date || '—'}</span> · shift start{' '}
            <span className="font-mono">{shiftStart}</span>
          </p>
        </div>
        <Badge tone="amber">DERIVED · computed in browser</Badge>
      </div>

      <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
        {ABSENT_LEAVE_NOTE} In/Out/Working Hours/Status below are all computed in this browser from
        <span className="font-mono"> fetch_log</span> rows — Stellar does not return them. In Time is the
        earliest <span className="font-mono">access_time</span> per user per day, Out Time the latest.
      </p>

      <div className="mt-3">
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-3 font-medium">Teacher Name</th>
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">In Time</th>
                  <th className="py-2 pr-3 font-medium">Out Time</th>
                  <th className="py-2 pr-3 font-medium">Working Hours</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={`${row.registrationId}|${row.date}`} className="border-b border-slate-100 last:border-0">
                    <td className="py-2 pr-3">
                      <span className="text-slate-800">{row.teacherName}</span>
                      {!row.nameResolved ? (
                        <span className="ml-1 text-[11px] text-slate-400">(no name in user list)</span>
                      ) : null}
                      <span className="block font-mono text-[11px] text-slate-400">reg: {row.registrationId}</span>
                    </td>
                    <td className="py-2 pr-3 font-mono text-slate-600">{row.date}</td>
                    <td className="py-2 pr-3 font-mono text-slate-600">{row.inTime}</td>
                    <td className="py-2 pr-3 font-mono text-slate-600">{row.outTime}</td>
                    <td className="py-2 pr-3 font-mono text-slate-600">{formatDuration(row.workingSeconds)}</td>
                    <td className="py-2">
                      <span
                        className={`inline-flex rounded border px-1.5 py-0.5 text-[11px] font-medium ${STATUS_TONES[row.status] || STATUS_TONES.Unknown}`}
                      >
                        {row.status}
                      </span>
                      <span className="ml-1 text-[11px] text-slate-400">{row.entryCount} log rows</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState hasLogs={hasLogs} hasUsers={hasUsers} />
        )}
      </div>

      {skipped > 0 ? (
        <p className="mt-2 text-[11px] text-slate-500">
          {skipped} fetch_log row(s) were skipped because they had no{' '}
          <span className="font-mono">registration_id</span>/<span className="font-mono">registraton_id</span>, no
          parsable <span className="font-mono">access_date</span>, or no parsable{' '}
          <span className="font-mono">access_time</span>.
        </p>
      ) : null}
    </section>
  )
}
