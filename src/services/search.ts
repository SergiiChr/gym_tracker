/** Whether the query's letters appear in the text in order, ignoring case and spaces, so "bpr" matches "Bench Press". */
export function fuzzyMatch(query: string, text: string): boolean {
  const letters = query.toLowerCase().replace(/\s+/g, "");
  let found = 0;
  for (const char of text.toLowerCase()) if (char === letters[found]) found++;
  return found === letters.length;
}
