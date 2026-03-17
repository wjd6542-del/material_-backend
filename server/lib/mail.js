import { Resend } from "resend";
const resend = new Resend(process.env.MAIL_KEY);
export async function sendMail({ email, subject, html }) {
  const res = await resend.emails.send({
    from: "onboarding@resend.dev",
    to: email,
    subject: subject,
    html: html,
  });
  return res;
}
