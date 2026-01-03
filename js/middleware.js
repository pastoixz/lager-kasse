// middleware.js
import { NextResponse } from 'next/server'

export function middleware(req) {
  const url = req.nextUrl.clone()

  // Nur die Subdomain kasse.pastoi.xyz schützen
  if (url.hostname === 'kasse.pastoi.xyz') {
    const auth = req.headers.get('authorization')

    const username = 'janski' // <-- hier anpassen
    const password = 'bananski'     // <-- hier anpassen

    if (!auth) {
      return new Response('Authentication required', {
        status: 401,
        headers: {
          'WWW-Authenticate': 'Basic realm="Secure Area"',
        },
      })
    }

    const base64 = auth.split(' ')[1]
    const [user, pass] = atob(base64).split(':')

    if (user === username && pass === password) {
      return NextResponse.next()
    }

    return new Response('Access denied', { status: 403 })
  }

  // Alle anderen Subdomains / Pfade ungeschützt
  return NextResponse.next()
}

// Optional: Hier kannst du auch nur bestimmte Pfade schützen
export const config = {
  matcher: ['/'] // schützt alle Pfade auf kasse.pastoi.xyz
}
