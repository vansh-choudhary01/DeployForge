import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
        user: process.env.AUTH_EMAIL,
        pass: process.env.AUTH_PASSWORD
    }
});

export default async function sendEmail(to, subject, text) {
    const info = await transporter.sendMail({
        from: process.env.AUTH_EMAIL,
        to,
        subject,
        text
    });

    console.log('Message sent: ' + info.messageId);
}