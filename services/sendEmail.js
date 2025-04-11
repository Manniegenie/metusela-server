/**
 * Module: sendEmail
 *
 * This module sends verification emails using Mailjet's API (v3.1).
 * It retrieves Mailjet configuration from the config file.
 */

const config = require("../config");
const mailjet = require("node-mailjet").connect(
  config.mailjet.public,
  config.mailjet.private
);

/**
 * Sends a verification email via Mailjet.
 *
 * @param {string} email - Recipient's email address.
 * @param {string} verificationCode - The generated verification code.
 * @param {string} [username="User"] - Recipient's name for personalization.
 * @returns {Promise<object>} - A promise that resolves with Mailjet's response.
 */
async function sendVerificationEmail(email, verificationCode, username = "User") {
  const request = mailjet
    .post("send", { version: "v3.1" })
    .request({
      "Messages": [
        {
          "From": {
            "Email": "pilot@mailjet.com",
            "Name": "Mailjet Pilot"
          },
          "To": [
            {
              "Email": email,
              "Name": username
            }
          ],
          "Subject": "Verify your email address",
          "TextPart": `Dear ${username}, your verification code is: ${verificationCode}`,
          "HTMLPart": `<h3>Dear ${username},</h3>
                       <p>Please verify your email address using the following code: <strong>${verificationCode}</strong></p>`
        }
      ]
    });

  return request
    .then((result) => {
      console.log("Mailjet response:", result.body);
      return result.body;
    })
    .catch((err) => {
      console.error("Mailjet error:", err.statusCode);
      throw new Error("Failed to send verification email");
    });
}

module.exports = { sendVerificationEmail };
