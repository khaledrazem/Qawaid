import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Prompt, PromptDefinition, Definition } from '@/types/db';
import type { Difficulty } from '@/types/db';

export default function AdminPrompts() {
  const [list, setList] = useState<(Prompt & { definitions?: PromptDefinition[] })[]>([]);
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newText, setNewText] = useState('');
  const [newDifficulty, setNewDifficulty] = useState<Difficulty>('medium');
  const [linkDefOpen, setLinkDefOpen] = useState<string | null>(null);
  const [linkDefPromptText, setLinkDefPromptText] = useState('');
  const [linkDefIsLetter, setLinkDefIsLetter] = useState(false);
  const [linkDefIndex, setLinkDefIndex] = useState<number | null>(null);
  const [linkDefDefinitionId, setLinkDefDefinitionId] = useState('');
  const [linkDefSearch, setLinkDefSearch] = useState('');

  const load = async () => {
    const [promptRes, pdRes, defRes] = await Promise.all([
      supabase.from('prompts').select('*').order('created_at', { ascending: false }),
      supabase.from('prompt_definitions').select('*'),
      supabase.from('definitions').select('*').order('label'),
    ]);
    if (promptRes.error || pdRes.error || defRes.error) return;
    const byPrompt = (pdRes.data ?? []).reduce<Record<string, PromptDefinition[]>>((acc, pd) => {
      if (!acc[pd.prompt_id]) acc[pd.prompt_id] = [];
      acc[pd.prompt_id].push(pd);
      return acc;
    }, {});
    setList((promptRes.data ?? []).map((p) => ({ ...p, definitions: byPrompt[p.id] ?? [] })));
    setDefinitions(defRes.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const addPrompt = async () => {
    if (!newText.trim()) return;
    await supabase.from('prompts').insert({ prompt_text: newText.trim(), difficulty: newDifficulty });
    setAddOpen(false);
    setNewText('');
    load();
  };

  const toggleActive = async (row: Prompt) => {
    await supabase.from('prompts').update({ is_active: !row.is_active }).eq('id', row.id);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this prompt and its definition links?')) return;
    await supabase.from('prompt_definitions').delete().eq('prompt_id', id);
    await supabase.from('prompts').delete().eq('id', id);
    load();
  };

  const openLinkDef = (promptId: string, promptText: string) => {
    setLinkDefOpen(promptId);
    setLinkDefPromptText(promptText);
    setLinkDefIsLetter(false);
    setLinkDefIndex(null);
    setLinkDefDefinitionId('');
    setLinkDefSearch('');
  };

  const getSplicedWord = (text: string, start: number): string => {
    const sub = text.slice(start);
    return sub.split(' ')[0]
   
  };

  const handlePromptClick = (index: number) => {
    setLinkDefIndex(index);
  };

  const saveLinkDef = async () => {
    if (!linkDefOpen || linkDefIndex === null || !linkDefDefinitionId) return;
    await supabase.from('prompt_definitions').insert({
      prompt_id: linkDefOpen,
      definition_id: linkDefDefinitionId,
      index_start: linkDefIndex,
      is_letter: linkDefIsLetter,
    });
    setLinkDefOpen(null);
    load();
  };

  const removePromptDef = async (promptDefId: string) => {
    if (!confirm('Remove this definition link from the prompt?')) return;
    await supabase.from('prompt_definitions').delete().eq('id', promptDefId);
    load();
  };

  const filteredDefs = linkDefSearch.trim()
    ? definitions.filter((d) => d.label.toLowerCase().includes(linkDefSearch.toLowerCase()))
    : definitions;

  const ready = !loading;

  return (
    <div>
      <h1 className="page-title">Prompts</h1>
      <p className="page-subtitle">
        Prompt text cannot be edited after creation. Add definitions by linking a word or letter (click on the prompt).
      </p>

      {loading && <p>Loading…</p>}

      {ready && (
        <>
          <button type="button" onClick={() => setAddOpen(true)} className="btn-add">Add prompt</button>

          {addOpen && (
            <div className="card">
              <h3>New prompt</h3>
              <textarea
                placeholder="Prompt text (e.g. جلس الولد)"
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                rows={3}
              />
              <div className="form-row">
                <label>Difficulty </label>
                <select value={newDifficulty} onChange={(e) => setNewDifficulty(e.target.value as Difficulty)}>
                  <option value="easy">easy</option>
                  <option value="medium">medium</option>
                  <option value="hard">hard</option>
                </select>
              </div>
              <button type="button" onClick={addPrompt}>Save</button>
              <button type="button" onClick={() => { setAddOpen(false); setNewText(''); }} className="btn-cancel">Cancel</button>
            </div>
          )}

          <ul className="item-list">
            {list.map((row) => (
              <li key={row.id} className="padded">
                <div className="item-row spaced">
                  <strong className="item-name">{row.prompt_text}</strong>
                  <span className="text-muted">{row.difficulty}</span>
                  {(!row.definitions || row.definitions.length === 0) && (
                    <span title="Prompt has no definitions linked" className="text-warning">⚠ No definitions</span>
                  )}
                  <button type="button" onClick={() => toggleActive(row)}>{row.is_active ? 'Deactivate' : 'Activate'}</button>
                  <button type="button" onClick={() => openLinkDef(row.id, row.prompt_text)}>Add definition link</button>
                  <button type="button" onClick={() => remove(row.id)} className="btn-delete">Delete</button>
                </div>
                {row.definitions && row.definitions.length > 0 && (
                  <ul className="prompt-defs">
                    {row.definitions.map((pd) => {
                      const def = definitions.find((d) => d.id === pd.definition_id);
                      console.log(pd)
                      console.log(row)

                      const slice = pd.is_letter
                        ? row.prompt_text[pd.index_start]
                        :  getSplicedWord(row.prompt_text, pd.index_start);
                      return (
                        <li key={pd.id}>
                         {slice} → {def?.label ?? pd.definition_id}
                          <button type="button" onClick={() => removePromptDef(pd.id)} className="btn-sm">Remove</button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            ))}
          </ul>

          {linkDefOpen && (
            <div className="modal-overlay">
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3>Link definition to prompt</h3>
                <label>
                  <input type="checkbox" checked={linkDefIsLetter} onChange={(e) => setLinkDefIsLetter(e.target.checked)} />
                  {' '}Select by letter (otherwise by word)
                </label>
                <p>Click a {linkDefIsLetter ? 'character' : 'word start'} in the prompt:</p>
                <div className="prompt-picker">
                  {linkDefIsLetter
                    ? linkDefPromptText.split('').map((char, i) => (
                        <span
                          key={i}
                          role="button"
                          tabIndex={0}
                          onClick={() => handlePromptClick(i)}
                          onKeyDown={(e) => e.key === 'Enter' && handlePromptClick(i)}
                          className={`prompt-char${linkDefIndex === i ? ' selected' : ''}`}
                        >
                          {char}
                        </span>
                      ))
                    : (() => {
                        const parts: { start: number; word: string }[] = [];
                        let start = 0;
                        const spaceOrPunct = /[\s,.;:!?]/;
                        for (let i = 0; i <= linkDefPromptText.length; i++) {
                          if (i === linkDefPromptText.length || spaceOrPunct.test(linkDefPromptText[i])) {
                            if (i > start) parts.push({ start, word: linkDefPromptText.slice(start, i) });
                            start = i + 1;
                          }
                        }
                        return parts.map(({ start, word }) => (
                          <span
                            key={start}
                            role="button"
                            tabIndex={0}
                            onClick={() => handlePromptClick(start)}
                            onKeyDown={(e) => e.key === 'Enter' && handlePromptClick(start)}
                            className={`prompt-word${linkDefIndex === start ? ' selected' : ''}`}
                          >
                            {word}
                          </span>
                        ));
                      })()}
                </div>
                <div className="form-row">
                  <input
                    placeholder="Search definition..."
                    value={linkDefSearch}
                    onChange={(e) => setLinkDefSearch(e.target.value)}
                    className="def-search"
                  />
                  <select
                    size={6}
                    value={linkDefDefinitionId}
                    onChange={(e) => setLinkDefDefinitionId(e.target.value)}
                    className="def-select"
                  >
                    <option value="">Select definition</option>
                    {filteredDefs.map((d) => (
                      <option key={d.id} value={d.id}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div className="modal-actions">
                  <button type="button" onClick={saveLinkDef} disabled={linkDefIndex === null || !linkDefDefinitionId}>Save link</button>
                  <button type="button" onClick={() => setLinkDefOpen(null)} className="btn-cancel">Cancel</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
