export const plannerMessages = (instruction) => [
  {
    role: "system",
    content: `Classify the user's PDF redaction request. Output JSON with only one key "categories", an array. Choose from person (names of people), address (postal addresses), organization (company names), email, phone, iban, card. Never use other labels. "Coordonnées" or "client details" means person,address,email,phone. Only classify; do not give explanations.`,
  },
  { role: "user", content: "Masque les coordonnées de tous les clients." },
  {
    role: "assistant",
    content: '{"categories":["person","address","email","phone"]}',
  },
  { role: "user", content: "Cache les noms et les e-mails." },
  { role: "assistant", content: '{"categories":["person","email"]}' },
  { role: "user", content: instruction },
];
