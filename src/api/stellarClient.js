import axios from 'axios'

export const JSON_API_URL = 'https://rumytechnologies.com/rams/json_api'
export const GPS_API_URL = 'https://rumytechnologies.com/rams/service/get_gps_log'

export const AUTH_USER = import.meta.env.VITE_STELLAR_AUTH_USER || ''
export const AUTH_CODE = import.meta.env.VITE_STELLAR_AUTH_CODE || ''

export const TRANSPORTS = {
  json: {
    id: 'json',
    label: 'application/json',
    contentType: 'application/json',
    short: 'via application/json',
    note: 'Spec-compliant default.',
  },
  text: {
    id: 'text',
    label: 'text/plain workaround',
    contentType: 'text/plain;charset=UTF-8',
    short: 'via text/plain workaround',
    note:
      'Sends the identical JSON body with a text/plain Content-Type so the browser skips the CORS preflight. Local escape hatch only.',
  },
}

const RATE_LIMIT_HINT =
  'Stellar asks for at least 5 minutes between calls to the same account. Wait before retrying.'

const CORS_HINT =
  'The browser delivered no HTTP response to this page. Stellar’s preflight reply omits Access-Control-Allow-Methods and Access-Control-Allow-Headers, so a normal application/json POST is expected to fail here. Try the text/plain escape hatch to find out whether the API itself works.'

const AUTH_HINT =
  'The request reached the server but the credentials were rejected. Check VITE_STELLAR_AUTH_USER and VITE_STELLAR_AUTH_CODE in .env, then restart the dev server (Vite only reads .env on start).'

export function isConfigured() {
  return Boolean(String(AUTH_USER).trim() && String(AUTH_CODE).trim())
}

const httpClient = axios.create({ timeout: 30000 })

function endpointFor(operation) {
  return operation === 'fetch_gps_log' ? GPS_API_URL : JSON_API_URL
}

function isNotAuthorizedBody(data) {
  return typeof data === 'string' && /not\s+authorized/i.test(data)
}

function isWeb2pyErrorPage(data) {
  return typeof data === 'string' && /<h1>internal error|ticket issued/i.test(data)
}

function extractWeb2pyTicket(data) {
  if (typeof data !== 'string') return null
  const match = data.match(/\/admin\/default\/ticket\/rams\/[^\s"'<]+/)
  return match ? match[0] : null
}

function previewBody(data) {
  if (typeof data === 'string') return data.slice(0, 300)
  try {
    return JSON.stringify(data).slice(0, 300)
  } catch {
    return '(unserialisable body)'
  }
}

function serverErrorProblem(operation, status, data) {
  const hints = [
    'The web2py application behind rumytechnologies.com failed while handling this request — a server-side fault, not a CORS problem.',
  ]
  if (operation === 'fetch_gps_log') {
    hints.push(
      'Observed on this account: /rams/service/get_gps_log returns HTTP 500 for every HTTP method, so fetch_gps_log is unusable right now regardless of credentials or transport.',
    )
  }
  const ticket = extractWeb2pyTicket(data)
  if (ticket) hints.push(`Ticket: ${ticket}`)
  return { kind: 'server', status, message: `Stellar server error (HTTP ${status}).`, hint: hints.join(' ') }
}

function authProblem(status) {
  return { kind: 'auth', status, message: 'Stellar replied "Not Authorized".', hint: AUTH_HINT }
}

function inspectBody(operation, status, data) {
  if (isNotAuthorizedBody(data)) return authProblem(status)
  if (isWeb2pyErrorPage(data)) return serverErrorProblem(operation, status, data)
  if (operation === 'fetch_gps_log' && status >= 500) return serverErrorProblem(operation, status, data)
  return null
}

export function normalizeError(error, operation) {
  const response = error?.response

  if (!response) {
    return {
      kind: 'cors',
      status: null,
      message: 'Possibly blocked by CORS — Stellar may not allow direct browser calls.',
      hint: CORS_HINT,
    }
  }

  const { status, data } = response
  const bodyProblem = inspectBody(operation, status, data)
  if (bodyProblem) return bodyProblem

  if (status === 429) {
    return { kind: 'ratelimit', status, message: 'HTTP 429 — rate limited by Stellar.', hint: RATE_LIMIT_HINT }
  }

  return {
    kind: 'http',
    status,
    message: `Unexpected HTTP ${status} from Stellar.`,
    hint: `Response body: ${previewBody(data)}`,
  }
}

export async function postOperation(operation, params = {}, options = {}) {
  const transport = options.transport === 'text' ? 'text' : 'json'
  const body = { operation, ...params, auth_user: AUTH_USER, auth_code: AUTH_CODE }
  const startedAt = performance.now()

  const meta = {
    operation,
    transport,
    transportLabel: TRANSPORTS[transport].short,
    ms: 0,
    status: null,
  }

  try {
    const response = await httpClient.post(endpointFor(operation), JSON.stringify(body), {
      headers: { 'Content-Type': TRANSPORTS[transport].contentType },
      transformRequest: [(data) => data],
    })

    meta.ms = Math.round(performance.now() - startedAt)
    meta.status = response.status

    const problem = inspectBody(operation, response.status, response.data)
    if (problem) return { ok: false, data: null, error: problem, meta }

    return { ok: true, data: response.data, error: null, meta }
  } catch (error) {
    meta.ms = Math.round(performance.now() - startedAt)
    meta.status = error?.response?.status ?? null
    return { ok: false, data: null, error: normalizeError(error, operation), meta }
  }
}

export function fetchUserList(options) {
  return postOperation('fetch_user_list', {}, options)
}

export function fetchUserInDeviceList(options) {
  return postOperation('fetch_user_in_device_list', {}, options)
}

export function fetchDeviceDetail(options) {
  return postOperation('fetch_device_detail', {}, options)
}

export function fetchLog(params, options) {
  return postOperation('fetch_log', params, options)
}

export function fetchGpsLog(params, options) {
  return postOperation('fetch_gps_log', params, options)
}
