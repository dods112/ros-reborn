// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@libsql/client');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// ==========================================
// 1. ENVIRONMENT & DATABASE SETUP
// ==========================================
if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) {
  console.error("ERROR: Missing Turso database credentials.");
  process.exit(1);
}

let db;
try {
  db = createClient({
    url: process.env.TURSO_DATABASE_URL,
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  console.log("Database connection initialized.");
} catch (error) {
  console.error("Failed to initialize database:", error);
  process.exit(1);
}

// ==========================================
// 2. API ROUTES
// ==========================================

app.get('/', (req, res) => res.status(200).send("Ros Reborn Backend is running perfectly."));

// --- APPLY ENDPOINT ---
app.post('/api/apply', async (req, res) => {
  const data = req.body;
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  let attachmentUrl = "";
  const refId = "RR-" + Math.random().toString(36).substring(2, 7).toUpperCase();

  try {
    console.log("Received application from:", data.ign);

    const discordPayload = {
      embeds: [{
        title: "New Creator Application",
        description: `A new creator has submitted an application.\n**Ref ID:** \`${refId}\``,
        color: 15944873, // Ros Reborn Pink
        thumbnail: { url: "https://ros-reborn-1.onrender.com/assets/images/Reborn_Logo_3.png" },
        fields: [
          { name: "In-Game Name", value: `**${data.ign || "N/A"}**`, inline: true },
          { name: "Discord Username", value: data.discord ? `\`${data.discord}\`` : "N/A", inline: true },
          { name: "Email", value: data.email || "N/A", inline: true },
          { name: "Platform", value: `**${data.platform || "N/A"}**`, inline: true },
          { name: "Followers", value: `**${Number(data.followers || 0).toLocaleString()}**`, inline: true },
          { name: "Avg Views", value: `**${Number(data.views || 0).toLocaleString()}**`, inline: true },
          { name: "Channel URL", value: data.channel ? `[Click here to view channel](${data.channel})` : "None provided", inline: false },
          { name: "Best Content Link", value: data.best_content ? `[Click here to view content](${data.best_content})` : "None provided", inline: false },
          // NEW FIELD: STAFF REVIEW LINK
          { name: "Staff Review Portal", value: `[Click here to open the Admin Dashboard](https://ros-reborn-1.onrender.com/staff-login-portal.html)`, inline: false },
          { name: "Additional Notes", value: `>>> ${data.additional_notes || "No additional notes provided."}`, inline: false }
        ],
        footer: { text: "Ros Reborn V2 Creator Program • Pending Review" },
        timestamp: new Date().toISOString()
      }]
    };

    // Handle File Upload Properly
    if (data.proof_file && data.proof_name) {
      const formData = new FormData();
      
      const ext = data.proof_name.split('.').pop().toLowerCase();
      const safeFileName = `proof_${refId}.${ext}`;
      const isImage = ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext);
      
      if (isImage) {
        discordPayload.embeds[0].image = { url: `attachment://${safeFileName}` };
      }

      formData.append("payload_json", JSON.stringify(discordPayload));
      
      const buffer = Buffer.from(data.proof_file, 'base64');
      const mimeType = isImage ? `image/${ext === 'jpg' ? 'jpeg' : ext}` : 'application/pdf';
      const blob = new Blob([buffer], { type: mimeType });
      
      formData.append("files[0]", blob, safeFileName);
      
      const discordResponse = await fetch(webhookUrl + "?wait=true", { method: "POST", body: formData });
      const discordResult = await discordResponse.json();
      
      if (discordResult.attachments && discordResult.attachments.length > 0) {
        attachmentUrl = discordResult.attachments[0].url;
        
        // If it was a PDF, we send a follow-up message with the link
        if (!isImage) {
          await fetch(webhookUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              content: `**View Proof of Ownership (PDF):** [Click Here](${attachmentUrl})`
            })
          });
        }
      }
    } else {
      await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(discordPayload),
      });
    }

    console.log("Discord notification sent.");

    await db.execute({
      sql: `INSERT INTO applications (ref_id, ign, discord, email, platform, channel, followers, views, best_content, additional_notes, proof_file, proof_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [refId, data.ign, data.discord, data.email, data.platform, data.channel, Number(data.followers), data.views ? Number(data.views) : null, data.best_content || null, data.additional_notes || null, data.proof_name || null, attachmentUrl || null]
    });

    console.log("Saved to Turso Database.");
    res.status(200).json({ message: "Application submitted successfully!", refId: refId });

  } catch (error) {
    console.error("Submission Error:", error);
    res.status(500).json({ message: "Failed to submit application." });
  }
});

// --- ADMIN DASHBOARD ENDPOINT ---
app.get('/api/admin', async (req, res) => {
  const { action, refId, status, note } = req.query;
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  try {
    if (action === 'getAll') {
      const result = await db.execute(`
        SELECT id, timestamp, ref_id as refId, ign, discord, email, platform, channel, followers, views, best_content as content, additional_notes as notes, proof_file as proof, proof_url as proofUrl, status, staff_notes as staffNotes 
        FROM applications ORDER BY id DESC
      `);
      return res.status(200).json({ status: 'success', data: result.rows });
    }

    if (action === 'update') {
      await db.execute({
        sql: "UPDATE applications SET status = ? WHERE ref_id = ?",
        args: [status, refId]
      });

      const appData = await db.execute({
        sql: "SELECT ign, discord FROM applications WHERE ref_id = ?",
        args: [refId]
      });
      const applicant = appData.rows[0];

      if (applicant && webhookUrl) {
        const isApproved = status === 'Approved';
        const logPayload = {
          embeds: [{
            title: `Application ${status}`,
            description: `A staff member has reviewed an application.`,
            color: isApproved ? 3066993 : 15158332,
            fields: [
              { name: "Ref ID", value: `\`${refId}\``, inline: true },
              { name: "Creator", value: `**${applicant.ign}**`, inline: true },
              { name: "Discord", value: applicant.discord ? `\`${applicant.discord}\`` : "N/A", inline: true },
              { name: "New Status", value: `**${status.toUpperCase()}**`, inline: false }
            ],
            footer: { text: "Staff Action Log" },
            timestamp: new Date().toISOString()
          }]
        };
        await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(logPayload) });
      }

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

// --- SECURE ADMIN LOGIN ENDPOINT ---
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === process.env.ADMIN_PASSWORD) res.status(200).json({ success: true });
  else res.status(401).json({ success: false, message: "Incorrect password." });
});

// ==========================================
// 3. START THE SERVER
// ==========================================
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});