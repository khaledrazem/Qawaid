import { useEffect, useState } from 'react';
import {
  getAdminQuestions,
  createAdminQuestion,
  patchAdminQuestion,
  deleteAdminQuestion,
} from '@/services/backendApi';
import type { Question, Category } from '@/types/db';
import type { QuestionType } from '@/types/db';

export default function AdminQuestions() {
  const [list, setList] = useState<Question[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    question_text: '',
    category_id: '',
    type: 'MCQ' as QuestionType,
    is_active: true,
  });

  const load = async () => {
    try {
      const { questions: qs, categories: cats } = await getAdminQuestions();
      setList((qs ?? []) as unknown as Question[]);
      setCategories((cats ?? []) as unknown as Category[]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openAdd = () => {
    setAddOpen(true);
    setEditingId(null);
    setForm({
      question_text: '',
      category_id: categories[0]?.id ?? '',
      type: 'MCQ',
      is_active: true,
    });
  };

  const openEdit = (row: Question) => {
    setEditingId(row.id);
    setAddOpen(false);
    setForm({
      question_text: row.question_text,
      category_id: row.category_id,
      type: row.type,
      is_active: row.is_active,
    });
  };

  const save = async () => {
    if (!form.question_text.trim() || !form.category_id) return;
    const payload = {
      question_text: form.question_text.trim(),
      category_id: form.category_id,
      type: form.type,
      is_active: form.is_active,
    };
    if (editingId) {
      await patchAdminQuestion(editingId, payload);
    } else {
      await createAdminQuestion(payload);
    }
    setAddOpen(false);
    setEditingId(null);
    load();
  };

  const toggleActive = async (row: Question) => {
    await patchAdminQuestion(row.id, { is_active: !row.is_active });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this question?')) return;
    await deleteAdminQuestion(id);
    load();
  };

  const ready = !loading;

  return (
    <div>
      <h1 className="page-title">Questions</h1>
      <p className="page-subtitle">
        MCQ requires category with ≥4 definitions. Correct answer is derived from prompt_definitions when building a question.
      </p>

      {loading && <p>Loading…</p>}

      {ready && (
        <>
          <button type="button" onClick={openAdd} className="btn-add">Add question</button>

          {(addOpen || editingId) && (
            <div className="card">
              <h3>{editingId ? 'Edit question' : 'New question'}</h3>
              <div className="form-row">
                <label>Question text </label>
                <input
                  value={form.question_text}
                  onChange={(e) => setForm((f) => ({ ...f, question_text: e.target.value }))}
                  placeholder="e.g. أي كلمة في الجملة هي {definition}؟"
                  className="input-full"
                />
                <span className="placeholder-hint">
                  Use <code>{'{definition}'}</code> — replaced at runtime with the definition label.
                </span>
              </div>
              <div className="form-row">
                <label>Category </label>
                <select
                  value={form.category_id}
                  onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                >
                  <option value="">Select category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-row">
                <label>Type </label>
                <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as QuestionType }))}>
                  <option value="MCQ">MCQ</option>
                  <option value="click_word">click_word</option>
                  <option value="click_letter">click_letter</option>
                  <option value="click_letter_range">click_letter_range</option>
                  <option value="yes_no">yes_no</option>
                  <option value="fill_in_sentence">fill_in_sentence</option>
                  <option value="transformation">transformation</option>
                  <option value="mcq_fillin">mcq_fillin</option>
                  <option value="visual_mcq">visual_mcq</option>
                  <option value="drag_and_match">drag_and_match</option>
                </select>
              </div>
              <p className="correct-answer-hint">
                Correct answer is derived from prompt_definitions when building a question (the definition linked to the word/letter being quizzed).
              </p>
              <div className="form-row">
                <label>
                  <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
                  {' '}Active
                </label>
              </div>
              <button type="button" onClick={save}>Save</button>
              <button type="button" onClick={() => { setAddOpen(false); setEditingId(null); }} className="btn-cancel">Cancel</button>
            </div>
          )}

          <ul className="item-list">
            {list.map((row) => {
              const cat = categories.find((c) => c.id === row.category_id);
              return (
                <li key={row.id}>
                  <div className="item-row">
                    <strong className="item-name">{row.question_text}</strong>
                    <span className="text-muted">{row.type}</span>
                    <span>{cat?.name}</span>
                    <button type="button" onClick={() => toggleActive(row)}>{row.is_active ? 'Deactivate' : 'Activate'}</button>
                    <button type="button" onClick={() => openEdit(row)}>Edit</button>
                    <button type="button" onClick={() => remove(row.id)} className="btn-delete">Delete</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
