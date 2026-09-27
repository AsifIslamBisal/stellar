import { useState } from 'react'
import OperationPanel from './OperationPanel'

export function todayString() {
  const now = new Date()
  const offsetMs = now.getTimezoneOffset() * 60000
  return new Date(now.getTime() - offsetMs).toISOString().slice(0, 10)
}

const FIELD_CLASS =
  'w-full rounded border border-slate-300 px-2 py-1.5 text-xs text-slate-700 focus:border-slate-500 focus:outline-none'

const LABEL_CLASS = 'block text-[11px] font-medium uppercase tracking-wide text-slate-500'

function Field({ label, value, onChange, type = 'text', placeholder, hint }) {
  return (
    <label className="block">
      <span className={LABEL_CLASS}>{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-1 ${FIELD_CLASS}`}
      />
      {hint ? <span className="mt-1 block text-[11px] text-slate-400">{hint}</span> : null}
    </label>
  )
}

export default function LogsPanel({ operation, title, subtitle, transport, disabled, onData }) {
  const [form, setForm] = useState({
    start_date: todayString(),
    end_date: todayString(),
    start_time: '00:00:00',
    end_time: '23:59:59',
    access_id: '',
  })

  const update = (key) => (value) => setForm((current) => ({ ...current, [key]: value }))

  const params = {
    start_date: form.start_date,
    end_date: form.end_date,
    start_time: form.start_time,
    end_time: form.end_time,
    ...(form.access_id.trim() ? { access_id: form.access_id.trim() } : {}),
  }

  return (
    <OperationPanel
      operation={operation}
      title={title}
      subtitle={subtitle}
      params={params}
      transport={transport}
      disabled={disabled}
      onData={onData}
    >
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Field label="start_date" value={form.start_date} onChange={update('start_date')} type="date" />
        <Field label="end_date" value={form.end_date} onChange={update('end_date')} type="date" />
        <Field label="start_time" value={form.start_time} onChange={update('start_time')} placeholder="00:00:00" />
        <Field label="end_time" value={form.end_time} onChange={update('end_time')} placeholder="23:59:59" />
        <Field
          label="access_id"
          value={form.access_id}
          onChange={update('access_id')}
          placeholder="blank = all devices"
          hint="Omitted from the request when blank."
        />
      </div>
    </OperationPanel>
  )
}
