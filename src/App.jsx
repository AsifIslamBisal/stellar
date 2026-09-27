import { useMemo, useState } from 'react'
import { isConfigured, TRANSPORTS, AUTH_USER } from './api/stellarClient'
import OperationPanel, { Badge } from './components/OperationPanel'
import LogsPanel, { todayString } from './components/LogsPanel'
import AttendanceReport from './components/AttendanceReport'
import DashboardCards from './components/DashboardCards'
import {
  buildAttendanceRows,
  collectDistinctDates,
  summarize,
  toArray,
  getRegistrationId,
  pickDisplayName,
} from './utils/attendance'

const CONTROL_CLASS =
  'rounded border border-slate-300 px-2 py-1.5 text-xs text-slate-700 focus:border-slate-500 focus:outline-none'

function Toggle({ checked, onChange, label, hint, tone }) {
  return (
    <label className="flex cursor-pointer items-start gap-2">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5" />
      <span>
        <span className={`text-xs font-medium ${tone === 'amber' ? 'text-amber-800' : 'text-slate-700'}`}>
          {label}
        </span>
        <span className="block text-[11px] text-slate-500">{hint}</span>
      </span>
    </label>
  )
}

function DerivedUserList({ payload }) {
  const rows = toArray(payload).filter((row) => row && typeof row === 'object')
  if (!rows.length) return <p className="text-xs text-slate-500">No object rows to normalise.</p>
  return (
    <ul className="grid grid-cols-1 gap-1 text-xs text-slate-700 sm:grid-cols-2 lg:grid-cols-3">
      {rows.slice(0, 24).map((row, index) => {
        const id = getRegistrationId(row)
        return (
          <li key={`${id ?? 'row'}-${index}`} className="truncate rounded border border-amber-200 bg-white px-2 py-1">
            <span className="text-slate-800">{pickDisplayName(row) || '(no name field found)'}</span>
            <span className="ml-1 font-mono text-[11px] text-slate-500">reg: {id ?? 'unresolved'}</span>
          </li>
        )
      })}
    </ul>
  )
}

