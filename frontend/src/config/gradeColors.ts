// Keyed by grade position (1-4), shared between SkillCard (right panel) and ProfileDialog so a
// skill's grade tag looks the same everywhere it's shown.
export const GRADE_COLORS: Record<number, string> = {
  1: 'green', // Débutant — highlighted on purpose: this app wants beginners on the map too
  2: 'blue',
  3: 'purple',
  4: 'gold'
};
