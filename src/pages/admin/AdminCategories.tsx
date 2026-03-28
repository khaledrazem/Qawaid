import { useEffect, useState } from 'react';
import {
  getAdminCategories,
  createAdminCategory,
  patchAdminCategory,
  deleteAdminCategory,
} from '@/services/backendApi';
import type { Category, Definition } from '@/types/db';

interface CategoryWithCount extends Category {
  definition_count: number;
}

interface CategoryDefinitionRow {
  category_id: string;
  definition_id: string;
}

export default function AdminCategories() {
  const [list, setList] = useState<CategoryWithCount[]>([]);
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [categoryDefs, setCategoryDefs] = useState<CategoryDefinitionRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDefIds, setNewDefIds] = useState<string[]>([]);
  const [assignDefOpen, setAssignDefOpen] = useState<string | null>(null);
  const [assignDefIds, setAssignDefIds] = useState<string[]>([]);

  const load = async () => {
    try {
      const { categories: cats, definitions: defs, category_definitions: cd } = await getAdminCategories();
      const cdData = (cd ?? []) as CategoryDefinitionRow[];
      setCategoryDefs(cdData);
      const defCount = cdData.reduce<Record<string, number>>((acc, row) => {
        acc[row.category_id] = (acc[row.category_id] ?? 0) + 1;
        return acc;
      }, {});
      setList(((cats ?? []) as unknown as Category[]).map((c) => ({ ...c, definition_count: defCount[c.id] ?? 0 })));
      setDefinitions((defs ?? []) as unknown as Definition[]);
    } finally {
      setLoading(false);
    }
  };

  const getDefinitionLabelsForCategory = (categoryId: string): string[] => {
    const defIds = categoryDefs.filter((r) => r.category_id === categoryId).map((r) => r.definition_id);
    return defIds.map((id) => definitions.find((d) => d.id === id)?.label ?? id).filter(Boolean) as string[];
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (row: Category) => {
    await patchAdminCategory(row.id, { is_active: !row.is_active });
    load();
  };

  const startEdit = (row: Category) => {
    setEditingId(row.id);
    setEditName(row.name);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await patchAdminCategory(editingId, { name: editName });
    setEditingId(null);
    load();
  };

  const addCategory = async () => {
    if (!newName.trim()) return;
    await createAdminCategory(newName.trim(), newDefIds);
    setAddOpen(false);
    setNewName('');
    setNewDefIds([]);
    load();
  };

  const openAssign = (categoryId: string) => {
    const ids = categoryDefs.filter((r) => r.category_id === categoryId).map((r) => r.definition_id);
    setAssignDefIds(ids);
    setAssignDefOpen(categoryId);
  };

  const saveAssign = async () => {
    if (!assignDefOpen) return;
    await patchAdminCategory(assignDefOpen, { definition_ids: assignDefIds });
    setAssignDefOpen(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this category? Questions and lessons may reference it.')) return;
    await deleteAdminCategory(id);
    load();
  };

  const ready = !loading;

  return (
    <div>
      <h1 className="page-title">Categories</h1>
      <p className="page-subtitle">
        Categories need at least 4 definitions for MCQ questions. A warning is shown if &lt;4.
      </p>

      {loading && <p>Loading…</p>}

      {ready && (
        <>
          <button type="button" onClick={() => setAddOpen(true)} className="btn-add">Add category</button>

          {addOpen && (
            <div className="card">
              <h3>New category</h3>
              <input
                placeholder="Name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="input-wide"
              />
              <div className="form-row">Definitions (multiselect)</div>
              <select
                multiple
                value={newDefIds}
                onChange={(e) => setNewDefIds(Array.from(e.target.selectedOptions, (o) => o.value))}
                className="select-multi"
              >
                {definitions.map((d) => (
                  <option key={d.id} value={d.id}>{d.label}</option>
                ))}
              </select>
              <div className="form-actions">
                <button type="button" onClick={addCategory}>Save</button>
                <button type="button" onClick={() => { setAddOpen(false); setNewName(''); setNewDefIds([]); }} className="btn-cancel">Cancel</button>
              </div>
            </div>
          )}

          <ul className="item-list">
            {list.map((row) => (
              <li key={row.id}>
                <div className="item-row">
                  <button
                    type="button"
                    onClick={() => setExpandedId((id) => (id === row.id ? null : row.id))}
                    className="expand-btn"
                    aria-label={expandedId === row.id ? 'Collapse' : 'Expand'}
                  >
                    {expandedId === row.id ? '▼' : '▶'}
                  </button>
                  {editingId === row.id ? (
                    <>
                      <input value={editName} onChange={(e) => setEditName(e.target.value)} className="inline-input" />
                      <button type="button" onClick={saveEdit}>Save</button>
                      <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <strong>{row.name}</strong>
                      {row.definition_count < 4 && (
                        <span title="Category needs at least 4 definitions for MCQ" className="text-warning">⚠ &lt;4 definitions</span>
                      )}
                      <span className="text-muted">({row.definition_count} definitions)</span>
                      <button type="button" onClick={() => toggleActive(row)}>{row.is_active ? 'Deactivate' : 'Activate'}</button>
                      <button type="button" onClick={() => startEdit(row)}>Edit</button>
                      <button type="button" onClick={() => openAssign(row.id)}>Assign definitions</button>
                      <button type="button" onClick={() => remove(row.id)} className="btn-delete">Delete</button>
                    </>
                  )}
                </div>
                {expandedId === row.id && (
                  <ul className="expanded-defs">
                    {getDefinitionLabelsForCategory(row.id).length === 0 ? (
                      <li>No definitions assigned</li>
                    ) : (
                      getDefinitionLabelsForCategory(row.id).map((label) => (
                        <li key={label}>{label}</li>
                      ))
                    )}
                  </ul>
                )}
              </li>
            ))}
          </ul>

          {assignDefOpen && (
            <div className="modal-overlay">
              <div className="modal-content narrow">
                <h3>Assign definitions to category</h3>
                <select
                  multiple
                  value={assignDefIds}
                  onChange={(e) => setAssignDefIds(Array.from(e.target.selectedOptions, (o) => o.value))}
                  className="select-multi"
                >
                  {definitions.map((d) => (
                    <option key={d.id} value={d.id}>{d.label}</option>
                  ))}
                </select>
                <div className="modal-actions">
                  <button type="button" onClick={saveAssign}>Save</button>
                  <button type="button" onClick={() => setAssignDefOpen(null)} className="btn-cancel">Cancel</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

