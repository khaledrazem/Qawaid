/**
 * Shared word-boundary utility for prompt text.
 * Uses the same rule as Play: split on whitespace via split(/(\s+)/).
 * Until the backend owns tokenization, prompts should not rely on punctuation
 * for word boundaries (e.g. comma-separated words are treated as one word).
 */

export interface PromptWord {
  word: string;
  startIndex: number;
  endIndex: number;
}

/**
 * Returns words with start/end indices. Whitespace is not included in any word;
 * each word is a maximal non-whitespace segment.
 */
export function getPromptWords(text: string): PromptWord[] {
  const result: PromptWord[] = [];
  let idx = 0;
  for (const segment of text.split(/(\s+)/)) {
    if (segment.trim()) {
      result.push({
        word: segment,
        startIndex: idx,
        endIndex: idx + segment.length,
      });
    }
    idx += segment.length;
  }
  return result;
}

/**
 * Returns the word span containing the given character index, or null if out of range.
 * Use this to display the linked word in admin so it matches Play boundaries.
 */
export function getWordSpanAt(text: string, index: number): PromptWord | null {
  const words = getPromptWords(text);
  for (const w of words) {
    if (index >= w.startIndex && index < w.endIndex) return w;
  }
  return null;
}
