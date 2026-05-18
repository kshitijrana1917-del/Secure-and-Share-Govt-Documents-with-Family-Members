const twilio = require('twilio');

const sendSMS = async (to, message) => {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromPhone = process.env.TWILIO_PHONE_NUMBER;

    if (!accountSid || !authToken || !fromPhone) {
        console.warn("\n⚠️ WARNING: Twilio credentials are not set in .env.");
        console.warn("SMS will NOT be sent until you provide valid Twilio credentials.\n");
        // For development/demo purposes if credentials are missing, we log it
        console.log(`[SIMULATED SMS to ${to}]: ${message}`);
        return { sid: 'simulated_sid' };
    }

    const client = twilio(accountSid, authToken);

    try {
        const response = await client.messages.create({
            body: message,
            from: fromPhone,
            to: to
        });
        return response;
    } catch (err) {
        let customMsg = err.message;
        if (err.message.includes("'To' and 'From' number cannot be the same")) {
            customMsg = `You cannot send SMS to the same number (${to}). Please check your TWILIO_PHONE_NUMBER in .env and ensure it is the one provided by Twilio Console.`;
        }
        console.error("Failed to send SMS via Twilio:", customMsg);
        throw new Error(`Twilio error: ${customMsg}`);
    }
};

module.exports = { sendSMS };