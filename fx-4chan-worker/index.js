export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    const threadRegex = /^\/([^/]+)\/thread\/(\d+)(?:\/p(\d+))?$/;
    const match = path.match(threadRegex);

    if (!match) {
      if (path === "/") {
        return Response.redirect("https://boards.4chan.org/", 302);
      }
      return new Response("Not Found", { status: 404 });
    }

    const board = match[1];
    const id = match[2];
    const postId = match[3] ? match[3].replace(/^p/, "") : null; // always strip "p" if present

    const redirectUrl = postId
      ? `https://boards.4chan.org/${board}/thread/${id}#p${postId}`
      : `https://boards.4chan.org/${board}/thread/${id}`;

    const apiUrl = `https://a.4cdn.org/${board}/thread/${id}.json`;
    const apiRes = await fetch(apiUrl);
    if (!apiRes.ok) {
      return new Response(`Upstream error ${apiRes.status} fetching ${apiUrl}`, {
        status: apiRes.status,
      });
    }

    const data = await apiRes.json();
    let targetPost = data.posts[0];

    if (postId) {
      const found = data.posts.find((p) => p.no === parseInt(postId, 10));
      if (!found) {
        return new Response("Post not found", { status: 404 });
      }
      targetPost = found;
    }

    const imageUrl = targetPost.tim
      ? `https://i.4cdn.org/${board}/${targetPost.tim}${targetPost.ext}`
      : null;

    const title = postId
      ? `Post #${postId} in /${board.toUpperCase()}/ Thread #${id}`
      : targetPost.sub || `/${board.toUpperCase()}/ Thread #${id}`;

    const rawComment = targetPost.com || "";
    const commentWithBr = rawComment.replace(/<br\s*\/?>/gi, "\n");
    const description = escapeHtml(commentWithBr.replace(/<[^>]+>/g, ""));

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(title)}</title>
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${description}">
  ${imageUrl ? `<meta property="og:image" content="${imageUrl}">` : ""}
  <meta name="twitter:card" content="summary_large_image">
  ${imageUrl ? `<meta name="twitter:image" content="${imageUrl}">` : ""}
  <!-- Fallback redirect for humans -->
  <meta http-equiv="refresh" content="0; url=${redirectUrl}">
</head>
<body>
  <p>Redirecting to <a href="${redirectUrl}">${redirectUrl}</a>…</p>
</body>
</html>`;

    return new Response(html, {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  },
};

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}