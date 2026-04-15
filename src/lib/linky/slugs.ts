const SLUG_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function generateSlug(length = 7): string {
  const randomValues = new Uint32Array(length);
  crypto.getRandomValues(randomValues);

  return Array.from(randomValues, (value) => {
    return SLUG_ALPHABET[value % SLUG_ALPHABET.length];
  }).join("");
}
