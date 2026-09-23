export const CATEGORIES = {
  person: "Noms de personnes",
  address: "Adresses et lieux",
  organization: "Organisations",
  email: "Adresses e-mail",
  phone: "Téléphones",
  iban: "IBAN",
  card: "Cartes bancaires",
};
export const POLICIES = {
  contact: {
    name: "Coordonnées personnelles",
    categories: ["person", "address", "email", "phone"],
  },
  finance: { name: "Données bancaires", categories: ["iban", "card"] },
  complete: {
    name: "Toutes les catégories",
    categories: Object.keys(CATEGORIES),
  },
};
export function validatePlan(value, instruction = "") {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(
      "Instruction non comprise. Choisissez une politique ou reformulez.",
    );
  if (value.unsupported === true)
    throw new Error(
      "Cette instruction dépasse les catégories disponibles. Choisissez les catégories à masquer.",
    );
  if (
    !Array.isArray(value.categories) ||
    value.categories.some((x) => !Object.hasOwn(CATEGORIES, x))
  )
    throw new Error("Catégories non reconnues. Reformulez votre instruction.");
  const checked = (values) => {
    if (
      !Array.isArray(values) ||
      values.length > 20 ||
      values.some(
        (x) =>
          typeof x !== "string" ||
          !x.trim() ||
          x.length > 160 ||
          !instruction.toLocaleLowerCase().includes(x.toLocaleLowerCase()),
      )
    )
      throw new Error(
        "Le texte à rechercher ou à conserver doit figurer dans votre instruction.",
      );
    return [...new Set(values.map((x) => x.trim()))];
  };
  const plan = {
    categories: [...new Set(value.categories)],
    literals: checked(value.literals || []),
    exclude: checked(value.exclude || []),
  };
  if (!plan.categories.length && !plan.literals.length)
    throw new Error(
      "Aucune catégorie reconnue. Précisez les informations à masquer.",
    );
  return plan;
}
export function parsePlan(text, instruction) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match)
    throw new Error(
      "Instruction non comprise. Reformulez ou choisissez une politique.",
    );
  let value;
  try {
    value = JSON.parse(match[0]);
  } catch {
    throw new Error(
      "Instruction non comprise. Reformulez ou choisissez une politique.",
    );
  }
  return validatePlan(value, instruction);
}
export function validIban(raw) {
  const s = raw.replace(/\s/g, "").toUpperCase();
  const lengths = {
    FR: 27,
    DE: 22,
    GB: 22,
    ES: 24,
    IT: 27,
    BE: 16,
    CH: 21,
    NL: 18,
    LU: 20,
    PT: 25,
    IE: 22,
    AT: 20,
    MC: 27,
  };
  if (
    !/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(s) ||
    (lengths[s.slice(0, 2)] && s.length !== lengths[s.slice(0, 2)])
  )
    return false;
  let rem = 0;
  for (const c of s.slice(4) + s.slice(0, 4))
    for (const digit of /[A-Z]/.test(c) ? String(c.charCodeAt(0) - 55) : c)
      rem = (rem * 10 + Number(digit)) % 97;
  return rem === 1;
}
export function validCard(raw) {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19 || /^(.)\1+$/.test(digits))
    return false;
  let sum = 0;
  for (let i = digits.length - 1, n = 0; i >= 0; i--, n++) {
    let d = +digits[i];
    if (n % 2) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  return sum % 10 === 0;
}
export function ruleEntities(text, plan) {
  const found = [];
  const patterns = {
    email: /[\p{L}\d.!#$%&'*+/=?^_`{|}~-]+@[\p{L}\d-]+(?:\.[\p{L}\d-]+)+/gu,
    phone:
      /(?<!\d)(?:(?:\+|00)33[ .()-]*[1-9]|0[1-9])(?:[ .()-]*\d{2}){4}(?!\d)|(?<!\w)\+[1-9]\d{0,2}(?:[ .()-]*\d){7,12}(?!\d)/g,
    iban: /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}\b/g,
    card: /(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)/g,
  };
  for (const category of plan.categories) {
    if (!patterns[category]) continue;
    for (const m of text.matchAll(patterns[category])) {
      if (category === "iban") {
        // Stop at a checksum-valid IBAN even when a BIC or another uppercase
        // field follows it on the same PDF text line.
        let value = null;
        for (let end = m[0].length; end >= 15; end--) {
          if (
            (end === m[0].length || m[0][end] === " ") &&
            validIban(m[0].slice(0, end))
          ) {
            value = m[0].slice(0, end);
            break;
          }
        }
        if (!value) continue;
        m[0] = value;
      }
      if (category === "card" && !validCard(m[0])) continue;
      found.push({
        start: m.index,
        end: m.index + m[0].length,
        text: m[0],
        category,
        source: "rule",
        score: 1,
      });
    }
  }
  for (const literal of plan.literals || []) {
    const escaped = literal.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const m of text.matchAll(new RegExp(escaped, "giu")))
      found.push({
        start: m.index,
        end: m.index + m[0].length,
        text: m[0],
        category: "literal",
        source: "literal",
        score: 1,
      });
  }
  return found;
}
// Keep overlap so entities straddling a window boundary still have context.
export function textChunks(text, maxWords = 90, overlap = 20) {
  const words = [
      ...text.matchAll(/[\p{L}\p{N}_]+(?:[-’'][\p{L}\p{N}_]+)*|[^\s]/gu),
    ],
    result = [];
  for (let i = 0; i < words.length; i += maxWords - overlap) {
    const last = words[Math.min(i + maxWords, words.length) - 1];
    result.push({
      start: words[i].index,
      text: text.slice(words[i].index, last.index + last[0].length),
    });
    if (i + maxWords >= words.length) break;
  }
  return result;
}
export function filterEntities(entities, plan) {
  const seen = new Set();
  return entities.filter((e) => {
    if (
      !Number.isInteger(e.start) ||
      !Number.isInteger(e.end) ||
      e.end <= e.start
    )
      return false;
    // An exclusion only suppresses the matching entity, never unrelated text on its page.
    if (
      (plan.exclude || []).some((x) =>
        e.text.toLocaleLowerCase().includes(x.toLocaleLowerCase()),
      )
    )
      return false;
    const key = `${e.start}:${e.end}:${e.category}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
export function spanRegions(index, entity) {
  // PDF text items do not expose dependable glyph advances. Cover the complete
  // intersecting item rather than guessing character widths and leaking letters.
  return index.items
    .filter((i) => i.end > entity.start && i.start < entity.end)
    .map((i) => i.rect)
    .filter(Boolean);
}
export function regionKey(r) {
  return [r.page, r.x, r.y, r.width, r.height]
    .map((v, i) => (i ? v.toFixed(4) : v))
    .join(":");
}

// Exact-text requests and exceptions use quoted strings, never model-invented
// names. Broad, named policies have stable meanings even with a small model.
export function instructionDetails(instruction) {
  const literals = [],
    exclude = [];
  const quotes = [...instruction.matchAll(/[«"]([^»"]{1,160})[»"]/gu)];
  for (const m of quotes) {
    const prefix = instruction.slice(Math.max(0, m.index - 45), m.index);
    (/\b(?:sauf|conserve[rz]?|garde[rz]?|except|keep|excluding)\s*$/iu.test(
      prefix,
    )
      ? exclude
      : literals
    ).push(m[1]);
  }
  const withoutQuotes = instruction.replace(/[«"][^»"]*[»"]/gu, " QUOTED ");
  if (
    [
      ...withoutQuotes.matchAll(
        /\b(?:sauf|conserve[rz]?|garde[rz]?|except|keep|excluding)\s+(\S+)/giu,
      ),
    ].some((m) => m[1] !== "QUOTED")
  )
    throw new Error(
      "Pour conserver un texte, écrivez par exemple : sauf « Inklura ». Les exceptions doivent être des textes exacts entre guillemets.",
    );
  if (
    /\b(?:ne\s+pas|ne\s+\w+\s+pas|uniquement\s+(?:le|les)\s+(?:client|salari)|seulement\s+(?:le|les)\s+(?:client|salari))\b/iu.test(
      withoutQuotes,
    )
  )
    throw new Error(
      "Cette condition nécessite une sélection manuelle. Demandez des catégories ou un texte exact entre guillemets.",
    );
  return { literals, exclude };
}
export function completeInstructionPlan(value, instruction) {
  const details = instructionDetails(instruction);
  let categories = value.categories;
  if (
    /(?:coordonnées|client.?s? details|détails des clients|informations personnelles|personal information)/iu.test(
      instruction,
    )
  )
    categories = POLICIES.contact.categories;
  if (
    /(?:toutes les (?:informations|données) sensibles|all sensitive (?:information|data))/iu.test(
      instruction,
    )
  )
    categories = POLICIES.complete.categories;
  return validatePlan({ categories, ...details }, instruction);
}
