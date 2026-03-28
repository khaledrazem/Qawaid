import { useEffect, useState } from 'react';
import { getAdminReports } from '@/services/backendApi';
import type { QuestionReport } from '@/types/db';

interface ReportWithPrompt extends QuestionReport {
  prompt_text?: string;
  definition_label?: string;
}

export default function AdminReports() {
  const [list, setList] = useState<ReportWithPrompt[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const { reports } = await getAdminReports();
      setList((reports ?? []) as ReportWithPrompt[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) return <p>Loading…</p>;

  const byPromptId = list.reduce<Record<string, ReportWithPrompt[]>>((acc, r) => {
    if (!acc[r.prompt_id]) acc[r.prompt_id] = [];
    acc[r.prompt_id].push(r);
    return acc;
  }, {});

  return (
    <div>
      <h1 className="page-title">Question reports</h1>
      <p className="page-subtitle">Aggregated by prompt; user-submitted comments about issues with questions.</p>
      {Object.entries(byPromptId).length === 0 ? (
        <p className="text-muted">No reports yet.</p>
      ) : (
        <ul className="item-list">
          {Object.entries(byPromptId).map(([promptId, reports]) => (
            <li key={promptId} className="padded">
              <strong>{reports[0]?.prompt_text ?? promptId}</strong>
              <ul className="prompt-defs">
                {reports.map((r) => (
                  <li key={r.id}>
                    {r.definition_label ?? '—'} — {r.comment}
                    <span className="text-muted"> {new Date(r.created_at).toLocaleString()}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
