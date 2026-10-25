import {NextRequest,NextResponse} from 'next/server'
/** Country hint supplied by our hosting edge; never store or expose the user's IP. */
export function GET(request:NextRequest){
 const raw=process.env.VERCEL==='1'?request.headers.get('x-vercel-ip-country'):null
 const country=raw&&/^[A-Z]{2}$/.test(raw)?raw:null
 return NextResponse.json({country},{headers:{'Cache-Control':'private, no-store','Vary':'x-vercel-ip-country'}})
}
