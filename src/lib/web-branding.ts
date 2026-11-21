import { APP_NAME } from './branding'

export const WEB_APP_NAME = process.env.VERCEL_GIT_COMMIT_REF === 'beta'
  ? `${APP_NAME} بتا`
  : APP_NAME
