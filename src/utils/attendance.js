export const DEFAULT_SHIFT_START = '09:00:00'

export const REGISTRATION_ID_KEYS = ['registration_id', 'registraton_id']

export const NAME_KEYS = ['name', 'full_name', 'user_name', 'username', 'employee_name', 'first_name']

export const DATE_KEYS = ['access_date', 'attendance_date', 'log_date', 'date']

export const TIME_KEYS = ['access_time', 'in_time', 'time']

const ID_FIELDS = new Set([...REGISTRATION_ID_KEYS, 'access_id', 'id', 'user_id', 'device_id'])

function firstFilledValue(row, keys) {
  for (const key of keys) {
    const value = row?.[key]
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return String(value).trim()
    }
  }
  return null
}

export function getRegistrationId(row) {
  return firstFilledValue(row, REGISTRATION_ID_KEYS)
}

export function getRowDate(row) {
  return normalizeDateKey(firstFilledValue(row, DATE_KEYS))
}

export function getRowTime(row) {
  return firstFilledValue(row, TIME_KEYS)
}

export function toArray(payload) {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === 'object') return Object.values(payload)
  return []
}

export function pickDisplayName(row) {
  const known = firstFilledValue(row, NAME_KEYS)
  if (known) return known

  if (row && typeof row === 'object') {
    for (const [key, value] of Object.entries(row)) {
      if (ID_FIELDS.has(key)) continue
      if (typeof value === 'string' && value.trim() !== '') return value.trim()
    }
  }
  return null
}

export function buildUserNameMap(users) {
  const map = new Map()
  for (const row of toArray(users)) {
    const id = getRegistrationId(row)
    if (id) map.set(id, { name: pickDisplayName(row) || `reg:${id}`, matched: Boolean(pickDisplayName(row)) })
  }
  return map
}

export function countRegisteredUsers(users) {
  return buildUserNameMap(users).size
}

export function normalizeDateKey(value) {
  if (!value) return null
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10)
  }
  const text = String(value).trim()
  const match = text.match(/^(\d{4}-\d{2}-\d{2})/)
  return match ? match[1] : null
}

export function toSeconds(value) {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  if (!text) return null

  const colonMatch = text.match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/)
  if (colonMatch) {
    const hours = Number(colonMatch[1])
    const minutes = Number(colonMatch[2])
    const seconds = Number(colonMatch[3] || 0)
    if (hours > 23 || minutes > 59 || seconds > 59) return null
    return hours * 3600 + minutes * 60 + seconds
  }

  const compactMatch = text.match(/^(\d{2})(\d{2})(\d{2})$/)
  if (compactMatch) {
    const hours = Number(compactMatch[1])
    const minutes = Number(compactMatch[2])
    const seconds = Number(compactMatch[3])
    if (hours > 23 || minutes > 59 || seconds > 59) return null
    return hours * 3600 + minutes * 60 + seconds
  }

  return null
}

function pad(value) {
  return String(value).padStart(2, '0')
}

export function formatClock(totalSeconds) {
  if (totalSeconds === null || totalSeconds === undefined || !Number.isFinite(totalSeconds)) return '—'
  const rounded = Math.round(totalSeconds)
  const sign = rounded < 0 ? '-' : ''
  const absolute = Math.abs(rounded)
  return `${sign}${pad(Math.floor(absolute / 3600))}:${pad(Math.floor((absolute % 3600) / 60))}:${pad(absolute % 60)}`
}

export function formatDuration(totalSeconds) {
  if (totalSeconds === null || totalSeconds === undefined || !Number.isFinite(totalSeconds)) return '—'
  const rounded = Math.max(0, Math.round(totalSeconds))
  const hours = Math.floor(rounded / 3600)
  const minutes = Math.round((rounded % 3600) / 60)
  return minutes ? `${hours}h ${minutes}m` : `${hours}h 00m`
}

export function isLate(inSeconds, shiftStart = DEFAULT_SHIFT_START) {
  const shiftSeconds = toSeconds(shiftStart)
  if (inSeconds === null || shiftSeconds === null) return null
  return inSeconds > shiftSeconds
}

export function collectDistinctDates(logs) {
  const dates = new Set()
  for (const row of toArray(logs)) {
    const date = getRowDate(row)
    if (date) dates.add(date)
  }
  return [...dates].sort()
}

export function buildAttendanceRows({ logs, users, date, shiftStart = DEFAULT_SHIFT_START } = {}) {
  const target = normalizeDateKey(date)
  const nameMap = buildUserNameMap(users)
  const groups = new Map()
  let skipped = 0

  for (const row of toArray(logs)) {
    const registrationId = getRegistrationId(row)
    const rowDate = getRowDate(row)
    const seconds = toSeconds(getRowTime(row))

    if (!registrationId || !rowDate || seconds === null) {
      skipped += 1
      continue
    }
    if (target && rowDate !== target) continue

    const key = `${registrationId}|${rowDate}`
    const existing = groups.get(key)
    if (existing) {
      existing.inSeconds = Math.min(existing.inSeconds, seconds)
      existing.outSeconds = Math.max(existing.outSeconds, seconds)
      existing.entryCount += 1
    } else {
      groups.set(key, {
        registrationId,
        date: rowDate,
        inSeconds: seconds,
        outSeconds: seconds,
        entryCount: 1,
      })
    }
  }

  const rows = [...groups.values()].map((group) => {
    const identity = nameMap.get(group.registrationId)
    const late = isLate(group.inSeconds, shiftStart)
    return {
      registrationId: group.registrationId,
      teacherName: identity ? identity.name : `reg:${group.registrationId}`,
      nameResolved: Boolean(identity?.matched),
      date: group.date,
      inTime: formatClock(group.inSeconds),
      outTime: formatClock(group.outSeconds),
      inSeconds: group.inSeconds,
      outSeconds: group.outSeconds,
      workingSeconds: Math.max(0, group.outSeconds - group.inSeconds),
      entryCount: group.entryCount,
      status: late === null ? 'Unknown' : late ? 'Late' : 'Present',
    }
  })

  rows.sort((a, b) => a.teacherName.localeCompare(b.teacherName) || a.registrationId.localeCompare(b.registrationId))

  return { rows, skipped }
}

export function summarize({ logs, users, date, shiftStart = DEFAULT_SHIFT_START } = {}) {
  const { rows, skipped } = buildAttendanceRows({ logs, users, date, shiftStart })
  return {
    totalUsers: countRegisteredUsers(users),
    present: rows.length,
    late: rows.filter((row) => row.status === 'Late').length,
    absent: null,
    leave: null,
    unresolvedNames: rows.filter((row) => !row.nameResolved).length,
    skippedLogRows: skipped,
  }
}
