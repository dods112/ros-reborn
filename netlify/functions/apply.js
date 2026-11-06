// netlify/functions/apply.js

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  // Check if the webhook URL is configured in Netlify
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error("Missing DISCORD_WEBHOOK_URL environment variable.");
    return { statusCode: 500, body: "Server configuration error." };
  }

  try {
    // Parse the form data sent from the frontend
    const data = JSON.parse(event.body);

    // Build the improved Discord Embed
        // Build the clean, professional Discord Embed (No Emojis)
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
              // This invisible field forces the next items to start on a new line
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

    // Check if a file was uploaded
    if (data.proof_file && data.proof_name) {
      // Discord requires multipart/form-data for file uploads
      const formData = new FormData();
      
      // 1. Append the JSON payload
      formData.append("payload_json", JSON.stringify(discordPayload));
      
      // 2. Convert the Base64 string back to a Blob (Binary Data)
      const buffer = Buffer.from(data.proof_file, 'base64');
      const blob = new Blob([buffer]);
      
      // 3. Append the file to the form data
      formData.append("files[0]", blob, data.proof_name);

      // Send with multipart/form-data
      discordResponse = await fetch(webhookUrl, {
        method: "POST",
        body: formData,
      });

    } else {
      // No file, just send standard JSON
      discordResponse = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(discordPayload),
      });
    }

    // If Discord rejects it, log exactly why so we can see it in the terminal
    if (!discordResponse.ok) {
      const errorText = await discordResponse.text();
      console.error("Discord API Error:", errorText);
      throw new Error(`Discord API error: ${discordResponse.status}`);
    }

    // Return success to the frontend
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