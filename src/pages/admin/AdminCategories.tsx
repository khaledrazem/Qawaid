import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
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
    const [catRes, defRes, cdRes] = await Promise.all([
      supabase.from('categories').select('*').order('name'),
      supabase.from('definitions').select('*').order('label'),
      supabase.from('category_definitions').select('category_id, definition_id'),
    ]);
    if (catRes.error || defRes.error || cdRes.error) return;
    const cdData = (cdRes.data ?? []) as CategoryDefinitionRow[];
    setCategoryDefs(cdData);
    const defCount = cdData.reduce<Record<string, number>>((acc, row) => {
      acc[row.category_id] = (acc[row.category_id] ?? 0) + 1;
      return acc;
    }, {});
    setList((catRes.data ?? []).map((c) => ({ ...c, definition_count: defCount[c.id] ?? 0 })));
    setDefinitions(defRes.data ?? []);
    setLoading(false);
  };

  const getDefinitionLabelsForCategory = (categoryId: string): string[] => {
    const defIds = categoryDefs.filter((r) => r.category_id === categoryId).map((r) => r.definition_id);
    return defIds.map((id) => definitions.find((d) => d.id === id)?.label ?? id).filter(Boolean) as string[];
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (row: Category) => {
    await supabase.from('categories').update({ is_active: !row.is_active }).eq('id', row.id);
    load();
  };

  const startEdit = (row: Category) => {
    setEditingId(row.id);
    setEditName(row.name);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await supabase.from('categories').update({ name: editName }).eq('id', editingId);
    setEditingId(null);
    load();
  };

  const addCategory = async () => {
    if (!newName.trim()) return;
    const { data } = await supabase.from('categories').insert({ name: newName.trim() }).select('id').single();
    if (data && newDefIds.length) {
      await supabase.from('category_definitions').insert(
        newDefIds.map((definition_id) => ({ category_id: data.id, definition_id }))
      );
    }
    setAddOpen(false);
    setNewName('');
    setNewDefIds([]);
    load();
  };

  const openAssign = async (categoryId: string) => {
    const { data } = await supabase.from('category_definitions').select('definition_id').eq('category_id', categoryId);
    setAssignDefIds((data ?? []).map((r) => r.definition_id));
    setAssignDefOpen(categoryId);
  };

  const saveAssign = async () => {
    if (!assignDefOpen) return;
    await supabase.from('category_definitions').delete().eq('category_id', assignDefOpen);
    if (assignDefIds.length) {
      await supabase.from('category_definitions').insert(
        assignDefIds.map((definition_id) => ({ category_id: assignDefOpen, definition_id }))
      );
    }
    setAssignDefOpen(null);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this category? Questions and lessons may reference it.')) return;
    await supabase.from('category_definitions').delete().eq('category_id', id);
    await supabase.from('categories').delete().eq('id', id);
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

