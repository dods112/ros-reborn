// netlify/functions/apply.js

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: JSON.stringify({ message: "Method Not Allowed" }) };
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  const googleSheetUrl = process.env.GOOGLE_SHEET_URL;

  if (!webhookUrl || !googleSheetUrl) {
    return { statusCode: 500, body: JSON.stringify({ message: "Server configuration error." }) };
  }

  try {
    const data = JSON.parse(event.body);

    // ==========================================
    // DEBUGGING: INSPECT RECEIVED DATA
    // ==========================================
    console.log("RECEIVED APPLICATION DATA:", {
      ign: data.ign,
      discord: data.discord,
      platform: data.platform,
      channel: data.channel,
      email: data.email,
      followers: data.followers,
      views: data.views
    });
    // ==========================================

    // Backend Payload Guard
    if (event.body && event.body.length > 4500000) {
      return { statusCode: 413, body: JSON.stringify({ message: "Payload too large. The maximum file size allowed is 3MB." }) };
    }

    let refId = null;
    let attachmentUrl = ""; 

    // 1. Send to Discord
    const discordPayload = {
      embeds: [
        {
          title: "New Creator Application",
          description: `A new creator has submitted an application.\n**Ref ID:** \`PENDING\``,
          color: 16015022,
          fields: [
            { name: "In-Game Name", value: `**${data.ign || "N/A"}**`, inline: true },
            { name: "Discord Username", value: data.discord ? `\`${data.discord}\`` : "N/A", inline: true },
            { name: "Email", value: data.email || "N/A", inline: true },
            { name: "Platform", value: `**${data.platform || "N/A"}**`, inline: true },
            { name: "Followers", value: `**${data.followers || "0"}**`, inline: true },
            { name: "Avg Views", value: `**${data.views || "0"}**`, inline: true },
            { name: "\u200b", value: "\u200b", inline: true },
            { name: "Channel URL", value: data.channel ? `[Click here to view channel](${data.channel})` : "None provided", inline: false },
            { name: "Best Content Link", value: data.best_content ? `[Click here to view content](${data.best_content})` : "None provided", inline: false },
            { name: "Additional Notes", value: `>>> ${data.additional_notes || "No additional notes provided."}`, inline: false }
          ],
          footer: { text: "Ros Reborn V2 Creator Program • Pending Review" },
          timestamp: new Date().toISOString()
        }
      ]
    };

    if (data.proof_file && data.proof_name) {
      const formData = new FormData();
      formData.append("payload_json", JSON.stringify(discordPayload));
      
      const buffer = Buffer.from(data.proof_file, 'base64');
      const blob = new Blob([buffer]);
      formData.append("files[0]", blob, data.proof_name);

      const discordResponse = await fetch(webhookUrl + "?wait=true", { method: "POST", body: formData });
      const discordResult = await discordResponse.json();
      if (discordResult.attachments && discordResult.attachments.length > 0) {
        attachmentUrl = discordResult.attachments[0].url;
      }
    } else {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(discordPayload),
      });
    }

    data.proof_url = attachmentUrl; 

    // 2. Send to Google Sheets (WITH STRICT ERROR HANDLING)
    try {
      const sheetResponse = await fetch(googleSheetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!sheetResponse.ok) {
        throw new Error(`HTTP Error: ${sheetResponse.status}`);
      }

      const sheetResult = await sheetResponse.json();
      
      if (sheetResult.status !== "success" || !sheetResult.refId) {
        throw new Error(sheetResult.message || "Google Sheet did not return a valid Reference ID.");
      }

      refId = sheetResult.refId;
    } catch (sheetError) {
      console.error("CRITICAL: Google Sheets failed to save the application.", sheetError);
      // Return a failure to the frontend so the applicant knows it didn't fully save
      return {
        statusCode: 500,
        body: JSON.stringify({ message: "Application could not be fully saved to our database. Please try again." })
      };
    }

    // 3. Return success only if BOTH Discord and Sheets succeeded
    return {
      statusCode: 200,
      body: JSON.stringify({ 
        message: "Application submitted successfully!", 
        refId: refId 
      }),
    };

  } catch (error) {
    console.error("Error processing application:", error);
    return { statusCode: 500, body: JSON.stringify({ message: "Failed to submit application." }) };
  }
};