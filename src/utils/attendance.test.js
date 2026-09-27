import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SHIFT_START,
  buildAttendanceRows,
  buildUserNameMap,
  collectDistinctDates,
  countRegisteredUsers,
  formatDuration,
  getRegistrationId,
  isLate,
  normalizeDateKey,
  pickDisplayName,
  summarize,
  toArray,
  toSeconds,
} from './attendance'

describe('getRegistrationId — misspelled key quirk', () => {
  it('reads the correct spelling used by fetch_log', () => {
    expect(getRegistrationId({ registration_id: 42, access_time: '09:00:00' })).toBe('42')
  })

  it('reads the misspelled registraton_id used by fetch_user_list / fetch_user_in_device_list', () => {
    expect(getRegistrationId({ registraton_id: 7, name: 'Asha' })).toBe('7')
  })

  it('prefers the correct spelling when both are present', () => {
    expect(getRegistrationId({ registration_id: 1, registraton_id: 2 })).toBe('1')
  })

  it('treats numeric ids as strings so joins match across responses', () => {
    expect(getRegistrationId({ registraton_id: 42 })).toBe(getRegistrationId({ registration_id: '42' }))
  })

  it('returns null when neither key is usable', () => {
    expect(getRegistrationId({ registraton_id: '', registration_id: null, name: 'x' })).toBeNull()
    expect(getRegistrationId({})).toBeNull()
    expect(getRegistrationId(null)).toBeNull()
    expect(getRegistrationId('not an object')).toBeNull()
  })
})

describe('toArray — fetch_device_detail object quirk', () => {
  it('converts an object keyed by numeric-looking strings into a list', () => {
    const payload = { 0: { device_name: 'Gate A' }, 1: { device_name: 'Gate B' }, 2: { device_name: 'Gate C' } }
    expect(toArray(payload)).toEqual([
      { device_name: 'Gate A' },
      { device_name: 'Gate B' },
      { device_name: 'Gate C' },
    ])
  })

  it('passes real arrays straight through', () => {
    const rows = [{ registraton_id: 1 }]
    expect(toArray(rows)).toBe(rows)
  })

  it('returns an empty list for the "Not Authorized" string and for nullish payloads', () => {
    expect(toArray('Not Authorized')).toEqual([])
    expect(toArray(null)).toEqual([])
    expect(toArray(undefined)).toEqual([])
    expect(toArray(0)).toEqual([])
  })
})

describe('toSeconds / normalizeDateKey', () => {
  it('parses the time formats Stellar is known to return', () => {
    expect(toSeconds('09:00:00')).toBe(32400)
    expect(toSeconds('09:00')).toBe(32400)
    expect(toSeconds('09:00:01')).toBe(32401)
    expect(toSeconds(' 23:59:59 ')).toBe(86399)
    expect(toSeconds('091233')).toBe(33153)
  })

  it('extracts the time portion out of a full datetime string', () => {
    expect(toSeconds('2026-09-26 09:12:33')).toBe(33153)
    expect(toSeconds('2026-09-26T09:12:33Z')).toBe(33153)
  })

  it('returns null for unparsable or out-of-range values instead of guessing', () => {
    expect(toSeconds('')).toBeNull()
    expect(toSeconds(null)).toBeNull()
    expect(toSeconds('not a time')).toBeNull()
    expect(toSeconds('25:00:00')).toBeNull()
    expect(toSeconds('09:99:00')).toBeNull()
  })

  it('normalises date values to YYYY-MM-DD', () => {
    expect(normalizeDateKey('2026-09-26')).toBe('2026-09-26')
    expect(normalizeDateKey('2026-09-26 00:00:00')).toBe('2026-09-26')
    expect(normalizeDateKey(new Date('2026-09-26T10:00:00Z'))).toBe('2026-09-26')
    expect(normalizeDateKey('26-09-2026')).toBeNull()
    expect(normalizeDateKey(undefined)).toBeNull()
  })
})

