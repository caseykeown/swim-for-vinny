/**
 * cms-auth — Cloudflare Worker
 * GitHub OAuth proxy for Decap CMS.
 * Uses the standard popup/postMessage flow that Decap expects.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS headers for all responses
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // ── /auth ──────────────────────────────────────────────────
    if (url.pathname === '/auth') {
      const params = new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID,
        scope: 'repo,user',
        redirect_uri: `${url.origin}/callback`,
        state: Math.random().toString(36).substring(7),
      });
      return Response.redirect(
        `https://github.com/login/oauth/authorize?${params}`,
        302
      );
    }

    // ── /callback ──────────────────────────────────────────────
    if (url.pathname === '/callback') {
      const code = url.searchParams.get('code');

      if (!code) {
        return new Response('Missing code parameter', { status: 400 });
      }

      // Exchange code for token
      const tokenRes = await fetch(
        'https://github.com/login/oauth/access_token',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            client_id: env.GITHUB_CLIENT_ID,
            client_secret: env.GITHUB_CLIENT_SECRET,
            code,
            redirect_uri: `${url.origin}/callback`,
          }),
        }
      );

      const data = await tokenRes.json();

      if (data.error || !data.access_token) {
        const msg = data.error_description || data.error || 'Unknown error';
        return sendMessage('error', msg);
      }

      return sendMessage('success', JSON.stringify({
        token: data.access_token,
        provider: 'github',
      }));
    }

    // ── health check ───────────────────────────────────────────
    if (url.pathname === '/') {
      return new Response('cms-auth worker is running 👋', { status: 200 });
    }

    return new Response('Not found', { status: 404 });
  },
};

/**
 * Sends a postMessage to the Decap CMS opener window.
 * Decap listens for: "authorization:github:success:{...}"
 */
function sendMessage(status, content) {
  const message = status === 'success'
    ? `authorization:github:success:${content}`
    : `authorization:github:error:${content}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${status === 'success' ? 'Authenticated' : 'Auth Error'}</title>
</head>
<body>
  <p>${status === 'success' ? 'Login successful, closing...' : 'Error: ' + content}</p>
  <script>
    (function() {
      var message = ${JSON.stringify(message)};
      var targetOrigin = '*';

      function send() {
        if (window.opener && !window.opener.closed) {
          window.opener.postMessage(message, targetOrigin);
          setTimeout(function() { window.close(); }, 500);
        } else {
          // No opener found - show manual close message
          document.body.innerHTML = '<p>Authentication complete. Please close this window and refresh the admin page.</p>';
        }
      }

      // Wait briefly for the opener to be ready
      if (document.readyState === 'complete') {
        setTimeout(send, 300);
      } else {
        window.addEventListener('load', function() {
          setTimeout(send, 300);
        });
      }
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}