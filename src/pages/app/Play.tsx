import { useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from '@/hooks/useTranslation';
import { useAuth } from '@/contexts/AuthContext';
import { useQuestionBatch } from '@/hooks/useQuestionBatch';
import { SESSION } from '@/services/config';
import {
  createSession,
  answerCorrect,
  answerIncorrect,
  isSessionOver,
  buildSummary,
} from '@/services/sessionManager';
import type { SessionState } from '@/services/sessionManager';
import type { QuestionDTO } from '@/types/dto';
import { getPromptWords } from '@/lib/promptWords';
import { BackgroundPattern, TextureOverlay } from '@/components/Decorative';

type Feedback = { type: 'correct' | 'incorrect' } | null;

export default function Play() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { loading, empty, authRequired, current, advance } = useQuestionBatch();

  const [session, setSession] = useState<SessionState>(createSession);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [exitConfirm, setExitConfirm] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportComment, setReportComment] = useState('');
  const [reportSending, setReportSending] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [clickedIndex, setClickedIndex] = useState<number | null>(null);
  const [pendingSessionOver, setPendingSessionOver] = useState(false);
  const [questionKey, setQuestionKey] = useState(0); // triggers re-animation on new question
  const justLostIndex = useRef<number | null>(null); // heart index that was just lost

  /* ---- Advance to next question (or finish) ---- */
  const doAdvance = useCallback(async () => {
    if (pendingSessionOver) {
      navigate('/finish', { state: { summary: buildSummary(session) } });
      return;
    }
    setFeedback(null);
    setSelectedAnswer(null);
    setClickedIndex(null);
    justLostIndex.current = null;
    await advance();
    setQuestionKey((k) => k + 1); // trigger entrance animation
  }, [pendingSessionOver, session, advance, navigate]);

  /* ---- Handle answer selection ---- */
  const handleAnswer = useCallback(
    async (answerId: string, question: QuestionDTO) => {
      if (feedback) return; // block double-tap

      const isCorrect = answerId === question.correctAnswer.id;
      setSelectedAnswer(answerId);

      let next: SessionState;
      if (isCorrect) {
        next = answerCorrect(session, question.difficulty);
        setFeedback({ type: 'correct' });
        justLostIndex.current = null;
      } else {
        // Track which heart index is being lost (0-indexed, lives are right-to-left)
        justLostIndex.current = session.livesRemaining - 1;
        next = answerIncorrect(session, question.categoryId);
        setFeedback({ type: 'incorrect' });
      }

      setSession(next);

      if (isCorrect) {
        // Auto-advance after brief pause on correct
        await new Promise((r) => setTimeout(r, 900));

        if (isSessionOver(next)) {
          navigate('/finish', { state: { summary: buildSummary(next) } });
          return;
        }

        setFeedback(null);
        setSelectedAnswer(null);
        setClickedIndex(null);
        await advance();
        setQuestionKey((k) => k + 1);
      } else {
        // Incorrect: wait for user to click "Continue"
        if (isSessionOver(next)) {
          setPendingSessionOver(true);
        }
      }
    },
    [session, feedback, advance, navigate],
  );

  /* ---- Handle click on prompt word/letter ---- */
  const handleClickTarget = useCallback(
    (index: number, wordLength: number, question: QuestionDTO) => {
      if (feedback) return;
      setClickedIndex(index);

      const end = question.indexEnd != null && question.indexEnd > question.indexStart ? question.indexEnd : question.indexStart + 1;
      const isCorrect = question.isLetter
        ? (index >= question.indexStart && index < end)
        : question.indexStart >= index && question.indexStart < index + wordLength;
      const answerId = isCorrect ? question.correctAnswer.id : '__wrong__';
      handleAnswer(answerId, question);
    },
    [feedback, handleAnswer],
  );

  /* ---- Exit confirmation ---- */
  const handleExit = () => {
    if (exitConfirm) {
      navigate('/finish', { state: { summary: buildSummary(session) } });
    } else {
      setExitConfirm(true);
    }
  };

  const cancelExit = () => setExitConfirm(false);

  const submitReport = useCallback(async () => {
    if (!current?.promptId || !reportComment.trim() || !user?.id) return;
    setReportSending(true);
    try {
      const { postQuestionReport } = await import('@/services/backendApi');
      await postQuestionReport({
        prompt_id: current.promptId,
        definition_id: current.correctAnswer?.id ?? null,
        comment: reportComment.trim(),
      });
      setReportOpen(false);
      setReportComment('');
    } finally {
      setReportSending(false);
    }
  }, [current, reportComment, user?.id]);

  /* ---- Render helpers ---- */
  const totalLives = SESSION.startingLives;
  const isReady = !loading && !empty && !authRequired && current;
  const showNoContent = !loading && empty && !authRequired;

  return (
    <div className="play-wrap play-with-bg">
      <BackgroundPattern className="play-bg-pattern" variant={2} opacity={0.15} />
      <TextureOverlay className="play-texture" />
      {/* Top bar */}
      <div className="play-header">
        <button type="button" className="play-close" onClick={handleExit}>✕</button>
        <div className="play-stats">
          <div>
            <span>{t('play.score')}</span>{' '}
            <span className="play-stat-value">{session.currentScore}</span>
          </div>
          <div>
            <span>{t('play.combo')}</span>{' '}
            <span className="play-stat-value">×{session.comboMultiplier.toFixed(2)}</span>
          </div>
        </div>
        <div className="play-lives">
          {Array.from({ length: totalLives }).map((_, i) => {
            let cls = 'play-heart';
            if (i >= session.livesRemaining) cls += ' lost';
            if (justLostIndex.current === i && i >= session.livesRemaining) cls += ' just-lost';
            return (
              <span key={i} className={cls} aria-hidden>♥</span>
            );
          })}
        </div>
      </div>

      {/* Exit confirmation overlay */}
      {exitConfirm && (
        <div className="modal-backdrop" onClick={cancelExit}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <p style={{ marginBottom: 'var(--space-4)' }}>{t('play.exitConfirm')}</p>
            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={cancelExit}>
                {t('play.exitNo')}
              </button>
              <button type="button" className="btn btn-primary" onClick={handleExit}>
                {t('play.exitYes')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="play-body">
        {authRequired && (
          <div className="placeholder">
            <p className="placeholder-text">{t('play.signInRequired', 'Please sign in to play.')}</p>
            <button type="button" className="btn btn-primary btn-lg" onClick={() => navigate('/')}>
              {t('play.goToMenu', 'Go to menu')}
            </button>
          </div>
        )}

        {loading && !authRequired && (
          <div className="placeholder">
            <div className="spinner" />
            <p className="placeholder-text">{t('play.loading')}</p>
          </div>
        )}

        {showNoContent && !authRequired && (
          <div className="placeholder">
            <p className="placeholder-text">{t('play.noContent')}</p>
          </div>
        )}

        {isReady && (
          <>
            <QuestionView
              key={questionKey}
              question={current}
              feedback={feedback}
              selectedAnswer={selectedAnswer}
              clickedIndex={clickedIndex}
              onAnswer={(id) => handleAnswer(id, current)}
              onClickTarget={(idx, len) => handleClickTarget(idx, len, current)}
              onReport={user ? () => setReportOpen(true) : undefined}
            />

            {feedback?.type === 'incorrect' && (
              <button type="button" className="btn btn-primary btn-lg" onClick={doAdvance}>
                {t('play.continue')}
              </button>
            )}

            {reportOpen && current && (
              <div className="modal-backdrop" onClick={() => setReportOpen(false)}>
                <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
                  <h3>Report question</h3>
                  <p className="text-muted">Describe the issue (e.g. wrong answer, unclear prompt).</p>
                  <textarea
                    value={reportComment}
                    onChange={(e) => setReportComment(e.target.value)}
                    placeholder="Comment…"
                    rows={3}
                    className="input-full"
                  />
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => setReportOpen(false)}>Cancel</button>
                    <button type="button" className="btn btn-primary" onClick={submitReport} disabled={!reportComment.trim() || reportSending}>
                      {reportSending ? 'Sending…' : 'Submit'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/* =======================================================================
   QuestionView — renders the prompt + answer UI based on question type
   ======================================================================= */

interface QuestionViewProps {
  question: QuestionDTO;
  feedback: Feedback;
  selectedAnswer: string | null;
  clickedIndex: number | null;
  onAnswer: (id: string) => void;
  onClickTarget: (index: number, wordLength: number) => void;
  onReport?: () => void;
}

function QuestionView({
  question,
  feedback,
  selectedAnswer,
  clickedIndex,
  onAnswer,
  onClickTarget,
  onReport,
}: QuestionViewProps) {
  const { t } = useTranslation();
  const isClickWord = question.questionType === 'click_word';
  const isClickLetter = question.questionType === 'click_letter';
  const isClickLetterRange = question.questionType === 'click_letter_range';
  const isClickType = isClickWord || isClickLetter || isClickLetterRange;

  return (
    <div className="question-card card">
      {onReport && (
        <button
          type="button"
          className="question-card-report"
          onClick={onReport}
          title="Report question"
          aria-label="Report question"
        >
          ⚠
        </button>
      )}
      <h2 className="question-text">{question.questionText}</h2>

      <div className="question-prompt">
        {isClickType ? (
          <ClickablePrompt
            text={question.promptText}
            isLetter={isClickLetter || isClickLetterRange}
            correctIndex={question.indexStart}
            correctIndexEnd={question.indexEnd}
            clickedIndex={clickedIndex}
            feedback={feedback}
            onClickTarget={onClickTarget}
          />
        ) : (
          <HighlightedPrompt
            text={question.promptText}
            indexStart={question.indexStart}
            indexEnd={question.indexEnd}
            isLetter={question.isLetter}
          />
        )}
      </div>

      {feedback && (
        <div className={`question-feedback ${feedback.type}`}>
          {feedback.type === 'correct' ? '✓' : '✗'}{' '}
          {feedback.type === 'correct' ? t('play.correct') : t('play.incorrect')}
          {feedback.type === 'incorrect' && question.definitionDescription && (
            <div className="question-feedback-description">{question.definitionDescription}</div>
          )}
        </div>
      )}

      {(question.questionType === 'MCQ'
        || question.questionType === 'visual_mcq'
        || question.questionType === 'mcq_fillin')
        && question.possibleAnswers?.length ? (
        <div className="mcq-options">
          {question.possibleAnswers.map((opt) => {
            let cls = 'mcq-option';
            if (selectedAnswer) {
              if (opt.id === question.correctAnswer.id) cls += ' correct';
              else if (opt.id === selectedAnswer) cls += ' wrong';
              else cls += ' dimmed';
            }
            return (
              <button
                key={opt.id}
                type="button"
                className={cls}
                onClick={() => onAnswer(opt.id)}
                disabled={!!feedback}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/* =======================================================================
   HighlightedPrompt — renders prompt with target word/letter highlighted
   (used for MCQ questions so user knows which word the question is about)
   ======================================================================= */

interface HighlightedPromptProps {
  text: string;
  indexStart: number;
  indexEnd?: number | null;
  isLetter: boolean;
}

function HighlightedPrompt({ text, indexStart, indexEnd, isLetter }: HighlightedPromptProps) {
  if (isLetter) {
    const chars = [...text];
    const end = indexEnd != null && indexEnd > indexStart ? indexEnd : indexStart + 1;
    return (
      <span className="question-prompt-text">
        {chars.map((ch, i) => (
          <span key={i} className={i >= indexStart && i < end ? 'prompt-highlight' : ''}>
            {ch}
          </span>
        ))}
      </span>
    );
  }

  const words = getPromptWords(text);
  return (
    <span className="question-prompt-text">
      {words.map((w, i) => (
        <span key={w.startIndex}>
          {i > 0 && ' '}
          <span className={indexStart >= w.startIndex && indexStart < w.endIndex ? 'prompt-highlight' : ''}>
            {w.word}
          </span>
        </span>
      ))}
    </span>
  );
}

/* =======================================================================
   ClickablePrompt — renders prompt text as clickable words or letters
   (used for click_word / click_letter questions)
   On feedback, highlights the correct target in green and wrong click in red.
   ======================================================================= */

interface ClickablePromptProps {
  text: string;
  isLetter: boolean;
  correctIndex: number;
  correctIndexEnd?: number | null;
  clickedIndex: number | null;
  feedback: Feedback;
  onClickTarget: (index: number, wordLength: number) => void;
}

function ClickablePrompt({
  text,
  isLetter,
  correctIndex,
  correctIndexEnd,
  clickedIndex,
  feedback,
  onClickTarget,
}: ClickablePromptProps) {
  const letterEnd = correctIndexEnd != null && correctIndexEnd > correctIndex ? correctIndexEnd : correctIndex + 1;
  if (isLetter) {
    return (
      <span className="click-prompt">
        {[...text].map((char, i) => {
          let cls = 'click-letter';
          const inCorrectRange = i >= correctIndex && i < letterEnd;
          if (feedback && inCorrectRange) cls += ' correct';
          else if (feedback && clickedIndex === i && !inCorrectRange) cls += ' wrong';
          return (
            <span
              key={i}
              className={cls}
              onClick={() => onClickTarget(i, 1)}
            >
              {char}
            </span>
          );
        })}
      </span>
    );
  }

  const words = getPromptWords(text);
  return (
    <span className="click-prompt">
      {words.map((w) => {
        let cls = 'click-word';
        const isCorrectWord = correctIndex >= w.startIndex && correctIndex < w.endIndex;
        const isClickedWord = clickedIndex !== null && clickedIndex >= w.startIndex && clickedIndex < w.endIndex;
        if (feedback && isCorrectWord) cls += ' correct';
        else if (feedback && isClickedWord && !isCorrectWord) cls += ' wrong';
        return (
          <span
            key={w.startIndex}
            className={cls}
            onClick={() => onClickTarget(w.startIndex, w.word.length)}
          >
            {w.word}
          </span>
        );
      })}
    </span>
  );
}
