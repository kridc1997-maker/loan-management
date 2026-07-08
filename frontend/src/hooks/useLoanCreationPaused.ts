import { useState, useEffect } from 'react'
import api from '../api/client'

export function useLoanCreationPaused(): boolean {
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    api.get('/settings/loan-creation-paused')
      .then((res) => setPaused(!!res.data.data?.paused))
      .catch(() => {})
  }, [])

  return paused
}
