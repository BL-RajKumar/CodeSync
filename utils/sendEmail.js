import nodemailer from 'nodemailer';

const sendEmail = async (options) => {
  // Create a transporter using SMTP
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_EMAIL, // e.g. your email
      pass: process.env.SMTP_PASSWORD, // e.g. app password
    },
  });

  // Define email options
  const mailOptions = {
    from: `${process.env.FROM_NAME || 'CodeSync'} <${process.env.FROM_EMAIL || process.env.SMTP_EMAIL}>`,
    to: options.email,
    subject: options.subject,
    html: options.message,
  };

  // Send the email
  const info = await transporter.sendMail(mailOptions);
  console.log(`Message sent: ${info.messageId}`);
};

export default sendEmail;
