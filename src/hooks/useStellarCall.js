import { useCallback, useRef, useState } from 'react'
import { postOperation } from '../api/stellarClient'

const IDLE = { loading: false, data: null, error: null, meta: null }

export function useStellarCall(operation, { transport = 'json', onData } = {}) {
  const [state, setState] = useState(IDLE)
  const requestId = useRef(0)
  const onDataRef = useRef(onData)
  onDataRef.current = onData

  const run = useCallback(
    async (params = {}) => {
      const current = requestId.current + 1
      requestId.current = current
      setState({ loading: true, data: null, error: null, meta: null })

      const result = await postOperation(operation, params, { transport })
      if (requestId.current !== current) return result

      setState({
        loading: false,
        data: result.ok ? result.data : null,
        error: result.ok ? null : result.error,
        meta: result.meta,
      })
      if (result.ok) onDataRef.current?.(result.data, result.meta)
      return result
    },
    [operation, transport],
  )

  const reset = useCallback(() => {
    requestId.current += 1
    setState(IDLE)
  }, [])

  return { ...state, run, reset }
}


