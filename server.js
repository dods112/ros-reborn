// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@libsql/client');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Database Setup
let db;
try {
  db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  console.log("✅ Database connection initialized.");
} catch (error) {
  console.error("❌ Failed to initialize database:", error);
}

// --- HEALTH CHECK ---
app.get('/', (req, res) => {
  res.status(200).send("Ros Reborn Backend is running perfectly.");
});

// --- SECURE ADMIN LOGIN ENDPOINT ---
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    return res.status(500).json({ message: "Server configuration error. ADMIN_PASSWORD missing." });
  }

  if (password === adminPassword) {
    res.status(200).json({ success: true });
  } else {
    res.status(401).json({ success: false, message: "Incorrect password." });
  }
});

// --- APPLY ENDPOINT ---
app.post('/api/apply', async (req, res) => {
  const data = req.body;
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  let attachmentUrl = "";
  const refId = "RR-" + Math.random().toString(36).substring(2, 7).toUpperCase();

  try {
    console.log("📥 Received application from:", data.ign);

    const discordPayload = {
      embeds: [{
        title: "New Creator Application",
        description: `A new creator has submitted an application.\n**Ref ID:** \`${refId}\``,
        color: 16015022,
        fields: [
          { name: "In-Game Name", value: `**${data.ign || "N/A"}**`, inline: true },
          { name: "Discord Username", value: data.discord ? `\`${data.discord}\`` : "N/A", inline: true },
          { name: "Email", value: data.email || "N/A", inline: true },
          { name: "Platform", value: `**${data.platform || "N/A"}**`, inline: true },
          { name: "Followers", value: `**${data.followers || "0"}**`, inline: true },
          { name: "Avg Views", value: `**${data.views || "0"}**`, inline: true },
          { name: "Channel URL", value: data.channel ? `[Click here to view channel](${data.channel})` : "None provided", inline: false },
          { name: "Additional Notes", value: `>>> ${data.additional_notes || "No additional notes provided."}`, inline: false }
        ],
        footer: { text: "Ros Reborn V2 Creator Program • Pending Review" },
        timestamp: new Date().toISOString()
      }]
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

    await db.execute({
      sql: `INSERT INTO applications (ref_id, ign, discord, email, platform, channel, followers, views, best_content, additional_notes, proof_file, proof_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [refId, data.ign, data.discord, data.email, data.platform, data.channel, Number(data.followers), data.views ? Number(data.views) : null, data.best_content || null, data.additional_notes || null, data.proof_name || null, attachmentUrl || null]
    });

    res.status(200).json({ message: "Application submitted successfully!", refId: refId });

  } catch (error) {
    console.error("❌ Submission Error:", error);
    res.status(500).json({ message: "Failed to submit application." });
  }
});

// --- ADMIN DASHBOARD ENDPOINT ---
app.get('/api/admin', async (req, res) => {
  const { action, refId, status } = req.query;

  try {
    if (action === 'getAll') {
      const result = await db.execute(`
        SELECT id, timestamp, ref_id as refId, ign, discord, email, platform, channel, followers, views, best_content as content, additional_notes as notes, proof_file as proof, proof_url as proofUrl, status 
        FROM applications ORDER BY id DESC
      `);
      return res.status(200).json({ status: 'success', data: result.rows });
    }

    if (action === 'update') {
      await db.execute({
        sql: "UPDATE applications SET status = ? WHERE ref_id = ?",
        args: [status, refId]
      });
      return res.status(200).json({ status: 'success' });
    }

    res.status(400).json({ message: "Invalid action" });
  } catch (error) {
    console.error("Admin API Error:", error);
    res.status(500).json({ message: "Failed to connect to database." });
  }
});

// --- APPLICANT STATUS ENDPOINT ---
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

// START SERVER
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});