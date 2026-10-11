const script = `(() => {
  const words = Array.from(document.querySelectorAll('.quran-word'));
  const markRe = /[\\u06D6-\\u06ED\\u0670]/;
  let totalWords = 0;
  let wordsWithMarks = 0;
  for (const w of words) {
    totalWords++;
    const text = w.textContent || '';
    if (markRe.test(text)) {
      wordsWithMarks++;
    }
  }
  const samples = words.slice(0, 15).map(w => w.textContent);
  return JSON.stringify({
    totalWords,
    wordsWithMarksStillRendered: wordsWithMarks,
    sampleWords: samples,
  });
})()`;
console.log(script);
