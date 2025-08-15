import express from "express";
import fetch from "node-fetch";
import sanitizeHtml from "sanitize-html";

const app = express();

app.get("/", (req, res) => {
  res.redirect("https://boards.4chan.org/");
});

app.get("/:board/thread/:id", async (req, res) => {
    const { board, id } = req.params;
    const userAgent = req.get('User-Agent') || '';

    // Check if it's a bot/crawler (for embeds)
    const isBotRequest = /bot|crawler|spider|facebook|twitter|discord|slack/i.test(userAgent);

    if (!isBotRequest) {
        // Redirect real users to actual 4chan thread
        return res.redirect(`https://boards.4chan.org/${board}/thread/${id}`);
    }

    const apiUrl = `https://a.4cdn.org/${board}/thread/${id}.json`;

    try {
        const response = await fetch(apiUrl);
        if (!response.ok) return res.status(404).send("Thread not found");

        const data = await response.json();
        const op = data.posts[0];

        const imageUrl = op.tim
            ? `https://i.4cdn.org/${board}/${op.tim}${op.ext}`
            : null;

        const title = op.sub || `${board.toUpperCase()} Thread #${id}`;
        const description = sanitizeHtml(op.com || "", { allowedTags: [], allowedAttributes: {} })
            .slice(0, 200);

        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="utf-8">
                <title>${title}</title>
                <meta property="og:title" content="${title}">
                <meta property="og:description" content="${description}">
                ${imageUrl ? `<meta property="og:image" content="${imageUrl}">` : ""}
                <meta name="twitter:card" content="summary_large_image">
                ${imageUrl ? `<meta name="twitter:image" content="${imageUrl}">` : ""}
            </head>
            </html>
        `);
    } catch (err) {
        console.error(err);
        res.status(500).send("Error fetching thread");
    }
});

app.listen(3000, () => console.log("Server running on port 3000"));
