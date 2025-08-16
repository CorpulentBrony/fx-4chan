export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const userAgent = request.headers.get("User-Agent") || "";

      // Root path => redirect to 4chan
      if (url.pathname === "/") {
        return Response.redirect("https://boards.4chan.org/", 302);
      }

      // Match routes: /:board/thread/:id and /:board/thread/:id/p:postId
      const threadRegex = /^\/([^/]+)\/thread\/(\d+)(?:\/p(\d+))?$/;
      const match = url.pathname.match(threadRegex);

      if (!match) {
        return new Response("Not Found", { status: 404 });
      }

      const board = match[1];
      const id = match[2];
      const postId = match[3] || null;

      // Check if it's a bot/crawler (for embeds)
      const isBotRequest = /bot|crawler|spider|facebook|twitter|discord|slack/i.test(userAgent);

      const redirectUrl = postId
        ? `https://boards.4chan.org/${board}/thread/${id}#p${postId}`
        : `https://boards.4chan.org/${board}/thread/${id}`;

      if (!isBotRequest) {
        // Redirect real users to actual 4chan thread
        return Response.redirect(redirectUrl, 302);
      }

      // Otherwise fetch API data for bots
      const apiUrl = `https://a.4cdn.org/${board}/thread/${id}.json`;
      const apiRes = await fetch(apiUrl);
      if (!apiRes.ok) {
        return new Response("Thread not found", { status: 404 });
      }

      const data = await apiRes.json();

      let targetPost = data.posts[0]; // Default to OP
      if (postId) {
        const foundPost = data.posts.find((post) => post.no === parseInt(postId));
        if (!foundPost) return new Response("Post not found", { status: 404 });
        targetPost = foundPost;
      }

      const imageUrl = targetPost.tim
        ? `https://i.4cdn.org/${board}/${targetPost.tim}${targetPost.ext}`
        : null;

      const title = postId
        ? `Post #${postId} in /${board.toUpperCase()}/ Thread #${id}`
        : targetPost.sub || `/${board.toUpperCase()}/ Thread #${id}`;

      // Handle comment sanitization
      const rawComment = targetPost.com || "";
      const commentWithLineBreaks = rawComment.replace(/<br\s*\/?>/gi, "\n");
      const description = commentWithLineBreaks.replace(/<[^>]+>/g, ""); // strip tags

      const html = `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="utf-8">
            <title>${title}</title>
            <meta property="og:title" content="${escapeHtml(title)}">
            <meta property="og:description" content="${escapeHtml(description)}">
            ${imageUrl ? `<meta property="og:image" content="${imageUrl}">` : ""}
            <meta name="twitter:card" content="summary_large_image">
            ${imageUrl ? `<meta name="twitter:image" content="${imageUrl}">` : ""}
        </head>
        </html>`;

      return new Response(html, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    } catch (err) {
      return new Response("Internal Error: " + err.message, { status: 500 });
    }
  },
};

// Basic HTML escaping helper
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
