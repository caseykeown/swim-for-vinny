/**
 * cms-auth — Cloudflare Worker
 * GitHub OAuth proxy for Decap CMS.
 *
 * Uses redirect-to-hash flow: instead of postMessage (which breaks
 * across origins in some browsers), we redirect back to the admin
 * page with the token in the URL hash. The admin page reads it and
 * passes it to Decap CMS directly.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ── /auth ──────────────────────────────────────────────────
    if (url.pathname === '/auth') {
      const redirectTo = url.searchParams.get('site_id') ||
                         'https://isrwithdaphne.com/admin/';
      const params = new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID,
        scope: 'repo,user',
        redirect_uri: `${url.origin}/callback`,
        state: encodeURIComponent(redirectTo),
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
        return new Response('Missing code', { status: 400 });
      }

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
        return postMessageResponse('error', msg);
      }

      return postMessageResponse('success', JSON.stringify({
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

function postMessageResponse(status, content) {
  const message = `authorization:github:${status}:${content}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Authenticating...</title>
</head>
<body>
  <p>${status === 'success' ? 'Login successful, closing...' : 'Error: ' + content}</p>
  <script>
    (function() {
      var message = ${JSON.stringify(message)};

      function tryPostMessage() {
        if (window.opener && !window.opener.closed) {
          // Post to all possible admin origins
          var origins = [
            'https://isrwithdaphne.com',
            'https://www.isrwithdaphne.com',
            '*'
          ];
          origins.forEach(function(origin) {
            try { window.opener.postMessage(message, origin); } catch(e) {}
          });
          setTimeout(function() { window.close(); }, 800);
        } else {
          // window.opener not available — show manual instructions
          document.body.innerHTML =
            '<div style="font-family:sans-serif;padding:40px;text-align:center;">' +
            '<h2>Almost there!</h2>' +
            '<p>GitHub login was successful.</p>' +
            '<p><strong>Please close this window</strong>, then go back to the admin page and refresh it.</p>' +
            '<button onclick="window.close()" style="padding:12px 24px;font-size:16px;cursor:pointer;">Close Window</button>' +
            '</div>';
        }
      }

      // Try immediately, then retry a few times
      setTimeout(tryPostMessage, 300);
      setTimeout(tryPostMessage, 800);
      setTimeout(tryPostMessage, 1500);
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}
