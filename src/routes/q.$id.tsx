import { useEffect, useState } from "react";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { AreaField, ErrorNote, PrimaryButton, SecondaryButton, TextField } from "@/components/fields";
import {
  acceptAnswer,
  createAnswer,
  deleteQuestion,
  editAnswer,
  editQuestion,
  getQuestion,
  reportContent,
  voteHelpful,
} from "@/lib/telitall/server";
import { categoryLabel, formatWhen, kindLabel, type AnswerCard, type QuestionCard } from "@/lib/telitall/shared";

export const Route = createFileRoute("/q/$id")({ component: QuestionPage });

function QuestionPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const user = useCurrentUser();
  const [question, setQuestion] = useState<QuestionCard | null>(null);
  const [answers, setAnswers] = useState<AnswerCard[]>([]);
  const [missing, setMissing] = useState(false);
  const [error, setError] = useState("");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Edit question state
  const [editingQuestion, setEditingQuestion] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  // Edit answer state
  const [editingAnswerId, setEditingAnswerId] = useState<number | null>(null);
  const [editAnswerBody, setEditAnswerBody] = useState("");
  // Report state
  const [reportTarget, setReportTarget] = useState<{ type: "question" | "answer"; id: number } | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportSent, setReportSent] = useState(false);

  useEffect(() => {
    let live = true;
    setQuestion(null);
    setMissing(false);
    setError("");
    void getQuestion({ data: { id: Number(id) } })
      .then((detail) => {
        if (!live) return;
        if (!detail) {
          setMissing(true);
          return;
        }
        setQuestion(detail.question);
        setAnswers(detail.answers);
      })
      .catch(() => {
        if (live) setError("Couldn't load this question.");
      });
    return () => {
      live = false;
    };
  }, [id]);

  async function onAnswer(event: React.FormEvent) {
    event.preventDefault();
    if (!question) return;
    setError("");
    setPending(true);
    try {
      const result = await createAnswer({
        data: {
          questionId: question.id,
          body,
          displayName: user?.displayName ?? user?.primaryEmail ?? "",
        },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const detail = await getQuestion({ data: { id: question.id } });
      if (detail) {
        setQuestion(detail.question);
        setAnswers(detail.answers);
      }
      setBody("");
    } catch {
      setError("Couldn't post that answer.");
    } finally {
      setPending(false);
    }
  }

  async function onVote(answerId: number) {
    setError("");
    const result = await voteHelpful({ data: { answerId } }).catch(() => null);
    if (!result) {
      setError("Couldn't save that vote.");
      return;
    }
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setAnswers((current) =>
      current.map((answer) =>
        answer.id === answerId ? { ...answer, voted: true, helpful: result.helpful } : answer,
      ),
    );
  }

  async function onAccept(answerId: number) {
    setError("");
    const result = await acceptAnswer({ data: { answerId } }).catch(() => null);
    if (!result || !result.ok) {
      setError(result && !result.ok ? result.error : "Couldn't accept that answer.");
      return;
    }
    setAnswers((current) => current.map((answer) => ({ ...answer, isBest: answer.id === answerId })));
  }

  async function onDelete() {
    if (!question) return;
    setPending(true);
    try {
      const result = await deleteQuestion({ data: { id: question.id } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      await navigate({ to: "/" });
    } catch {
      setError("Couldn't delete that question.");
    } finally {
      setPending(false);
    }
  }

  async function onEditQuestion() {
    if (!question) return;
    setError("");
    setPending(true);
    try {
      const result = await editQuestion({ data: { id: question.id, title: editTitle, body: editBody } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setQuestion({
        ...question,
        title: editTitle.trim(),
        body: editBody.trim(),
        editedAt: new Date().toISOString(),
      });
      setEditingQuestion(false);
    } catch {
      setError("Couldn't save that edit.");
    } finally {
      setPending(false);
    }
  }

  async function onEditAnswer(answerId: number) {
    setError("");
    setPending(true);
    try {
      const result = await editAnswer({ data: { id: answerId, body: editAnswerBody } });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setAnswers((current) =>
        current.map((a) =>
          a.id === answerId
            ? { ...a, body: editAnswerBody.trim(), editedAt: new Date().toISOString() }
            : a,
        ),
      );
      setEditingAnswerId(null);
      setEditAnswerBody("");
    } catch {
      setError("Couldn't save that edit.");
    } finally {
      setPending(false);
    }
  }

  async function onReport() {
    if (!reportTarget) return;
    setError("");
    setPending(true);
    try {
      const result = await reportContent({
        data: { targetType: reportTarget.type, targetId: reportTarget.id, reason: reportReason },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setReportTarget(null);
      setReportReason("");
      setReportSent(true);
      setTimeout(() => setReportSent(false), 4000);
    } catch {
      setError("Couldn't send that report.");
    } finally {
      setPending(false);
    }
  }

  if (error && !question && !missing) return <p className="text-sm font-medium">{error}</p>;
  if (missing) {
    return (
      <div className="rounded-3xl border border-line bg-card p-4">
        <p className="font-semibold">This question isn't here.</p>
        <Link to="/" className="mt-3 inline-flex text-sm font-semibold text-green">
          Back home
        </Link>
      </div>
    );
  }
  if (!question) return <div className="h-48 animate-pulse rounded-3xl bg-mint" aria-hidden="true" />;

  return (
    <div className="space-y-5">
      <Link to="/" className="text-sm font-semibold text-green">
        Back
      </Link>
      <article className="space-y-3">
        <p className="text-sm text-muted">
          <span className={question.kind === "experience" ? "font-medium text-green" : "font-medium text-blue"}>
            {kindLabel(question.kind)}
          </span>
          <span> · {categoryLabel(question.category)}</span>
        </p>

        {editingQuestion ? (
          <div className="space-y-3 rounded-3xl border border-green bg-mint p-4">
            <TextField
              label="Title"
              value={editTitle}
              maxLength={140}
              onChange={(event) => setEditTitle(event.target.value)}
            />
            <AreaField
              label="Body"
              value={editBody}
              maxLength={4000}
              onChange={(event) => setEditBody(event.target.value)}
            />
            <div className="flex gap-2">
              <PrimaryButton type="button" disabled={pending} onClick={() => void onEditQuestion()}>
                {pending ? "Saving…" : "Save edit"}
              </PrimaryButton>
              <SecondaryButton onClick={() => setEditingQuestion(false)}>Cancel</SecondaryButton>
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-semibold tracking-tight">{question.title}</h1>
            <p className="whitespace-pre-wrap text-base">{question.body}</p>
          </>
        )}

        <p className="text-sm text-muted">
          <span className="font-medium text-ink">{question.authorName}</span>
          {question.reputation > 0 ? (
            <span className="tabular-nums"> · {question.reputation} pts</span>
          ) : null}
          <span> · {formatWhen(question.createdAt)}</span>
          {question.editedAt ? <span className="italic"> · edited</span> : null}
        </p>
        {question.category === "health" ? (
          <p className="text-sm text-muted">Personal experiences only — not medical advice.</p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          {question.isMine && !editingQuestion ? (
            <button
              type="button"
              className="text-sm font-medium text-muted hover:text-ink"
              onClick={() => {
                setEditTitle(question.title);
                setEditBody(question.body);
                setEditingQuestion(true);
              }}
            >
              Edit
            </button>
          ) : null}
          {question.isMine ? (
            <>
              {confirmDelete ? (
                <div className="flex gap-2">
                  <SecondaryButton onClick={() => void onDelete()} disabled={pending}>
                    Confirm delete
                  </SecondaryButton>
                  <SecondaryButton onClick={() => setConfirmDelete(false)}>Keep it</SecondaryButton>
                </div>
              ) : (
                <button
                  type="button"
                  className="text-sm font-medium text-muted hover:text-ink"
                  onClick={() => setConfirmDelete(true)}
                >
                  Delete
                </button>
              )}
            </>
          ) : (
            <button
              type="button"
              className="text-sm font-medium text-muted hover:text-ink"
              onClick={() => setReportTarget({ type: "question", id: question.id })}
            >
              Report
            </button>
          )}
        </div>
      </article>

      {/* Report inline form */}
      {reportTarget ? (
        <div className="space-y-3 rounded-3xl border border-line bg-card p-4">
          <p className="font-semibold">Report this {reportTarget.type}</p>
          <p className="text-sm text-muted">Tell us why this doesn't belong.</p>
          <AreaField
            label="Reason"
            value={reportReason}
            maxLength={500}
            onChange={(event) => setReportReason(event.target.value)}
            placeholder="What's wrong with this content?"
          />
          <ErrorNote message={error} />
          <div className="flex gap-2">
            <PrimaryButton
              type="button"
              disabled={pending || reportReason.trim().length < 5}
              onClick={() => void onReport()}
            >
              {pending ? "Sending…" : "Submit report"}
            </PrimaryButton>
            <SecondaryButton
              onClick={() => {
                setReportTarget(null);
                setReportReason("");
              }}
            >
              Cancel
            </SecondaryButton>
          </div>
        </div>
      ) : null}

      {reportSent ? (
        <p className="text-sm font-medium text-green">Report submitted. Thank you.</p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">
          {answers.length} {answers.length === 1 ? "answer" : "answers"}
        </h2>
        {answers.length === 0 ? (
          <p className="text-sm text-muted">No answers yet. If you've lived this, say so.</p>
        ) : null}
        <ul className="space-y-3">
          {answers.map((answer) => (
            <li
              key={answer.id}
              className={`rounded-3xl border p-4 ${answer.isBest ? "border-green bg-mint" : "border-line bg-card"}`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm">
                  <span className="font-semibold">{answer.authorName}</span>
                  <span className="text-muted"> · {formatWhen(answer.createdAt)}</span>
                  {answer.editedAt ? <span className="text-muted italic"> · edited</span> : null}
                </p>
                {answer.isBest ? <span className="text-xs font-semibold text-green">Best answer</span> : null}
              </div>

              {editingAnswerId === answer.id ? (
                <div className="mt-3 space-y-3">
                  <AreaField
                    label="Edit your answer"
                    value={editAnswerBody}
                    maxLength={4000}
                    onChange={(event) => setEditAnswerBody(event.target.value)}
                  />
                  <div className="flex gap-2">
                    <PrimaryButton
                      type="button"
                      disabled={pending}
                      onClick={() => void onEditAnswer(answer.id)}
                    >
                      {pending ? "Saving…" : "Save"}
                    </PrimaryButton>
                    <SecondaryButton
                      onClick={() => {
                        setEditingAnswerId(null);
                        setEditAnswerBody("");
                      }}
                    >
                      Cancel
                    </SecondaryButton>
                  </div>
                </div>
              ) : (
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{answer.body}</p>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {answer.isMine ? (
                  <>
                    <span className="text-sm text-muted">Your answer</span>
                    {editingAnswerId !== answer.id ? (
                      <button
                        type="button"
                        className="text-sm font-medium text-muted hover:text-ink"
                        onClick={() => {
                          setEditingAnswerId(answer.id);
                          setEditAnswerBody(answer.body);
                        }}
                      >
                        Edit
                      </button>
                    ) : null}
                  </>
                ) : (
                  <>
                    <SecondaryButton
                      className="h-10 px-4 text-sm"
                      disabled={answer.voted}
                      onClick={() => void onVote(answer.id)}
                    >
                      {answer.voted ? "Marked helpful" : "Helpful"} ·{" "}
                      <span className="tabular-nums">{answer.helpful}</span>
                    </SecondaryButton>
                    <button
                      type="button"
                      className="text-sm font-medium text-muted hover:text-ink"
                      onClick={() => setReportTarget({ type: "answer", id: answer.id })}
                    >
                      Report
                    </button>
                  </>
                )}
                {question.isMine && !answer.isBest ? (
                  <SecondaryButton className="h-10 px-4 text-sm" onClick={() => void onAccept(answer.id)}>
                    Accept
                  </SecondaryButton>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <form className="space-y-3" onSubmit={(event) => void onAnswer(event)}>
        <AreaField
          label="Your answer"
          value={body}
          maxLength={4000}
          onChange={(event) => setBody(event.target.value)}
          placeholder="What you lived, or what you know. Be specific."
        />
        <ErrorNote message={question ? error : ""} />
        <PrimaryButton type="submit" disabled={pending}>
          {pending ? "Posting…" : "Post answer"}
        </PrimaryButton>
      </form>
    </div>
  );
}
