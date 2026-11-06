// netlify/functions/apply.js

exports.handler = async (event, context) => {
  // 1. Only allow POST requests
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // 2. Check environment variables
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  const googleSheetUrl = process.env.GOOGLE_SHEET_URL;

  if (!webhookUrl) {
    console.error("Missing DISCORD_WEBHOOK_URL environment variable.");
    return { statusCode: 500, body: "Server configuration error." };
  }

  try {
    // 3. Parse the form data
    const data = JSON.parse(event.body);

    // 4. Send data to Google Sheets (Database Backup)
    if (googleSheetUrl) {
      try {
        await fetch(googleSheetUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      } catch (sheetError) {
        // We log the error, but we don't stop the Discord message if Sheets fails
        console.error("Google Sheets Error:", sheetError);
      }
    }

    // 5. Build the clean, professional Discord Embed (No Emojis)
    const discordPayload = {
      embeds: [
        {
          title: "New Creator Application",
          description: "A new creator has submitted an application for the Ros Reborn V2 Program.",
          color: 16015022, // The pink brand color
          fields: [
            { 
              name: "In-Game Name", 
              value: `**${data.ign || "N/A"}**`, 
              inline: true 
            },
            { 
              name: "Discord Username", 
              value: data.discord ? `\`${data.discord}\`` : "N/A", 
              inline: true 
            },
            { 
              name: "Platform", 
              value: `**${data.platform || "N/A"}**`, 
              inline: true 
            },
            { 
              name: "Followers", 
              value: `**${data.followers || "0"}**`, 
              inline: true 
            },
            { 
              name: "Avg Views", 
              value: `**${data.views || "0"}**`, 
              inline: true 
            },
            { 
              // Invisible field to force a line break in the grid
              name: "\u200b", 
              value: "\u200b", 
              inline: true 
            },
            { 
              name: "Channel URL", 
              value: data.channel ? `[Click here to view channel](${data.channel})` : "None provided", 
              inline: false 
            },
            { 
              name: "Best Content Link", 
              value: data.best_content ? `[Click here to view content](${data.best_content})` : "None provided", 
              inline: false 
            },
            { 
              name: "Additional Notes", 
              value: `>>> ${data.additional_notes || "No additional notes provided."}`, 
              inline: false 
            }
          ],
          footer: { 
            text: "Ros Reborn V2 Creator Program • Pending Review"
          },
          timestamp: new Date().toISOString()
        }
      ]
    };

    let discordResponse;

    // 6. Handle the Discord message (with or without a file)
    if (data.proof_file && data.proof_name) {
      // File was uploaded: Convert Base64 back to Blob and use FormData
      const formData = new FormData();
      
      formData.append("payload_json", JSON.stringify(discordPayload));
      
      const buffer = Buffer.from(data.proof_file, 'base64');
      const blob = new Blob([buffer]);
      
      formData.append("files[0]", blob, data.proof_name);

      discordResponse = await fetch(webhookUrl, {
        method: "POST",
        body: formData,
      });

    } else {
      // No file: Send standard JSON
      discordResponse = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(discordPayload),
      });
    }

    // 7. Check if Discord accepted the message
    if (!discordResponse.ok) {
      const errorText = await discordResponse.text();
      console.error("Discord API Error:", errorText);
      throw new Error(`Discord API error: ${discordResponse.status}`);
    }

    // 8. Return success to the frontend
    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Application submitted successfully!" }),
    };

  } catch (error) {
    console.error("Error processing application:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: "Failed to submit application." }),
    };
  }
};