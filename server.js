// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@libsql/client');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ==========================================
// 1. STAFF DATABASE
// ==========================================
const STAFF_DATABASE = {
  "DODS2026": "Dods",
  "HOLLY2026": "Holly",
  "XIA2026": "Maam Xia",
  "ADMIN123": "Admin"
};

// ==========================================
// 2. DATABASE SETUP
// ==========================================
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

// ==========================================
// 3. API ROUTES
// ==========================================
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
          { name: "Discord User ID", value: data.discord ? `\`${data.discord}\`` : "N/A", inline: true },
          { name: "Email", value: data.email || "N/A", inline: true },
          { name: "Platform", value: `**${data.platform || "N/A"}**`, inline: true },
          { name: "Followers", value: `**${Number(data.followers || 0).toLocaleString()}**`, inline: true },
          { name: "Avg Views", value: `**${Number(data.views || 0).toLocaleString()}**`, inline: true },
          { name: "Channel URL", value: data.channel ? `[Click here to view channel](${data.channel})` : "None", inline: false },
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
      sql: `INSERT INTO applications (ref_id, ign, discord, email, platform, channel, followers, views, best_content, additional_notes, proof_file, proof_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [refId, data.ign, data.discord, data.email, data.platform, data.channel, Number(data.followers), data.views ? Number(data.views) : null, data.best_content || null, data.additional_notes || null, data.proof_name || null, attachmentUrl || null]
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

  try {
    if (action === 'getAll') {
      const result = await db.execute(`
        SELECT id, timestamp, ref_id as refId, ign, discord, email, platform, channel, followers, views, best_content as content, additional_notes as notes, proof_file as proof, proof_url as proofUrl, status, staff_notes as staffNotes 
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
          content: `**STAFF RECEIPT**`,
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

      // 🌟 LOUD LOGGING FOR DM 🌟
      if (!applicant || !applicant.discord) {
        console.log(`❌ DM SKIPPED: Applicant doesn't have a Discord ID in the database.`);
      } else if (!botToken) {
        console.log(`❌ DM SKIPPED: DISCORD_BOT_TOKEN is missing in Render Environment Variables!`);
      } else {
        console.log(`📡 Attempting to send DM to User ID: ${applicant.discord}...`);
        try {
          const dmChannelReq = await fetch('https://discord.com/api/v10/users/@me/channels', {
            method: 'POST',
            headers: { 'Authorization': `Bot ${botToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ recipient_id: applicant.discord })
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
                console.log(`❌ Failed to send DM message. Error:`, await msgReq.text());
            }
          } else {
            console.log(`❌ Could not open DM channel. Error:`, await dmChannelReq.text());
            console.log(`💡 Make sure the user shares a server with the bot and has "Allow DMs from server members" ON.`);
          }
        } catch (dmError) {
          console.error("❌ Error sending Discord DM:", dmError);
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
  const staffName = STAFF_DATABASE[code.toUpperCase()];

  if (staffName) {
    res.status(200).json({ success: true, staffName: staffName });
  } else {
    res.status(401).json({ success: false, message: "Invalid staff code." });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});