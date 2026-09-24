import { CATEGORIES } from "./ai/core.mjs";
const KEY = "inklura-redaction-profiles-v1";
export function validateProfile(value) {
  if (
    !value ||
    typeof value.name !== "string" ||
    !value.name.trim() ||
    value.name.length > 100 ||
    !Array.isArray(value.categories) ||
    value.categories.some((c) => !Object.hasOwn(CATEGORIES, c))
  )
    throw new Error("Profil invalide.");
  const texts = (items) => {
    if (
      !Array.isArray(items) ||
      items.length > 20 ||
      items.some((x) => typeof x !== "string" || !x.trim() || x.length > 160)
    )
      throw new Error("Utilisez jusqu’à 20 expressions de 160 caractères.");
    return [...new Set(items.map((x) => x.trim()))];
  };
  const literals = texts(value.literals),
    exclude = texts(value.exclude);
  if (!value.categories.length && !literals.length)
    throw new Error("Choisissez une catégorie ou un texte à masquer.");
  return {
    id: typeof value.id === "string" ? value.id : crypto.randomUUID(),
    name: value.name.trim(),
    categories: [...new Set(value.categories)],
    literals,
    exclude,
  };
}
export function readProfiles() {
  const value = JSON.parse(localStorage.getItem(KEY) || "[]");
  if (!Array.isArray(value) || value.length > 50)
    throw new Error("Liste de profils invalide.");
  return value.map(validateProfile);
}
export function writeProfiles(profiles) {
  if (profiles.length > 50) throw new Error("Limite de 50 profils atteinte.");
  localStorage.setItem(KEY, JSON.stringify(profiles.map(validateProfile)));
}
