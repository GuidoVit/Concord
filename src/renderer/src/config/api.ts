const PRODUCTION_API =
  'https://concord-production-ec89.up.railway.app'

export const API =
  import.meta.env.DEV
    ? 'http://127.0.0.1:3333'
    : PRODUCTION_API
