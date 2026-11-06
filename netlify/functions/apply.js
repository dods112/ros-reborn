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

    // Build a beautiful Discord Embed
    const discordPayload = {
      embeds: [
        {
          title: "🎮 New Creator Application",
          color: 16015022, // The accent pink color (#f45cae) in decimal
          fields: [
            { name: "In-Game Name", value: data.ign || "N/A", inline: true },
            { name: "Discord Username", value: data.discord || "N/A", inline: true },
            { name: "Platform", value: data.platform || "N/A", inline: true },
            { name: "Channel URL", value: data.channel || "N/A" },
            { name: "Followers", value: data.followers || "N/A", inline: true },
            { name: "Avg. Views", value: data.views || "N/A", inline: true },
            { name: "Best Content Link", value: data.best_content || "N/A" },
            { name: "Additional Notes", value: data.additional_notes || "None" }
          ],
          footer: {
            text: "Ros Reborn V2 Creator Program"
          },
          timestamp: new Date().toISOString()
        }
      ]
    };

    // Send the data to Discord
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(discordPayload),
    });

    if (!response.ok) {
      throw new Error(`Discord API error: ${response.status}`);
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