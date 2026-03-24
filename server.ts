import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import nodemailer from "nodemailer";
import twilio from "twilio";
import dotenv from "dotenv";
import PDFDocument from "pdfkit";
import { Readable } from "stream";

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

  // API route for sending approval email with PDF attachment
  app.post("/api/notify/approval-pdf", async (req, res) => {
    const { to, requestData, approverName } = req.body;

    if (!to || !requestData || !approverName) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      // Generate PDF
      const doc = new PDFDocument();
      const chunks: any[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      
      const pdfPromise = new Promise<Buffer>((resolve) => {
        doc.on("end", () => resolve(Buffer.concat(chunks)));
      });

      // PDF Content
      doc.fontSize(20).fillColor("#8B0000").text("Leave Approval Certificate", { align: "center" });
      doc.moveDown();
      doc.fontSize(12).fillColor("#000000").text(`Certificate ID: ${requestData.id.substring(0, 8).toUpperCase()}`);
      doc.text(`Date Issued: ${new Date().toLocaleString()}`);
      doc.moveDown();
      doc.rect(50, doc.y, 500, 2).fill("#8B0000");
      doc.moveDown(2);

      doc.fontSize(14).text("Employee Details", { underline: true });
      doc.fontSize(12).text(`Name: ${requestData.applicantName}`);
      doc.text(`Department: ${requestData.department}`);
      doc.text(`Email: ${requestData.applicantEmail}`);
      doc.moveDown();

      doc.fontSize(14).text("Leave Details", { underline: true });
      doc.fontSize(12).text(`Leave Type: ${requestData.leaveType}`);
      doc.text(`Start Date: ${requestData.startDate}`);
      doc.text(`End Date: ${requestData.endDate}`);
      doc.text(`Total Days: ${requestData.totalDays}`);
      doc.moveDown();

      doc.fontSize(14).text("Approval Information", { underline: true });
      doc.fontSize(12).text(`Status: APPROVED`);
      doc.text(`Approved By: ${approverName}`);
      doc.text(`Approval Timestamp: ${new Date().toISOString()}`);
      doc.moveDown(2);

      doc.fontSize(10).fillColor("#666666").text("This is an electronically generated document. No physical signature is required.", { align: "center" });
      
      doc.end();

      const pdfBuffer = await pdfPromise;

      // If no SMTP credentials, log to console for demo
      if (!process.env.SMTP_HOST) {
        console.log("--- APPROVAL EMAIL WITH PDF (DEMO) ---");
        console.log(`To: ${to}`);
        console.log(`Subject: Leave Approved - ${requestData.leaveType}`);
        console.log(`PDF generated (${pdfBuffer.length} bytes)`);
        console.log("---------------------------------------");
        return res.json({ success: true, message: "Email logged to console (no SMTP configured)" });
      }

      await transporter.sendMail({
        from: `"Devco Sacco LMS" <${process.env.SMTP_FROM || "noreply@devcosacco.com"}>`,
        to,
        subject: `Leave Approved - ${requestData.leaveType}`,
        text: `Hello ${requestData.applicantName},\n\nYour leave request has been fully approved. Please find the attached approval certificate for your records.\n\nApproved By: ${approverName}\nTimestamp: ${new Date().toLocaleString()}`,
        attachments: [
          {
            filename: `Leave_Approval_${requestData.id.substring(0, 8)}.pdf`,
            content: pdfBuffer,
          },
        ],
      });

      res.json({ success: true });
    } catch (error) {
      console.error("PDF/Email error:", error);
      res.status(500).json({ error: "Failed to generate PDF or send email" });
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
