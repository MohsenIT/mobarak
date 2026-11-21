import { APP_RELEASES,CURRENT_RELEASE } from '@/lib/app-releases'
export const dynamic = 'force-dynamic'

export function GET() {
  const beta = process.env.VERCEL_GIT_COMMIT_REF === 'beta'
  const betaNote = process.env.VERCEL_GIT_COMMIT_MESSAGE?.match(/^Beta-Note: ([^\r\n]+)$/m)?.[1]
  const payload = beta ? { channel: 'beta', betaNote } : { release: CURRENT_RELEASE, releases: APP_RELEASES }
  return Response.json({ ...payload, version: process.env.NEXT_PUBLIC_APP_VERSION }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}
