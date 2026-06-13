export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim() || "";
export const CONTACT_WHATSAPP_URL =
  process.env.NEXT_PUBLIC_CONTACT_WHATSAPP_URL?.trim() || "";

export function openConfiguredContactEmail({
  senderEmail = "",
  message = "",
  subject = "n+ Portal Inquiry",
} = {}) {
  if (!CONTACT_EMAIL || typeof window === "undefined") {
    return false;
  }

  const params = new URLSearchParams();
  params.set("subject", subject);

  const body = [];
  if (senderEmail) {
    body.push(`Sender: ${senderEmail}`);
  }
  if (message) {
    if (body.length > 0) {
      body.push("");
    }
    body.push(message);
  }

  if (body.length > 0) {
    params.set("body", body.join("\n"));
  }

  window.location.href = `mailto:${CONTACT_EMAIL}?${params.toString()}`;
  return true;
}
