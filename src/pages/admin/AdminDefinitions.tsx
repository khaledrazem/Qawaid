import { useEffect, useState } from 'react';
import {
  getAdminDefinitions,
  createAdminDefinition,
  patchAdminDefinition,
  deleteAdminDefinition,
} from '@/services/backendApi';
import type { Definition, Category } from '@/types/db';

interface CategoryDefRow {
  category_id: string;
  definition_id: string;
}

export default function AdminDefinitions() {
  const [list, setList] = useState<Definition[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryDefs, setCategoryDefs] = useState<CategoryDefRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editCategoryIds, setEditCategoryIds] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newCategoryIds, setNewCategoryIds] = useState<string[]>([]);

  const load = async () => {
    try {
      const { definitions: defs, categories: cats, category_definitions: cd } = await getAdminDefinitions();
      setList((defs ?? []) as Definition[]);
      setCategories((cats ?? []) as Category[]);
      setCategoryDefs((cd ?? []) as CategoryDefRow[]);
    } catch {
      // keep previous list
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (row: Definition) => {
    await patchAdminDefinition(row.id, { is_active: !row.is_active });
    load();
  };

  const startEdit = (row: Definition) => {
    const ids = categoryDefs.filter((r) => r.definition_id === row.id).map((r) => r.category_id);
    setEditCategoryIds(ids);
    setEditLabel(row.label);
    setEditDescription(row.description ?? '');
    setEditingId(row.id);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await patchAdminDefinition(editingId, {
      label: editLabel,
      description: editDescription || null,
      category_ids: editCategoryIds,
    });
    setEditingId(null);
    load();
  };

  const addDefinition = async () => {
    if (!newLabel.trim()) return;
    await createAdminDefinition(newLabel.trim(), newCategoryIds);
    setAddOpen(false);
    setNewLabel('');
    setNewCategoryIds([]);
    load();
  };

  const remove = async (row: Definition) => {
    const msg = 'This definition may be used by questions and prompt_definitions. Delete anyway (cascade) or cancel to choose a replacement in a future version.';
    if (!confirm(msg)) return;
    await deleteAdminDefinition(row.id);
    load();
  };

  const ready = !loading;

  return (
    <div>
      <h1 className="page-title">Definitions</h1>

      {loading && <p>Loading…</p>}

      {ready && (
        <>
          <button type="button" onClick={() => setAddOpen(true)} className="btn-add">Add definition</button>

          {addOpen && (
            <div className="card">
              <h3>New definition</h3>
              <input
                placeholder="Label (e.g. فاعل)"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                className="input-wide"
              />
              <div className="form-row">Categories (optional, multiselect)</div>
              <select
                multiple
                value={newCategoryIds}
                onChange={(e) => setNewCategoryIds(Array.from(e.target.selectedOptions, (o) => o.value))}
                className="select-multi-md"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <div className="form-actions">
                <button type="button" onClick={addDefinition}>Save</button>
                <button type="button" onClick={() => { setAddOpen(false); setNewLabel(''); setNewCategoryIds([]); }} className="btn-cancel">Cancel</button>
              </div>
            </div>
          )}

          <ul className="item-list">
            {list.map((row) => (
              <li key={row.id}>
                <div className="item-row">
                  {editingId === row.id ? (
                    <>
                      <input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder="Label" className="inline-input" />
                      <input value={editDescription} onChange={(e) => setEditDescription(e.target.value)} placeholder="Description" className="inline-input" style={{ minWidth: 160 }} />
                      <select
                        multiple
                        value={editCategoryIds}
                        onChange={(e) => setEditCategoryIds(Array.from(e.target.selectedOptions, (o) => o.value))}
                        className="select-multi-sm"
                      >
                        {categories.map((c) => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                      <button type="button" onClick={saveEdit}>Save</button>
                      <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                    </>
                  ) : (
                    <>
                      <strong>{row.label}</strong>
                      <button type="button" onClick={() => toggleActive(row)}>{row.is_active ? 'Deactivate' : 'Activate'}</button>
                      <button type="button" onClick={() => startEdit(row)}>Edit</button>
                      <button type="button" onClick={() => remove(row)} className="btn-delete">Delete</button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
