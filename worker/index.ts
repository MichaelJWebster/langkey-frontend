// Cloudflare Worker: serves the SPA's static assets and routes /api/* to the
// FastAPI backend running in a Cloudflare Container (same origin, no CORS).
import { Container, getContainer } from '@cloudflare/containers'
import { env } from 'cloudflare:workers'

type WorkerEnv = {
  ASSETS: Fetcher
  BACKEND: DurableObjectNamespace
  LANGKEY_JWT_SECRET: string
  LANGKEY_ADMIN_EMAIL: string
  LANGKEY_ADMIN_PASSWORD: string
  LANGKEY_DATABASE_URL: string
  LANGKEY_S3_ENDPOINT_URL?: string
  LANGKEY_S3_ACCESS_KEY?: string
  LANGKEY_S3_SECRET_KEY?: string
}

const e = env as unknown as WorkerEnv

export class Backend extends Container {
  defaultPort = 8000
  sleepAfter = '15m' // scale to zero when idle; cold boot re-runs migrations/seed
  envVars = {
    LANGKEY_ENVIRONMENT: 'prod',
    LANGKEY_JWT_SECRET: e.LANGKEY_JWT_SECRET,
    LANGKEY_ADMIN_EMAIL: e.LANGKEY_ADMIN_EMAIL,
    LANGKEY_ADMIN_PASSWORD: e.LANGKEY_ADMIN_PASSWORD,
    LANGKEY_DATABASE_URL: e.LANGKEY_DATABASE_URL,
    LANGKEY_S3_ENDPOINT_URL: e.LANGKEY_S3_ENDPOINT_URL ?? '',
    LANGKEY_S3_ACCESS_KEY: e.LANGKEY_S3_ACCESS_KEY ?? '',
    LANGKEY_S3_SECRET_KEY: e.LANGKEY_S3_SECRET_KEY ?? '',
    LANGKEY_CORS_ORIGINS: '["https://langkey.langkey-frontend.workers.dev"]',
  }
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) {
      return getContainer(env.BACKEND).fetch(request)
    }
    return env.ASSETS.fetch(request)
  },
}
