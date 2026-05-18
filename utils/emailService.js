const nodemailer = require('nodemailer');

// Configure Nodemailer transporter
// It uses environment variables. If they aren't set, it logs a warning.
const createTransporter = () => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        console.warn("\n⚠️ WARNING: EMAIL_USER or EMAIL_PASS is not set in .env.");
        console.warn("OTP emails will NOT be sent until you provide valid SMTP credentials.\n");
    }

    return nodemailer.createTransport({
        service: 'gmail', // You can change this to 'smtp.mailtrap.io' or other providers
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    });
};

const transporter = createTransporter();

const sendOTP = async (email, otp, name) => {
    if (!process.env.EMAIL_USER) {
        throw new Error("SMTP credentials are not configured. Cannot send email.");
    }

    const mailOptions = {
        from: `"GovSecure App" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Your GovSecure Login OTP',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h2 style="color: #4f46e5; text-align: center;">GovSecure</h2>
                <p>Hello ${name || 'User'},</p>
                <p>You have requested to log in to GovSecure. Please use the following One-Time Password (OTP) to proceed:</p>
                <div style="background-color: #f8fafc; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
                    <h1 style="letter-spacing: 5px; color: #1e293b; margin: 0;">${otp}</h1>
                </div>
                <p style="color: #64748b; font-size: 0.9em;">This OTP is valid for 5 minutes. Do not share it with anyone.</p>
                <p>If you did not request this, please ignore this email.</p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin-top: 30px;">
                <p style="text-align: center; color: #94a3b8; font-size: 0.8em;">Secure & Share Govt Documents Platform</p>
            </div>
        `
    };

    return await transporter.sendMail(mailOptions);
};

const sendAadhaarOTP = async (email, otp, last4) => {
    if (!process.env.EMAIL_USER) {
        throw new Error("SMTP credentials are not configured. Cannot send email.");
    }

    const mailOptions = {
        from: `"GovSecure App" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: 'Aadhaar Verification OTP - GovSecure',
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                <h2 style="color: #4f46e5; text-align: center;">GovSecure Aadhaar Linking</h2>
                <p>Hello,</p>
                <p>You are linking your Aadhaar card (ending in <strong>${last4}</strong>) to your GovSecure account.</p>
                <p>Please use the following One-Time Password (OTP) to complete the verification:</p>
                <div style="background-color: #f8fafc; padding: 15px; text-align: center; border-radius: 8px; margin: 20px 0;">
                    <h1 style="letter-spacing: 5px; color: #1e293b; margin: 0;">${otp}</h1>
                </div>
                <p style="color: #64748b; font-size: 0.9em;">This OTP is valid for 5 minutes. Do not share it with anyone.</p>
                <p>If you did not initiate this request, please secure your account immediately.</p>
                <hr style="border: none; border-top: 1px solid #e2e8f0; margin-top: 30px;">
                <p style="text-align: center; color: #94a3b8; font-size: 0.8em;">Secure & Share Govt Documents Platform</p>
            </div>
        `
    };

    return await transporter.sendMail(mailOptions);
};

module.exports = { sendOTP, sendAadhaarOTP };
