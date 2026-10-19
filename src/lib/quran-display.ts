/** Display compatibility for the bundled Hafs font; never used for indexing or data import. */
export function quranDisplayText(text: string): string {
  return text
    // Tanzil encodes this connected hamza carrier as tatweel + combining hamza.
    // Hafs draws that carrier flat after a sakin sin. Use the equivalent seated
    // hamza glyph for display so its tooth remains visible (e.g. نَسْـَٔلُكَ).
    // Do not apply this to all tatweel/hamza pairs: الآخرة has a different seat.
    .replace(/سْـٔ/g, 'سْئ')
    .replace(/[\u06D6-\u06ED\u0670]/g, '')
}
