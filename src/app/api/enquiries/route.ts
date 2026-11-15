import { Resend } from "resend";
import { createEnquiryPostHandler } from "@/lib/enquiries/handler";

export const runtime = "nodejs";

// Add shared rate limiting as a future hardening measure.
const handleEnquiry = createEnquiryPostHandler({
  env: {
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    ENQUIRY_TO_EMAIL: process.env.ENQUIRY_TO_EMAIL,
    ENQUIRY_FROM_EMAIL: process.env.ENQUIRY_FROM_EMAIL,
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
    VERCEL_URL: process.env.VERCEL_URL,
  },
  sendEmail: async (apiKey, email) => {
    const { data, error } = await new Resend(apiKey).emails.send(email);
    return Boolean(data && !error);
  },
});

export async function POST(request: Request) {
  return handleEnquiry(request);
}