function DerivedObjectValues({ payload }) {
  const rows = toArray(payload)
  return (
    <div>
      <p className="mb-2 text-[11px] text-slate-600">
        <span className="font-mono">Object.values()</span> applied — fetch_device_detail returns an object keyed by
        numeric-looking strings, not an array.
      </p>
      {rows.length ? (
        <ul className="grid grid-cols-1 gap-1 text-xs text-slate-700 sm:grid-cols-2 lg:grid-cols-3">
          {rows.slice(0, 24).map((row, index) => (
            <li key={index} className="truncate rounded border border-amber-200 bg-white px-2 py-1 font-mono text-[11px]">
              {typeof row === 'object' && row !== null ? JSON.stringify(row) : String(row)}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-slate-500">Empty response.</p>
      )}
    </div>
  )
}

export default function App() {
  const [transport, setTransport] = useState('json')
  const [userList, setUserList] = useState(null)
  const [logData, setLogData] = useState(null)
  const [analysisDate, setAnalysisDate] = useState(todayString())
  const [shiftStart, setShiftStart] = useState('09:00:00')

  const configured = isConfigured()
  const disabled = !configured

  const logRows = useMemo(() => (logData ? buildAttendanceRows({ logs: logData, users: userList, date: analysisDate, shiftStart }) : null), [logData, userList, analysisDate, shiftStart])
  const summary = useMemo(() => (logData ? summarize({ logs: logData, users: userList, date: analysisDate, shiftStart }) : null), [logData, userList, analysisDate, shiftStart])
  const availableDates = useMemo(() => (logData ? collectDistinctDates(logData) : []), [logData])

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <header>
          <h1 className="text-lg font-semibold text-slate-900">Stellar RAMS Explorer</h1>
          <p className="mt-1 text-xs text-slate-600">
            Local, throwaway, frontend-only probe of the Stellar / RAMS attendance API. No backend. Credentials are
            read from <span className="font-mono">import.meta.env</span> and are visible in the browser bundle — never do
            this in a real deployment.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone="blue">RAW · straight from Stellar</Badge>
            <Badge tone="amber">DERIVED · computed in this browser</Badge>
            <span className="text-[11px] text-slate-500">
              Auth user: <span className="font-mono">{configured ? AUTH_USER : 'not set'}</span>
            </span>
          </div>
        </header>

        {!configured ? (
          <div className="mt-4 rounded border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            <span className="font-semibold">Credentials missing.</span> Copy <span className="font-mono">.env.example</span>{' '}
            to <span className="font-mono">.env</span>, set{' '}
            <span className="font-mono">VITE_STELLAR_AUTH_USER</span> and{' '}
            <span className="font-mono">VITE_STELLAR_AUTH_CODE</span>, then restart the dev server. Run buttons are
            disabled until then.
          </div>
        ) : null}

        <section className="mt-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800">Request settings</h2>
          <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
            <Toggle
              checked={transport === 'text'}
              tone="amber"
              onChange={(checked) => setTransport(checked ? 'text' : 'json')}
              label="CORS escape hatch — send as text/plain"
              hint={`Currently: ${TRANSPORTS[transport].label}. ${TRANSPORTS.text.note}`}
            />
            <label className="block">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Analysis date (sections B &amp; C)
              </span>
              <input
                type="date"
                value={analysisDate}
                onChange={(event) => setAnalysisDate(event.target.value)}
                className={`mt-1 ${CONTROL_CLASS}`}
              />
            </label>
            <label className="block">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Shift start (Late threshold)
              </span>
              <input
                type="text"
                value={shiftStart}
                placeholder="09:00:00"
                onChange={(event) => setShiftStart(event.target.value)}
                className={`mt-1 ${CONTROL_CLASS}`}
              />
            </label>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            No polling and no timers: every request below only fires when you click Run. Stellar asks for at least 5
            minutes between calls to the same account.
          </p>
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">A. Raw data explorer</h2>
          <div className="mt-2 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <OperationPanel
              operation="fetch_user_list"
              title="fetch_user_list"
              subtitle="All registered users. Responses use the misspelled key registraton_id."
              transport={transport}
              disabled={disabled}
              onData={setUserList}
              renderDerived={(data) => <DerivedUserList payload={data} />}
            />
            <OperationPanel
              operation="fetch_user_in_device_list"
              title="fetch_user_in_device_list"
              subtitle="Users as enrolled on devices. Also uses the misspelled registraton_id key."
              transport={transport}
              disabled={disabled}
              renderDerived={(data) => <DerivedUserList payload={data} />}
            />
            <OperationPanel
              operation="fetch_device_detail"
              title="fetch_device_detail"
              subtitle="Returns an object keyed by numeric-looking strings, not an array."
              transport={transport}
              disabled={disabled}
              renderDerived={(data) => <DerivedObjectValues payload={data} />}
            />
            <LogsPanel
              operation="fetch_log"
              title="fetch_log"
              subtitle="Attendance log range. Uses the correctly spelled registration_id. Feeds sections B and C."
              transport={transport}
              disabled={disabled}
              onData={setLogData}
            />
            <LogsPanel
              operation="fetch_gps_log"
              title="fetch_gps_log"
              subtitle="GPS log range via the separate /rams/service/get_gps_log endpoint (currently returns HTTP 500 server-side)."
              transport={transport}
              disabled={disabled}
            />
          </div>
        </section>

        {logData && availableDates.length ? (
          <section className="mt-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] uppercase tracking-wide text-slate-500">Dates in last fetch_log:</span>
              {availableDates.map((date) => (
                <button
                  key={date}
                  type="button"
                  onClick={() => setAnalysisDate(date)}
                  className={`rounded border px-2 py-0.5 font-mono text-[11px] ${
                    date === analysisDate
                      ? 'border-slate-800 bg-slate-800 text-white'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {date}
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-6 space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">B &amp; C. Derived views</h2>
          <DashboardCards
            summary={summary}
            date={analysisDate}
            shiftStart={shiftStart}
            hasLogs={Boolean(logData)}
            hasUsers={Boolean(userList)}
          />
          <AttendanceReport
            rows={logRows?.rows ?? []}
            skipped={logRows?.skipped ?? 0}
            hasLogs={Boolean(logData)}
            hasUsers={Boolean(userList)}
            date={analysisDate}
            shiftStart={shiftStart}
          />
        </section>

        <footer className="mt-8 border-t border-slate-200 pt-4 text-[11px] leading-relaxed text-slate-500">
          Only the five documented Stellar operations are implemented: fetch_user_list, fetch_user_in_device_list,
          fetch_device_detail, fetch_log, fetch_gps_log. There is no create/enroll operation in the Stellar docs, so
          there is no user-creation UI here. Everything labelled DERIVED would move to server-side logic in a real
          build, along with the credentials.
        </footer>
      </div>
    </div>
  )
}
