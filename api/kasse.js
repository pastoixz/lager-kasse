export const config = { runtime: 'edge' }; // wichtig für Vercel Edge Function

export default async function handler(req) {
  const username = 'admin';    // <-- Passwort hier anpassen
  const password = '1234';     // <-- Passwort hier anpassen

  const auth = req.headers.get('authorization');

  if (!auth) {
    return new Response('Authentication required', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="Kasse"' },
    });
  }

  const [user, pass] = atob(auth.split(' ')[1]).split(':');

  if (user !== username || pass !== password) {
    return new Response('Access denied', { status: 403 });
  }

  // index.html laden
  const html = await fetch(new URL('../index.html', import.meta.url)).then(r => r.text());

  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}
