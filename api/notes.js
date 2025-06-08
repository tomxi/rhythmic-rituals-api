const { Client } = require("@notionhq/client");

// Replace with your GitHub username
const GITHUB_USERNAME = "tomxi"; // Placeholder
const ALLOWED_ORIGIN = `https://${GITHUB_USERNAME}.github.io`;

// Initialize Notion client
const notion = new Client({ auth: process.env.NOTION_KEY });
const databaseId = process.env.NOTION_DATABASE_ID;

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");

  // Handle OPTIONS request (preflight)
  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (!process.env.NOTION_KEY || !process.env.NOTION_DATABASE_ID) {
    console.error("Missing NOTION_KEY or NOTION_DATABASE_ID in environment variables");
    return res.status(500).json({ error: "Server configuration error." });
  }

  try {
    if (req.method === "GET") {
      if (!databaseId) {
        return res.status(500).json({ error: "Database ID is not configured." });
      }
      const response = await notion.databases.query({
        database_id: databaseId,
      });
      const notes = response.results.map((page) => {
        // Assuming your notes are stored in a Title property called 'Name'
        // and the content in a Rich Text property called 'Content'
        // Adjust property names if yours are different.
        let title = "Untitled";
        if (page.properties.Name && page.properties.Name.title && page.properties.Name.title.length > 0) {
          title = page.properties.Name.title[0].plain_text;
        }

        let content = "";
        // Attempt to get content from a property named 'Content' (Rich Text)
        if (page.properties.Content && page.properties.Content.rich_text && page.properties.Content.rich_text.length > 0) {
          content = page.properties.Content.rich_text[0].plain_text;
        }
        // Fallback or alternative: get content from a property named 'Text' (Rich Text)
        else if (page.properties.Text && page.properties.Text.rich_text && page.properties.Text.rich_text.length > 0) {
          content = page.properties.Text.rich_text[0].plain_text;
        }


        return {
          id: page.id,
          title: title,
          content: content, // You might need to process this further depending on your Notion setup
          last_edited_time: page.last_edited_time,
        };
      });
      return res.status(200).json(notes);
    } else if (req.method === "POST") {
      if (!databaseId) {
        return res.status(500).json({ error: "Database ID is not configured." });
      }
      const { title, content } = req.body;

      if (!title && !content) {
        return res.status(400).json({ error: "Request body must contain a title or content." });
      }

      // Construct the properties for the new page
      // This assumes you have 'Name' (Title type) and 'Content' (Rich Text type) properties in your Notion database
      const newPageProperties = {
        parent: { database_id: databaseId },
        properties: {},
      };

      if (title) {
        newPageProperties.properties.Name = { // 'Name' is the default Title property
          title: [
            {
              text: {
                content: title,
              },
            },
          ],
        };
      }

      // If there's no title but there is content, use the beginning of the content as the title.
      // Notion requires a title property.
      if (!title && content) {
          newPageProperties.properties.Name = {
              title: [
                  {
                      text: {
                          content: content.substring(0, 50) + (content.length > 50 ? "..." : ""), // Use first 50 chars of content as title
                      },
                  },
              ],
          };
      }

      if (content) {
        // Assuming 'Content' is a Rich Text property. Adjust if your property is named differently or is a different type.
        newPageProperties.properties.Content = {
          rich_text: [
            {
              text: {
                content: content,
              },
            },
          ],
        };
      }


      const response = await notion.pages.create(newPageProperties);
      return res.status(201).json({ message: "Note added successfully", id: response.id });
    } else {
      res.setHeader("Allow", ["GET", "POST", "OPTIONS"]);
      return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
    }
  } catch (error) {
    console.error("Error interacting with Notion API:", error);
    // Check if the error is from the Notion API client
    if (error.code) {
        return res.status(error.status || 500).json({ error: `Notion API Error: ${error.message} (Code: ${error.code})` });
    }
    return res.status(500).json({ error: "An unexpected error occurred." });
  }
};
