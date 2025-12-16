// A simple fuzzy search function that scores matches.
// Higher score is better. Returns 0 for no match.
export function fuzzySearch(query: string, text: string): number {
  if (!query) return 1; // if no query, everything is a match

  const queryLower = query.toLowerCase();
  const textLower = text.toLowerCase();
  
  let score = 0;
  let queryIndex = 0;
  let textIndex = 0;
  let consecutiveMatches = 0;
  let lastMatchIndex = -1;

  while (queryIndex < queryLower.length && textIndex < textLower.length) {
    if (queryLower[queryIndex] === textLower[textIndex]) {
      let matchScore = 1;

      // Bonus for matching the start of a word
      if (textIndex === 0 || textLower[textIndex - 1].match(/[\s\-_/\\.]/)) {
        matchScore += 15;
      }

      // Bonus for consecutive matches
      if (lastMatchIndex === textIndex - 1) {
        consecutiveMatches++;
        matchScore += consecutiveMatches * 10;
      } else {
        consecutiveMatches = 0;
      }
      lastMatchIndex = textIndex;

      score += matchScore;
      queryIndex++;
    }
    textIndex++;
  }

  // If not all characters of the query were found, it's not a match
  if (queryIndex !== queryLower.length) {
    return 0;
  }
  
  // Normalize score by penalizing longer target strings and shorter query strings
  const finalScore = score / (text.length + 0.5 * (text.length - query.length));

  return finalScore;
}
