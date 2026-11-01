// Browser navigation moves to the new brand domain. Existing API/webhook clients
// keep their original origin and HTTP method while integrations are updated.
export default function canonicalDomain(request) {
  const url = new URL(request.url);
  if (!['GET', 'HEAD'].includes(request.method)) return;
  if (!['noortoona.com', 'www.noortoona.com'].includes(url.hostname)) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/')) return;
  url.protocol = 'https:';
  url.hostname = 'halainvites.com';
  url.port = '';
  return Response.redirect(url, 301);
}

// Only human-facing routes: no asset, API or webhook invocation overhead.
export const config = {
  path: ['/', '/index.html', '/i/*', '/guest.html', '/dashboard', '/dashboard.html',
    '/admin', '/admin.html', '/customer', '/customer.html', '/partner', '/partner.html',
    '/supervisor', '/supervisor.html'],
};
