import { APP_RELEASES,CURRENT_RELEASE } from '@/lib/app-releases'
export const dynamic = 'force-dynamic'

export function GET() {
  return Response.json({ version: process.env.NEXT_PUBLIC_APP_VERSION, release:CURRENT_RELEASE,releases:APP_RELEASES }, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}
