
export const getMonacoLanguage = (lang: string): string => {
  if (lang === 'js') return 'javascript';
  if (lang === 'ts') return 'typescript';
  if (lang === 'jsx') return 'javascript'; // Monaco handles JSX in JS
  if (lang === 'tsx') return 'typescript'; // Monaco handles TSX in TS
  return lang;
};
