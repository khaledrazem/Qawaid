import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Definition, Category } from '@/types/db';

export default function AdminDefinitions() {
  const [list, setList] = useState<Definition[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editCategoryIds, setEditCategoryIds] = useState<string[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newCategoryIds, setNewCategoryIds] = useState<string[]>([]);

  const load = async () => {
    const [defRes, catRes] = await Promise.all([
      supabase.from('definitions').select('*').order('label'),
      supabase.from('categories').select('*').order('name'),
    ]);
    if (defRes.error || catRes.error) return;
    setList(defRes.data ?? []);
    setCategories(catRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const toggleActive = async (row: Definition) => {
    await supabase.from('definitions').update({ is_active: !row.is_active }).eq('id', row.id);
    load();
  };

  const startEdit = async (row: Definition) => {
    const { data } = await supabase.from('category_definitions').select('category_id').eq('definition_id', row.id);
    setEditCategoryIds((data ?? []).map((r) => r.category_id));
    setEditLabel(row.label);
    setEditingId(row.id);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await supabase.from('definitions').update({ label: editLabel }).eq('id', editingId);
    await supabase.from('category_definitions').delete().eq('definition_id', editingId);
    if (editCategoryIds.length) {
      await supabase.from('category_definitions').insert(
        editCategoryIds.map((category_id) => ({ category_id, definition_id: editingId }))
      );
    }
    setEditingId(null);
    load();
  };

  const addDefinition = async () => {
    if (!newLabel.trim()) return;
    const { data } = await supabase.from('definitions').insert({ label: newLabel.trim() }).select('id').single();
    if (data && newCategoryIds.length) {
      await supabase.from('category_definitions').insert(
        newCategoryIds.map((category_id) => ({ category_id, definition_id: data.id }))
      );
    }
    setAddOpen(false);
    setNewLabel('');
    setNewCategoryIds([]);
    load();
  };

  const remove = async (row: Definition) => {
    const msg = 'This definition may be used by questions and prompt_definitions. Delete anyway (cascade) or cancel to choose a replacement in a future version.';
    if (!confirm(msg)) return;
    await supabase.from('category_definitions').delete().eq('definition_id', row.id);
    await supabase.from('prompt_definitions').delete().eq('definition_id', row.id);
    await supabase.from('questions').delete().eq('correct_definition_id', row.id);
    await supabase.from('definitions').delete().eq('id', row.id);
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
