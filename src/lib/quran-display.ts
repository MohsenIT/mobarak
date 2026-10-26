/** Display compatibility for the bundled Hafs font; never used for indexing or data import. */
export function quranDisplayText(text: string): string {
  return text
    // Tanzil encodes this connected hamza carrier as tatweel + combining hamza.
    // Hafs draws that carrier flat after a sakin sin. Use the equivalent seated
    // hamza glyph for display so its tooth remains visible (e.g. نَسْـَٔلُكَ).
    // Do not apply this to all tatweel/hamza pairs: الآخرة has a different seat.
    .replace(/سْـٔ/g, 'سْئ')
    // Hide only standalone pause/section annotations. Superscript alef,
    // small waw/yeh and pronunciation marks are part of the Quran's writing;
    // deleting the whole Arabic-signs range silently removed them everywhere.
    .replace(/[\u06D6-\u06DC\u06DE\u06E9]/g, '')
    // A hidden pause mark may leave a trailing space inside a selectable word.
    .trim()
}