describe('name resolution', () => {
  it('prefers a known name field', () => {
    expect(pickDisplayName({ registraton_id: 1, name: 'Asha Rao' })).toBe('Asha Rao')
    expect(pickDisplayName({ registraton_id: 1, full_name: 'Asha Rao' })).toBe('Asha Rao')
  })

  it('falls back to the first non-id string field for unknown Stellar field names', () => {
    expect(pickDisplayName({ registraton_id: 1, teacher_display: 'Asha Rao' })).toBe('Asha Rao')
  })

  it('never returns an id field as a name', () => {
    expect(pickDisplayName({ registraton_id: 1, registration_id: 1, access_id: 9 })).toBeNull()
  })

  it('maps both spellings onto one lookup table', () => {
    const map = buildUserNameMap([
      { registraton_id: 1, name: 'Asha Rao' },
      { registration_id: '2', name: 'Vikram S' },
    ])
    expect(map.get('1').name).toBe('Asha Rao')
    expect(map.get('2').name).toBe('Vikram S')
  })

  it('counts distinct registered users across a device-detail style object', () => {
    expect(countRegisteredUsers({ 0: { registraton_id: 1 }, 1: { registraton_id: 2 } })).toBe(2)
  })
})

describe('buildAttendanceRows — grouping, In/Out times, working hours', () => {
  const logs = [
    { registration_id: 1, access_date: '2026-09-26', access_time: '09:12:00', department: 'Maths' },
    { registration_id: 1, access_date: '2026-09-26', access_time: '09:05:00' },
    { registration_id: 1, access_date: '2026-09-26', access_time: '16:40:00' },
    { registration_id: 1, access_date: '2026-09-25', access_time: '08:00:00' },
    { registration_id: 2, access_date: '2026-09-26', access_time: '10:00:00' },
  ]
  const users = [{ registraton_id: 1, name: 'Asha Rao' }, { registraton_id: 2, name: 'Vikram S' }]

  it('groups by registration_id + access_date and picks earliest In / latest Out', () => {
    const { rows } = buildAttendanceRows({ logs, users, date: '2026-09-26', shiftStart: DEFAULT_SHIFT_START })
    const asha = rows.find((row) => row.registrationId === '1')

    expect(asha.inTime).toBe('09:05:00')
    expect(asha.outTime).toBe('16:40:00')
    expect(asha.workingSeconds).toBe(7 * 3600 + 35 * 60)
    expect(asha.entryCount).toBe(3)
  })

  it('excludes other dates', () => {
    const { rows } = buildAttendanceRows({ logs, users, date: '2026-09-26' })
    expect(rows.every((row) => row.date === '2026-09-26')).toBe(true)
    expect(rows).toHaveLength(2)
  })

  it('joins display names through the misspelled user-list key', () => {
    const { rows } = buildAttendanceRows({ logs, users, date: '2026-09-26' })
    expect(rows.map((row) => row.teacherName)).toEqual(['Asha Rao', 'Vikram S'])
  })

  it('accepts a mis-spelled id inside log rows too', () => {
    const { rows } = buildAttendanceRows({
      logs: [{ registraton_id: 1, access_date: '2026-09-26', access_time: '09:00:00' }],
      users,
      date: '2026-09-26',
    })
    expect(rows).toHaveLength(1)
    expect(rows[0].teacherName).toBe('Asha Rao')
  })

  it('flags unresolved names instead of hiding the row', () => {
    const { rows } = buildAttendanceRows({
      logs: [{ registration_id: 99, access_date: '2026-09-26', access_time: '09:00:00' }],
      users,
      date: '2026-09-26',
    })
    expect(rows[0].teacherName).toBe('reg:99')
    expect(rows[0].nameResolved).toBe(false)
  })

  it('skips unusable rows and reports how many', () => {
    const { rows, skipped } = buildAttendanceRows({
      logs: [
        { registration_id: 1, access_date: '2026-09-26', access_time: '09:00:00' },
        { access_date: '2026-09-26', access_time: '09:00:00' },
        { registration_id: 2, access_date: '2026-09-26' },
        { registration_id: 3, access_time: '09:00:00' },
        { registration_id: 4, access_date: '2026-09-26', access_time: 'later' },
      ],
      users,
      date: '2026-09-26',
    })
    expect(rows).toHaveLength(1)
    expect(skipped).toBe(4)
  })

  it('reports a min/max span, so working hours are never negative', () => {
    const { rows } = buildAttendanceRows({
      logs: [
        { registration_id: 1, access_date: '2026-09-26', access_time: '22:00:00' },
        { registration_id: 1, access_date: '2026-09-26', access_time: '02:00:00' },
      ],
      users,
      date: '2026-09-26',
    })
    expect(rows[0].inTime).toBe('02:00:00')
    expect(rows[0].outTime).toBe('22:00:00')
    expect(rows[0].workingSeconds).toBe(20 * 3600)
  })

  it('treats a single log row as zero working hours', () => {
    const { rows } = buildAttendanceRows({
      logs: [{ registration_id: 1, access_date: '2026-09-26', access_time: '09:00:00' }],
      users,
      date: '2026-09-26',
    })
    expect(rows[0].inTime).toBe('09:00:00')
    expect(rows[0].outTime).toBe('09:00:00')
    expect(rows[0].workingSeconds).toBe(0)
  })
})

