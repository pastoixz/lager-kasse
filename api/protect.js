export const config = {
  runtime: 'edge', // wichtig für Edge Function
}

export default async function handler(req) {
  const username = 'janski' // <-- anpassen
  const password = 'bananski'     // <-- anpassen

  const auth = req.headers.get('authorization')

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
    return new Response('Welcome to the protected page!', {
      status: 200,
    })
  }

  return new Response('Access denied', { status: 403 })
}
