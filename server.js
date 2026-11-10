require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@libsql/client');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const STAFF_DATABASE = {
  "Vortex": { name: "Xaii", role: "Executive Director" },
  "Aegis": { name: "Odh", role: "Community Director" },
  "Nova": { name: "Molly (Dir)", role: "Community Director" },
  "Titan": { name: "Seyp", role: "Lead Staff | Game Master" },
  "Phantom": { name: "Molly (Dev)", role: "Discord Developer" },
  "Blaze": { name: "Azulaè", role: "Senior Administrator" },
  "Cipher": { name: "Honeypot", role: "Senior Administrator" },
  "Zenith": { name: "JIN", role: "Senior Moderator" },
  "Eclipse": { name: "0 Day's", role: "Senior Moderator" },
  "Vanguard": { name: "Eli", role: "Moderator" },
  "Spectral": { name: "Ame", role: "Moderator" },
  "Onyx": { name: "Hxnzu", role: "Moderator" },
  "Rogue": { name: "Xav", role: "Moderator" },
  "Falcon": { name: "azr", role: "Moderator" },
  "Aurora": { name: "Madam Nikki", role: "Staff" }
  "Matrix": { name: "HolyM", role: "Web Developer" }
};

let db;
try {
  db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  console.log("Database connection initialized.");
} catch (error) {
  console.error("Failed to initialize database:", error);
}

app.get('/', (req, res) => res.status(200).send("Ros Reborn Backend is running perfectly."));

