import { useEffect, useState } from 'react';
import { fetchGradesCatalog, fetchSkillsCatalog } from '../config/catalog';
import type { GradeCatalogEntry, SkillCatalogEntry } from '../config/catalog';

/** Loads the public skills/grades catalogs from our backend once, on mount. */
export const useCatalogs = () => {
  const [skills, setSkills] = useState<SkillCatalogEntry[]>([]);
  const [grades, setGrades] = useState<GradeCatalogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchSkillsCatalog(), fetchGradesCatalog()])
      .then(([skillsResult, gradesResult]) => {
        if (cancelled) return;
        setSkills(skillsResult);
        setGrades(gradesResult);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { skills, grades, loading };
};
