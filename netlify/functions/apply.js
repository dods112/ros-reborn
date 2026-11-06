exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method Not Allowed" };

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) return { statusCode: 500, body: "Server configuration error." };

  try {
    const data = JSON.parse(event.body);

    const discordPayload = {
      embeds: [
        {
          title: "🎮 New Creator Application",
          color: 16015022,
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
          footer: { text: "Ros Reborn V2 Creator Program" },
          timestamp: new Date().toISOString()
        }
      ]
    };

    let discordResponse;

    if (data.proof_file && data.proof_name) {
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
      discordResponse = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(discordPayload),
      });
    }

    if (!discordResponse.ok) {
      const errorText = await discordResponse.text();
      console.error("Discord API Error:", errorText);
      throw new Error(`Discord API error: ${discordResponse.status}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: "Application submitted successfully!" }),
    };
  } catch (error) {
    console.error("Error processing application:", error);
    return { statusCode: 500, body: JSON.stringify({ message: "Failed to submit application." }) };
  }
};