app.post('/api/apply', async (req, res) => {
  const data = req.body;
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  let attachmentUrl = "";
  const refId = "RR-" + Math.random().toString(36).substring(2, 7).toUpperCase();

  try {
    const discordPayload = {
      embeds: [{
        title: "New Creator Application",
        description: `A new creator has submitted an application.\n**Ref ID:** \`${refId}\``,
        color: 15944873,
        thumbnail: { url: "https://ros-reborn-1.onrender.com/assets/images/Reborn_Logo_3.png" },
        fields: [
          { name: "In-Game Name", value: `**${data.ign || "N/A"}**`, inline: true },
          { name: "Legal Name", value: `**${data.legal_name || "N/A"}**`, inline: true },
          { name: "Program Edition", value: `**${data.edition === 'streamer' ? 'Streamer' : 'Content Creator'}**`, inline: true },
          { name: "Discord Username", value: data.discord ? `\`${data.discord}\`` : "N/A", inline: true },
          { name: "Email", value: data.email || "N/A", inline: true },
          { name: "Platform", value: `**${data.platform || "N/A"}**`, inline: true },
          { name: "Followers", value: `**${Number(data.followers || 0).toLocaleString()}**`, inline: true },
          { name: "Avg Views", value: `**${Number(data.views || 0).toLocaleString()}**`, inline: true },
          { name: "Channel URL", value: data.channel ? `[Click here to view channel](${data.channel})` : "None", inline: true },
          { name: "Best Content Link", value: data.best_content ? `[Click here to view content](${data.best_content})` : "None", inline: false },
          { name: "Additional Notes", value: `>>> ${data.additional_notes || "None"}`, inline: false },
          { name: "Staff Action Required", value: `**[Click Here to Open Admin Dashboard](https://ros-reborn-1.onrender.com/staff-login-portal.html)**`, inline: false }
        ],
        footer: { text: "Ros Reborn V2 Creator Program • Pending Review" },
        timestamp: new Date().toISOString()
      }]
    };

    if (data.proof_file && data.proof_name) {
      try {
        const formData = new FormData();
        const isImage = data.proof_name.match(/\.(jpg|jpeg|png|webp|gif)$/i);
        const safeFileName = isImage ? "proof_image.png" : "proof_document.pdf";
        const mimeType = isImage ? "image/png" : "application/pdf";

        if (isImage) discordPayload.embeds[0].image = { url: `attachment://${safeFileName}` };

        formData.append("payload_json", JSON.stringify(discordPayload));
        const buffer = Buffer.from(data.proof_file, 'base64');
        const blob = new Blob([buffer], { type: mimeType });
        formData.append("files[0]", blob, safeFileName);
        
        const discordResponse = await fetch(webhookUrl + "?wait=true", { method: "POST", body: formData });
        if (discordResponse.ok) {
          const discordResult = await discordResponse.json();
          if (discordResult.attachments && discordResult.attachments.length > 0) {
            attachmentUrl = discordResult.attachments[0].url;
          } else if (discordResult.embeds && discordResult.embeds[0].image) {
            attachmentUrl = discordResult.embeds[0].image.url;
          }
        }
      } catch (err) {
        console.error("Discord upload error:", err);
      }
    } else {
      await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(discordPayload) });
    }

    await db.execute({
      sql: `INSERT INTO applications (ref_id, legal_name, edition, ign, discord, email, platform, channel, followers, views, best_content, additional_notes, proof_file, proof_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [refId, data.legal_name, data.edition, data.ign, data.discord, data.email, data.platform, data.channel, Number(data.followers), data.views ? Number(data.views) : null, data.best_content || null, data.additional_notes || null, data.proof_name || null, attachmentUrl || null]
    });

    res.status(200).json({ message: "Application submitted successfully!", refId: refId });
  } catch (error) {
    console.error("Submission Error:", error);
    res.status(500).json({ message: "Failed to submit application." });
  }
});

app.get('/api/admin', async (req, res) => {
  const { action, refId, status, note, staffName } = req.query;
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  const botToken = process.env.DISCORD_BOT_TOKEN;
  const guildId = process.env.DISCORD_GUILD_ID;

  try {
    if (action === 'getAll') {
      const result = await db.execute(`
        SELECT id, timestamp, ref_id as refId, legal_name, edition, ign, discord, email, platform, channel, followers, views, best_content as content, additional_notes as notes, proof_file as proof, proof_url as proofUrl, status, staff_notes as staffNotes 
        FROM applications ORDER BY id DESC
      `);
      return res.status(200).json({ status: 'success', data: result.rows });
    }

    if (action === 'update') {
      console.log(`\n--- 🚀 STARTING UPDATE ACTION for ${refId} to ${status} ---`);
      
      await db.execute({
        sql: "UPDATE applications SET status = ? WHERE ref_id = ?",
        args: [status, refId]
      });

      const appData = await db.execute({
        sql: "SELECT ign, discord, staff_notes FROM applications WHERE ref_id = ?",
        args: [refId]
      });
      const applicant = appData.rows[0];

      if (applicant && webhookUrl) {
        const isApproved = status === 'Approved';
        
        let receiptFields = [
          { name: "Reviewed By", value: `**${staffName || "Unknown Staff"}**`, inline: true }, 
          { name: "Ref ID", value: `\`${refId}\``, inline: true },
          { name: "Applicant", value: `**${applicant.ign}**`, inline: true },
          { name: "Action Taken", value: `**${status.toUpperCase()}**`, inline: false }
        ];

        if (applicant.staff_notes && applicant.staff_notes.trim() !== "") {
          receiptFields.push({ name: "Staff Note", value: `>>> ${applicant.staff_notes}`, inline: false });
        }

        const receiptPayload = {
          embeds: [{
            title: `Application ${status}`,
            description: `This is a system receipt confirming a staff action.`,
            color: isApproved ? 3066993 : 15158332,
            fields: receiptFields,
            footer: { text: "Ros Reborn Staff Accountability Log" },
            timestamp: new Date().toISOString()
          }]
        };
        
        await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(receiptPayload) });
        console.log("✅ Receipt sent to Webhook.");
      }

      if (applicant && applicant.discord && botToken) {
        let targetUserId = applicant.discord;

        if (isNaN(targetUserId)) {
          if (!guildId) {
            console.log(`❌ DM SKIPPED: DISCORD_GUILD_ID is missing.`);
            targetUserId = null;
          } else {
            console.log(`🔍 Resolving username "${targetUserId}" to User ID...`);
            const cleanUsername = targetUserId.replace('@', '');
            const searchUrl = `https://discord.com/api/v10/guilds/${guildId}/members/search?query=${encodeURIComponent(cleanUsername)}&limit=1`;
            
            const searchRes = await fetch(searchUrl, {
              headers: { 'Authorization': `Bot ${botToken}` }
            });

            if (searchRes.ok) {
              const searchData = await searchRes.json();
              if (searchData && searchData.length > 0) {
                targetUserId = searchData[0].user.id;
                console.log(`✅ Found User ID: ${targetUserId}`);
              } else {
                console.log(`❌ Could not find user "${cleanUsername}" in the Discord server.`);
                targetUserId = null;
              }
            } else {
              console.log(`❌ Error searching for user.`);
              targetUserId = null;
            }
          }
        }

        if (targetUserId) {
          console.log(`📡 Attempting to send DM to User ID: ${targetUserId}...`);
          try {
            const dmChannelReq = await fetch('https://discord.com/api/v10/users/@me/channels', {
              method: 'POST',
              headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ recipient_id: targetUserId })
            });

            if (dmChannelReq.ok) {
              const dmChannel = await dmChannelReq.json();
              const isApproved = status === 'Approved';
              
              const dmMessage = {
                embeds: [{
                  title: `Application ${status}`,
                  description: isApproved 
                    ? `Congratulations **${applicant.ign}**! Your application to the Ros Reborn Creator Program has been **APPROVED**.\n\nOur staff will reach out to you shortly on the server with your creator role and next steps.`
                    : `Hello **${applicant.ign}**, unfortunately your application to the Ros Reborn Creator Program has been **DECLINED** at this time.\n\nYou are welcome to apply again in the future as your channel grows.`,
                  color: isApproved ? 3066993 : 15158332,
                  fields: [{ name: "Ref ID", value: `\`${refId}\``, inline: true }],
                  footer: { text: "Ros Reborn V2 Creator Program" },
                  timestamp: new Date().toISOString()
                }]
              };

              const msgReq = await fetch(`https://discord.com/api/v10/channels/${dmChannel.id}/messages`, {
                method: 'POST',
                headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json' },
                body: JSON.stringify(dmMessage)
              });
              
              if (msgReq.ok) {
                  console.log(`✅ Discord DM successfully sent to ${applicant.ign}!`);
              } else {
                  console.log(`❌ Failed to send DM message.`);
              }
            }
          } catch (dmError) {
            console.error("❌ Error sending Discord DM:", dmError);
          }
        }
      }
      
      console.log(`--- 🏁 FINISHED UPDATE ACTION ---\n`);
      return res.status(200).json({ status: 'success' });
    }

    if (action === 'updateNote') {
      await db.execute({
        sql: "UPDATE applications SET staff_notes = ? WHERE ref_id = ?",
        args: [note, refId]
      });
      return res.status(200).json({ status: 'success' });
    }

    res.status(400).json({ message: "Invalid action" });
  } catch (error) {
    console.error("Admin API Error:", error);
    res.status(500).json({ message: "Failed to connect to database." });
  }
});

app.get('/api/status', async (req, res) => {
  const { query } = req.query;
  try {
    const result = await db.execute({
      sql: "SELECT ref_id, ign, status FROM applications WHERE UPPER(ref_id) = UPPER(?) OR LOWER(discord) = LOWER(?)",
      args: [query, query]
    });
    if (result.rows.length > 0) {
      return res.status(200).json({ status: 'success', refId: result.rows[0].ref_id, ign: result.rows[0].ign, result: result.rows[0].status });
    }
    res.status(200).json({ status: 'error', message: 'Application not found.' });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
});

app.post('/api/login', (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ success: false, message: "Code is required." });

  const inputCode = code.trim().toLowerCase();
  let staffData = null;

  for (const [key, data] of Object.entries(STAFF_DATABASE)) {
    if (key.toLowerCase() === inputCode) {
      staffData = data;
      break;
    }
  }

  if (staffData) {
    res.status(200).json({ success: true, staffName: staffData.name, staffRole: staffData.role });
  } else {
    res.status(401).json({ success: false, message: "Invalid staff code." });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});