describe('Late calculation', () => {
  it('is Late only strictly after the shift start', () => {
    expect(isLate(32400, '09:00:00')).toBe(false)
    expect(isLate(32401, '09:00:00')).toBe(true)
  })

  it('honours a configurable shift start', () => {
    expect(isLate(32401, '09:30:00')).toBe(false)
    expect(isLate(32401, '09:00:00')).toBe(true)
  })

  it('accepts HH:MM shift starts and returns null when unparsable', () => {
    expect(isLate(32401, '09:00')).toBe(true)
    expect(isLate(32401, 'nonsense')).toBeNull()
    expect(isLate(null, '09:00:00')).toBeNull()
  })

  it('marks the row Present or Late in buildAttendanceRows', () => {
    const logs = [
      { registration_id: 1, access_date: '2026-09-26', access_time: '09:00:00' },
      { registration_id: 2, access_date: '2026-09-26', access_time: '09:00:01' },
      { registration_id: 3, access_date: '2026-09-26', access_time: '08:59:59' },
    ]
    const { rows } = buildAttendanceRows({ logs, users: null, date: '2026-09-26', shiftStart: '09:00:00' })
    const byId = Object.fromEntries(rows.map((row) => [row.registrationId, row.status]))
    expect(byId).toEqual({ 1: 'Present', 2: 'Late', 3: 'Present' })
  })
})

describe('summarize', () => {
  const logs = [
    { registration_id: 1, access_date: '2026-09-26', access_time: '09:30:00' },
    { registration_id: 1, access_date: '2026-09-26', access_time: '16:00:00' },
    { registration_id: 2, access_date: '2026-09-26', access_time: '08:00:00' },
  ]
  const users = [
    { registraton_id: 1, name: 'Asha Rao' },
    { registraton_id: 2, name: 'Vikram S' },
    { registraton_id: 3, name: 'Neha I' },
  ]

  it('counts distinct users present and late', () => {
    const result = summarize({ logs, users, date: '2026-09-26', shiftStart: '09:00:00' })
    expect(result.totalUsers).toBe(3)
    expect(result.present).toBe(2)
    expect(result.late).toBe(1)
  })

  it('never fabricates Absent or Leave', () => {
    const result = summarize({ logs, users, date: '2026-09-26' })
    expect(result.absent).toBeNull()
    expect(result.leave).toBeNull()
  })

  it('reports zero present when no logs loaded', () => {
    const result = summarize({ logs: null, users, date: '2026-09-26' })
    expect(result.present).toBe(0)
    expect(result.late).toBe(0)
    expect(result.totalUsers).toBe(3)
  })
})

describe('collectDistinctDates and formatDuration', () => {
  it('lists the dates present in a log payload', () => {
    const dates = collectDistinctDates([
      { registration_id: 1, access_date: '2026-09-26' },
      { registration_id: 1, access_date: '2026-09-25' },
      { registration_id: 2, access_date: '2026-09-26' },
    ])
    expect(dates).toEqual(['2026-09-25', '2026-09-26'])
  })

  it('formats working hours for the table', () => {
    expect(formatDuration(7 * 3600 + 35 * 60)).toBe('7h 35m')
    expect(formatDuration(8 * 3600)).toBe('8h 00m')
    expect(formatDuration(0)).toBe('0h 00m')
    expect(formatDuration(null)).toBe('—')
  })
})
