import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import nodemailer from "nodemailer";
import twilio from "twilio";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Email Transporter
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  // Twilio Client (Lazy Initialization)
  let twilioClient: twilio.Twilio | null = null;
  const getTwilioClient = () => {
    if (!twilioClient && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    }
    return twilioClient;
  };

  // API route for sending email notifications
  app.post("/api/notify", async (req, res) => {
    const { to, subject, body } = req.body;

    if (!to || !subject || !body) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      // If no SMTP credentials, log to console for demo
      if (!process.env.SMTP_HOST) {
        console.log("--- EMAIL NOTIFICATION (DEMO) ---");
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log(`Body: ${body}`);
        console.log("---------------------------------");
        return res.json({ success: true, message: "Email logged to console (no SMTP configured)" });
      }

      await transporter.sendMail({
        from: `"Devco Sacco LMS" <${process.env.SMTP_FROM || "noreply@devcosacco.com"}>`,
        to,
        subject,
        text: body,
        html: `<div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                <h2 style="color: #8B0000;">Devco Sacco LMS</h2>
                <p>${body.replace(/\n/g, "<br>")}</p>
                <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="font-size: 12px; color: #666;">This is an automated notification from the Leave Management System.</p>
              </div>`,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Email error:", error);
      res.status(500).json({ error: "Failed to send email" });
    }
  });

  // API route for sending SMS notifications via Twilio
  app.post("/api/notify/sms", async (req, res) => {
    const { to, body } = req.body;

    if (!to || !body) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      const client = getTwilioClient();
      
      if (!client || !process.env.TWILIO_PHONE_NUMBER) {
        console.log("--- SMS NOTIFICATION (DEMO) ---");
        console.log(`To: ${to}`);
        console.log(`Body: ${body}`);
        console.log("---------------------------------");
        return res.json({ success: true, message: "SMS logged to console (no Twilio configured)" });
      }

      await client.messages.create({
        body,
        from: process.env.TWILIO_PHONE_NUMBER,
        to,
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Twilio error:", error);
      res.status(500).json({ error: "Failed to send SMS" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
