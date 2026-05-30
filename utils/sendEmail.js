import nodemailer from 'nodemailer';

const sendEmail = async (options) => {
  // 1. SendGrid HTTP API (Bypasses Render SMTP Block)
  if (process.env.SENDGRID_API_KEY) {
    const payload = {
      personalizations: [
        {
          to: [{ email: options.email }],
          subject: options.subject,
        },
      ],
      from: {
        email: process.env.FROM_EMAIL || process.env.SMTP_EMAIL || 'noreply@codesync.com',
        name: process.env.FROM_NAME || 'CodeSync Team',
      },
      content: [
        {
          type: 'text/html',
          value: options.message,
        },
      ],
    };

    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('SendGrid API Error:', errorData);
      throw new Error('Failed to send email via SendGrid API');
    }
    
    console.log(`Message sent via SendGrid API to: ${options.email}`);
    return;
  }

  // 2. Fallback: Standard Nodemailer (Local Development)
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    family: 4, // Force IPv4 (fixes ENETUNREACH on Render/IPv6)
    auth: {
      user: process.env.SMTP_EMAIL, // e.g. your email
      pass: process.env.SMTP_PASSWORD, // e.g. app password
    },
  });

  const mailOptions = {
    from: `${process.env.FROM_NAME || 'CodeSync'} <${process.env.FROM_EMAIL || process.env.SMTP_EMAIL}>`,
    to: options.email,
    subject: options.subject,
    html: options.message,
  };

  const info = await transporter.sendMail(mailOptions);
  console.log(`Message sent via SMTP: ${info.messageId}`);
};

export default sendEmail;
