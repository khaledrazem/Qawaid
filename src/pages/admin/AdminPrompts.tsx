import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  postAnalyze,
  postPromptDefinition,
  postAutoLink,
  postAdminAutoLinkAllStream,
  getAdminPrompts,
  createAdminPrompt,
  patchAdminPrompt,
  deleteAdminPrompt,
  deleteAdminPromptDefinitions,
  deleteAdminPromptDefinition,
} from '@/services/backendApi';
import type { AnalyzeWord } from '@/services/backendApi';
import { getWordSpanAt } from '@/lib/promptWords';
import type { Prompt, PromptDefinition, Definition } from '@/types/db';
import type { Difficulty } from '@/types/db';
import AdminPagination from './AdminPagination';

const PROMPTS_PAGE_SIZE = 50;

export default function AdminPrompts() {
  const [list, setList] = useState<(Prompt & { definitions?: PromptDefinition[] })[]>([]);
  const [definitions, setDefinitions] = useState<Definition[]>([]);
  const [listOffset, setListOffset] = useState(0);
  const [listTotal, setListTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [newText, setNewText] = useState('');
  const [newDifficulty, setNewDifficulty] = useState<Difficulty>('medium');
  const [linkDefOpen, setLinkDefOpen] = useState<string | null>(null);
  const [linkDefPromptText, setLinkDefPromptText] = useState('');
  const [linkDefWords, setLinkDefWords] = useState<AnalyzeWord[]>([]);
  const [linkDefWordIndex, setLinkDefWordIndex] = useState<number | null>(null);
  const [linkDefDefinitionId, setLinkDefDefinitionId] = useState('');
  const [linkDefSearch, setLinkDefSearch] = useState('');
  const [linkDefAnalyzing, setLinkDefAnalyzing] = useState(false);
  const [linkDefError, setLinkDefError] = useState<string | null>(null);
  const [editImageOpen, setEditImageOpen] = useState<string | null>(null);
  const [editImageUrl, setEditImageUrl] = useState('');
  const [editImageDefId, setEditImageDefId] = useState('');
  const [imageUploading, setImageUploading] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [autoLinkReplace, setAutoLinkReplace] = useState(false);
  const [autoLinking, setAutoLinking] = useState(false);
  const [autoLinkResult, setAutoLinkResult] = useState<string | null>(null);
  const [autoAddId, setAutoAddId] = useState<string | null>(null);
  const [autoAddMessage, setAutoAddMessage] = useState<string | null>(null);
  const [bulkAutoLinking, setBulkAutoLinking] = useState(false);
  const [bulkAutoLinkResult, setBulkAutoLinkResult] = useState<string | null>(null);
  const [bulkOnlyActive, setBulkOnlyActive] = useState(false);
  const [bulkReplace, setBulkReplace] = useState(false);
  const [expandedPromptId, setExpandedPromptId] = useState<string | null>(null);

  const applyPromptsResponse = (res: Awaited<ReturnType<typeof getAdminPrompts>>) => {
    const { prompts, prompt_definitions, definitions: defs } = res;
    setListTotal(res.total ?? 0);
    const byPrompt = (prompt_definitions ?? []).reduce<Record<string, PromptDefinition[]>>((acc, pd) => {
      const pid = (pd as { prompt_id: string }).prompt_id;
      if (!acc[pid]) acc[pid] = [];
      acc[pid].push(pd as unknown as PromptDefinition);
      return acc;
    }, {});
    setList((prompts ?? []).map((p) => ({ ...p, definitions: byPrompt[(p as { id: string }).id] ?? [] } as Prompt & { definitions?: PromptDefinition[] })));
    setDefinitions((defs ?? []) as unknown as Definition[]);
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getAdminPrompts({ limit: PROMPTS_PAGE_SIZE, offset: listOffset })
      .then((res) => {
        if (!alive) return;
        applyPromptsResponse(res);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [listOffset]);

  const reload = () => {
    setLoading(true);
    getAdminPrompts({ limit: PROMPTS_PAGE_SIZE, offset: listOffset })
      .then(applyPromptsResponse)
      .finally(() => setLoading(false));
  };

  const addPrompt = async () => {
    if (!newText.trim()) return;
    await createAdminPrompt(newText.trim(), newDifficulty);
    setAddOpen(false);
    setNewText('');
    if (listOffset !== 0) setListOffset(0);
    else reload();
  };

  const toggleActive = async (row: Prompt) => {
    await patchAdminPrompt(row.id, { is_active: !row.is_active });
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this prompt and its definition links?')) return;
    await deleteAdminPrompt(id);
    reload();
  };

  const openLinkDef = async (promptId: string, promptText: string) => {
    setLinkDefOpen(promptId);
    setLinkDefPromptText(promptText);
    setLinkDefWordIndex(null);
    setLinkDefDefinitionId('');
    setLinkDefSearch('');
    setLinkDefError(null);
    setAutoLinkResult(null);
    setAutoLinkReplace(false);
    setLinkDefWords([]);
    setLinkDefAnalyzing(true);
    try {
      const res = await postAnalyze(promptText);
      setLinkDefWords(res.words ?? []);
    } catch (e) {
      setLinkDefError(e instanceof Error ? e.message : 'Analyze failed');
    } finally {
      setLinkDefAnalyzing(false);
    }
  };

  const runAutoDetect = async () => {
    if (!linkDefOpen) return;
    setAutoLinking(true);
    setAutoLinkResult(null);
    setLinkDefError(null);
    try {
      const res = await postAutoLink(linkDefOpen, autoLinkReplace);
      await reload();
      const n = res.created?.length ?? 0;
      setAutoLinkResult(n > 0 ? `Created ${n} link(s). Review below and remove or add as needed.` : 'No new links added (merge kept existing).');
    } catch (e) {
      setLinkDefError(e instanceof Error ? e.message : 'Auto-detect failed');
    } finally {
      setAutoLinking(false);
    }
  };

  const runAutoLinkAllPrompts = async () => {
    const msg =
      'Run auto-detect (CAMeL) on all prompts? New links are merged: existing span+definition pairs are kept. Duplicates are skipped.\n\n' +
      'The request stays open until all batches finish (needed so the server keeps processing).\n\n' +
      (bulkReplace
        ? 'Replace mode is ON: existing links on each prompt will be removed before re-adding.'
        : 'Replace mode is OFF: only new links are added.');
    if (!confirm(msg)) return;
    setBulkAutoLinking(true);
    setBulkAutoLinkResult('Starting…');
    try {
      await postAdminAutoLinkAllStream(
        { replace: bulkReplace, only_active: bulkOnlyActive },
        (evt) => {
          if (evt.status === 'noop') {
            setBulkAutoLinkResult(String((evt as { message?: string }).message ?? 'Nothing to process'));
            return;
          }
          const ev = evt.event as string | undefined;
          if (ev === 'started') {
            const n = evt.prompt_count as number;
            const tb = evt.total_batches as number;
            setBulkAutoLinkResult(`Running ${n} prompts in ${tb} batches (keep this tab open)…`);
          } else if (ev === 'batch') {
            const bi = evt.batch_index as number;
            const tb = evt.total_batches as number;
            const lt = evt.links_this_batch as number;
            const tot = evt.links_total as number;
            const errN = evt.errors_total as number;
            const sec = evt.elapsed_sec as number;
            const line = `Batch ${bi}/${tb}: +${lt} links this batch (total ${tot} links, ${errN} prompt errors) — ${sec}s elapsed`;
            setBulkAutoLinkResult(line);
            console.info('[auto-link-all]', line);
          } else if (ev === 'complete') {
            const tot = evt.links_total as number;
            const errs = (evt.errors as unknown[])?.length ?? 0;
            const sec = evt.elapsed_sec as number;
            setBulkAutoLinkResult(
              `Finished: ${tot} new links, ${errs} prompt-level errors, ${sec}s total. Refreshing list…`,
            );
            console.info('[auto-link-all] complete', evt);
          } else if (ev === 'error' || ev === 'fatal') {
            const detail = (evt.detail as string) || (evt.error as string) || JSON.stringify(evt);
            setBulkAutoLinkResult(`Stopped: ${detail}`);
            console.error('[auto-link-all]', evt);
          }
        },
      );
      await reload();
    } catch (e) {
      setBulkAutoLinkResult(e instanceof Error ? e.message : 'Bulk auto-link failed');
    } finally {
      setBulkAutoLinking(false);
    }
  };

  const runAutoAddFromGrid = async (promptId: string) => {
    setAutoAddId(promptId);
    setAutoAddMessage(null);
    try {
      const res = await postAutoLink(promptId, false);
      await reload();
      const n = res.created?.length ?? 0;
      setAutoAddMessage(n > 0 ? `Added ${n} link(s) to this prompt.` : 'No new links (merge kept existing).');
      setTimeout(() => setAutoAddMessage(null), 4000);
    } catch (e) {
      setAutoAddMessage(e instanceof Error ? e.message : 'Auto-add failed');
      setTimeout(() => setAutoAddMessage(null), 4000);
    } finally {
      setAutoAddId(null);
    }
  };

  const removeAllPromptDefs = async () => {
    if (!linkDefOpen || !confirm('Remove all definition links from this prompt? You can re-run Auto-detect or add manually.')) return;
    await deleteAdminPromptDefinitions(linkDefOpen);
    await reload();
    setAutoLinkResult('All links removed.');
  };

  const saveLinkDef = async () => {
    if (!linkDefOpen || linkDefWordIndex === null || !linkDefDefinitionId) return;
    try {
      await postPromptDefinition(linkDefOpen, {
        wordIndex: linkDefWordIndex,
        definitionId: linkDefDefinitionId,
        is_letter: false,
      });
      setLinkDefOpen(null);
      reload();
    } catch (e) {
      setLinkDefError(e instanceof Error ? e.message : 'Save failed');
    }
  };

  const openEditImage = (row: Prompt) => {
    setEditImageOpen(row.id);
    setEditImageUrl(row.image_url ?? '');
    setEditImageDefId(row.definition_id ?? '');
    setImageUploadError(null);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editImageOpen) return;
    setImageUploading(true);
    setImageUploadError(null);
    try {
      const ext = file.name.split('.').pop() || 'jpg';
      const path = `${editImageOpen}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('prompt-images').upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('prompt-images').getPublicUrl(path);
      setEditImageUrl(publicUrl);
    } catch (err) {
      setImageUploadError(err instanceof Error ? err.message : 'Upload failed. Ensure bucket "prompt-images" exists and is public.');
    } finally {
      setImageUploading(false);
      e.target.value = '';
    }
  };

  const saveEditImage = async () => {
    if (!editImageOpen) return;
    await patchAdminPrompt(editImageOpen, {
      image_url: editImageUrl.trim() || undefined,
      definition_id: editImageDefId || undefined,
    });
    setEditImageOpen(null);
    reload();
  };

  const removePromptDef = async (promptDefId: string) => {
    if (!confirm('Remove this definition link from the prompt?')) return;
    await deleteAdminPromptDefinition(promptDefId);
    reload();
  };

  const currentPromptLinks = linkDefOpen ? list.find((r) => r.id === linkDefOpen)?.definitions ?? [] : [];
  const promptTextForModal = linkDefOpen ? list.find((r) => r.id === linkDefOpen)?.prompt_text ?? linkDefPromptText : '';

  const filteredDefs = linkDefSearch.trim()
    ? definitions.filter((d) => d.label.toLowerCase().includes(linkDefSearch.toLowerCase()))
    : definitions;

  const ready = !loading;

  return (
    <div>
      <h1 className="page-title">Prompts</h1>
      <p className="page-subtitle">
        Use Edit to link definitions to words. Click a word then select definition, or use Auto-detect (CAMeL) to suggest links for all words.
      </p>

      {loading && <p>Loading…</p>}

      {ready && (
        <>
          <div className="admin-prompts-toolbar" style={{ marginBottom: 16, display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
            <button type="button" onClick={() => setAddOpen(true)} className="btn-add">Add prompt</button>
            <span className="text-muted">|</span>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={bulkOnlyActive}
                onChange={(e) => setBulkOnlyActive(e.target.checked)}
              />
              Only active prompts
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <input
                type="checkbox"
                checked={bulkReplace}
                onChange={(e) => setBulkReplace(e.target.checked)}
              />
              Replace links per prompt (clear then re-detect)
            </label>
            <button
              type="button"
              onClick={runAutoLinkAllPrompts}
              disabled={bulkAutoLinking}
              className="btn-add"
              title="Add CAMeL-detected definition links for every prompt; merges with existing unless Replace is checked"
            >
              {bulkAutoLinking ? 'Auto-linking all…' : 'Auto-link all prompts'}
            </button>
          </div>
          {bulkAutoLinkResult && (
            <p className="text-muted" style={{ marginBottom: 12 }}>{bulkAutoLinkResult}</p>
          )}

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
              <button type="button" onClick={() => addPrompt()}>Save</button>
              <button type="button" onClick={() => { setAddOpen(false); setNewText(''); }} className="btn-cancel">Cancel</button>
            </div>
          )}

          {autoAddMessage && (
            <p className="text-muted" style={{ marginBottom: 8 }}>{autoAddMessage}</p>
          )}
          <AdminPagination
            offset={listOffset}
            limit={PROMPTS_PAGE_SIZE}
            total={listTotal}
            onOffsetChange={setListOffset}
          />
          <ul className="item-list">
            {list.map((row) => (
              <li key={row.id} className="padded">
                <div className="item-row spaced">
                  <strong className="item-name">{row.prompt_text}</strong>
                  <span className="text-muted">{row.difficulty}</span>
                  {row.image_url && <span className="text-muted" title="Visual prompt">🖼</span>}
                  {(!row.definitions || row.definitions.length === 0) && !row.image_url && (
                    <span title="Prompt has no definitions linked" className="text-warning">⚠ No definitions</span>
                  )}
                  <button type="button" onClick={() => toggleActive(row)}>{row.is_active ? 'Deactivate' : 'Activate'}</button>
                  <button type="button" onClick={() => openEditImage(row)} className="btn-sm">Image / definition</button>
                  <button
                    type="button"
                    onClick={() => runAutoAddFromGrid(row.id)}
                    disabled={autoAddId !== null}
                    className="btn-sm btn-add"
                    title="Auto-add definition links (CAMeL) without opening Edit"
                  >
                    {autoAddId === row.id ? 'Adding…' : 'Auto-add'}
                  </button>
                  <button type="button" onClick={() => openLinkDef(row.id, row.prompt_text)}>Edit</button>
                  <button type="button" onClick={() => remove(row.id)} className="btn-delete">Delete</button>
                </div>
                {(row.definitions?.length ?? 0) > 0 && (
                  <>
                    <button
                      type="button"
                      className="prompt-expand-btn"
                      onClick={() => setExpandedPromptId((id) => (id === row.id ? null : row.id))}
                      aria-expanded={expandedPromptId === row.id}
                    >
                      <span className="prompt-expand-icon">{expandedPromptId === row.id ? '▼' : '▶'}</span>
                      {row.definitions!.length} definition{row.definitions!.length !== 1 ? 's' : ''}
                    </button>
                    {expandedPromptId === row.id && (
                      <ul className="prompt-defs">
                        {row.definitions!.map((pd) => {
                          const def = definitions.find((d) => d.id === pd.definition_id);
                          const slice = pd.is_letter
                            ? row.prompt_text[pd.index_start]
                            : pd.index_end != null
                              ? row.prompt_text.slice(pd.index_start, pd.index_end)
                              : getWordSpanAt(row.prompt_text, pd.index_start)?.word ?? row.prompt_text.slice(pd.index_start).split(/\s/)[0];
                          return (
                            <li key={pd.id}>
                              {slice} → {def?.label ?? pd.definition_id}
                              <button type="button" onClick={() => removePromptDef(pd.id)} className="btn-sm">Remove</button>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
          <AdminPagination
            offset={listOffset}
            limit={PROMPTS_PAGE_SIZE}
            total={listTotal}
            onOffsetChange={setListOffset}
          />

          {linkDefOpen && (
            <div className="modal-overlay">
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3>Link definition to prompt</h3>
                <p className="text-muted">Use Auto-detect to link all words at once (by label and CAMeL morphology), or click a word below and pick a definition to add one link.</p>

                <div className="form-row" style={{ marginBottom: 12 }}>
                  <button
                    type="button"
                    onClick={runAutoDetect}
                    disabled={linkDefAnalyzing || autoLinking}
                    className="btn-add"
                  >
                    {autoLinking ? 'Detecting…' : 'Auto-detect definitions'}
                  </button>
                  <label style={{ marginLeft: 12 }}>
                    <input type="checkbox" checked={autoLinkReplace} onChange={(e) => setAutoLinkReplace(e.target.checked)} />
                    {' '}Replace all (otherwise merge with existing)
                  </label>
                </div>
                {autoLinkResult && <p className="text-muted">{autoLinkResult}</p>}

                <h4 style={{ marginTop: 16, marginBottom: 8 }}>Current links</h4>
                {currentPromptLinks.length > 0 ? (
                  <>
                    <button type="button" onClick={removeAllPromptDefs} className="btn-sm btn-cancel" style={{ marginBottom: 8 }}>
                      Remove all links
                    </button>
                    <ul className="prompt-defs" style={{ marginBottom: 16 }}>
                      {currentPromptLinks.map((pd) => {
                        const def = definitions.find((d) => d.id === pd.definition_id);
                        const slice = pd.is_letter
                          ? promptTextForModal[pd.index_start]
                          : pd.index_end != null
                            ? promptTextForModal.slice(pd.index_start, pd.index_end)
                            : getWordSpanAt(promptTextForModal, pd.index_start)?.word ?? promptTextForModal.slice(pd.index_start).split(/\s/)[0];
                        return (
                          <li key={pd.id}>
                            {slice} → {def?.label ?? pd.definition_id}
                            <button type="button" onClick={() => removePromptDef(pd.id)} className="btn-sm">Remove</button>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                ) : (
                  <p className="text-muted" style={{ marginBottom: 16 }}>No links yet. Use Auto-detect or add manually below.</p>
                )}

                <h4 style={{ marginBottom: 8 }}>Add a link manually</h4>
                {linkDefAnalyzing && <p className="text-muted">Analyzing…</p>}
                {linkDefError && <p className="text-error">{linkDefError}</p>}
                {!linkDefAnalyzing && linkDefWords.length > 0 && (
                  <>
                    <div className="prompt-picker">
                      {linkDefWords.map((w, i) => (
                        <span key={w.start}>
                          {i > 0 && ' '}
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={() => setLinkDefWordIndex(i)}
                            onKeyDown={(e) => e.key === 'Enter' && setLinkDefWordIndex(i)}
                            className={`prompt-word${linkDefWordIndex === i ? ' selected' : ''}`}
                          >
                            {w.word}
                          </span>
                        </span>
                      ))}
                    </div>
                  </>
                )}
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
                  <button type="button" onClick={saveLinkDef} disabled={linkDefWordIndex === null || !linkDefDefinitionId}>Save link</button>
                  <button type="button" onClick={() => setLinkDefOpen(null)} className="btn-cancel">Cancel</button>
                </div>
              </div>
            </div>
          )}

          {editImageOpen && (
            <div className="modal-overlay">
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <h3>Prompt image &amp; definition (visual MCQ)</h3>
                <div className="form-row">
                  <label>Upload image</label>
                  <input type="file" accept="image/*" onChange={handleImageUpload} disabled={imageUploading} />
                  {imageUploading && <span className="text-muted">Uploading…</span>}
                  {imageUploadError && <span className="text-error">{imageUploadError}</span>}
                </div>
                <div className="form-row">
                  <label>Or image URL</label>
                  <input value={editImageUrl} onChange={(e) => setEditImageUrl(e.target.value)} placeholder="https://…" className="input-full" />
                </div>
                <div className="form-row">
                  <label>Definition (for whole image)</label>
                  <select value={editImageDefId} onChange={(e) => setEditImageDefId(e.target.value)}>
                    <option value="">—</option>
                    {definitions.map((d) => (
                      <option key={d.id} value={d.id}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div className="modal-actions">
                  <button type="button" onClick={saveEditImage}>Save</button>
                  <button type="button" onClick={() => setEditImageOpen(null)} className="btn-cancel">Cancel</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
