import { useEffect, useState } from 'react';
import { getCategories } from '@/services/backendApi';
import { useTranslation } from '@/hooks/useTranslation';
import { GoldDivider } from '@/components/Decorative';
import type { Category } from '@/types/db';

const STORAGE_KEY = 'sahra_selected_categories';

interface Props {
  onClose: () => void;
}

/** Load selected category IDs from localStorage. Returns null if all selected or none stored. */
export function getSelectedCategories(): string[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null; // null = all selected
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Persist selected category IDs to localStorage. */
function saveSelection(ids: string[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export default function SettingsModal({ onClose }: Props) {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCategories()
      .then((data) => {
        const cats = (data ?? []) as Category[];
        setCategories(cats);
        const stored = getSelectedCategories();
        if (stored) {
          setSelected(new Set(stored));
        } else {
          setSelected(new Set(cats.map((c) => c.id)));
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(categories.map((c) => c.id)));
  const deselectAll = () => setSelected(new Set());

  const handleSave = () => {
    saveSelection([...selected]);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">{t('settings.title')}</h2>
        <GoldDivider className="modal-divider" />

        {loading && <p className="modal-loading">{t('common.loading')}</p>}

        {!loading && (
          <>
            <p className="modal-subtitle">{t('settings.categories')}</p>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={selectAll}>
                {t('settings.selectAll')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={deselectAll}>
                {t('settings.deselectAll')}
              </button>
            </div>

            <div className="category-list">
              {categories.map((cat) => (
                <label key={cat.id} className="category-item">
                  <input
                    type="checkbox"
                    checked={selected.has(cat.id)}
                    onChange={() => toggle(cat.id)}
                  />
                  <span className="category-item-label">{cat.name}</span>
                </label>
              ))}
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                {t('common.cancel')}
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSave}>
                {t('settings.save')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
