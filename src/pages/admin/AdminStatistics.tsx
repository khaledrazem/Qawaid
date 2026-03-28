import { useEffect, useState } from 'react';
import { getAdminStatistics } from '@/services/backendApi';

export default function AdminStatistics() {
  const [stats, setStats] = useState<{
    promptsByDifficulty: Record<string, number>;
    promptsByCategory: Record<string, number>;
    questionsByCategory: Record<string, number>;
    questionsByType: Record<string, number>;
    definitionsByCategory: Record<string, number>;
    definitionsCount: number;
    categoriesCount: number;
    promptDefinitionsCount: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminStatistics()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !stats) return <p>Loading…</p>;

  const statCard = (title: string, subtitle?: string, entries: [string, number][], accent?: boolean) => (
    <div className={`stats-card card${accent ? ' stats-card--accent' : ''}`}>
      <h3 className="stats-card__title">{title}</h3>
      {subtitle && <p className="stats-card__subtitle text-muted">{subtitle}</p>}
      <ul className="stats-list">
        {entries.map(([key, n]) => (
          <li key={key} className="stats-list__item">
            <span className="stats-list__label">{key}</span>
            <span className="stats-list__value">{n}</span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="stats-page">
      <h1 className="page-title">Statistics</h1>
      <div className="stats-overview">
        <div className="stats-kpi card">
          <span className="stats-kpi__value">{stats.categoriesCount}</span>
          <span className="stats-kpi__label">Categories</span>
        </div>
        <div className="stats-kpi card">
          <span className="stats-kpi__value">{stats.definitionsCount}</span>
          <span className="stats-kpi__label">Definitions</span>
        </div>
        <div className="stats-kpi card">
          <span className="stats-kpi__value">{stats.promptDefinitionsCount}</span>
          <span className="stats-kpi__label">Prompt links</span>
        </div>
      </div>
      <div className="stats-grid">
        {statCard('Prompts by difficulty', undefined, Object.entries(stats.promptsByDifficulty))}
        {statCard(
          'Prompts by category',
          'Prompts with at least one link to a definition in that category',
          Object.entries(stats.promptsByCategory)
        )}
        {statCard('Questions by category', undefined, Object.entries(stats.questionsByCategory))}
        {statCard('Questions by type', undefined, Object.entries(stats.questionsByType))}
        {statCard('Definitions by category', undefined, Object.entries(stats.definitionsByCategory), true)}
      </div>
    </div>
  );
}
