import { useCallback, useEffect, useRef, useState } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import { listQuestions } from "@/lib/telitall/server";
import { CATEGORIES, categoryLabel, formatWhen, kindLabel, type QuestionCard, type QuestionKind } from "@/lib/telitall/shared";

export const Route = createFileRoute("/")({ component: HomePage });

function HomePage() {
  const [questions, setQuestions] = useState<QuestionCard[] | null>(null);
  const [error, setError] = useState("");
  const [category, setCategory] = useState("all");
  const [kind, setKind] = useState<QuestionKind | "all">("all");
  const [query, setQuery] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const fetchQuestions = useCallback(
    (opts: { append?: boolean; cursor?: number } = {}) => {
      const controller = new AbortController();
      const doFetch = async () => {
        if (!opts.append) setQuestions(null);
        if (opts.append) setLoadingMore(true);
        setError("");
        try {
          const result = await listQuestions({
            data: {
              kind: kind === "all" ? undefined : kind,
              category: category === "all" ? undefined : category,
              search: query.trim() || undefined,
              cursor: opts.cursor,
            },
          });
          if (controller.signal.aborted) return;
          if (opts.append) {
            setQuestions((prev) => [...(prev ?? []), ...result.questions]);
          } else {
            setQuestions(result.questions);
          }
          setHasMore(result.hasMore);
        } catch {
          if (!controller.signal.aborted) setError("Couldn't load questions. Refresh and try again.");
        } finally {
          setLoadingMore(false);
        }
      };
      void doFetch();
      return () => controller.abort();
    },
    [kind, category, query],
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => {
        const cleanup = fetchQuestions();
        return cleanup;
      },
      query ? 300 : 0,
    );
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchQuestions]);

  function loadMore() {
    const last = questions?.[questions.length - 1];
    if (!last) return;
    fetchQuestions({ append: true, cursor: last.id });
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Ask a person, or ask Laya.</h1>
        <p className="mt-2 text-sm text-muted">
          Real experiences from people. A clear reply from Laya when you want one now.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/ask" className="rounded-3xl border border-line bg-card p-4">
          <p className="text-sm font-semibold text-green">Ask a person</p>
          <p className="mt-2 text-sm text-muted">Share a question. People answer from their own lives.</p>
        </Link>
        <Link to="/laya" className="rounded-3xl border border-line bg-mint p-4">
          <p className="text-sm font-semibold text-green">Ask Laya</p>
          <p className="mt-2 text-sm text-ink">An AI reply, right now. Not a substitute for someone's story.</p>
        </Link>
      </div>

      <div>
        <label htmlFor="search" className="sr-only">
          Search questions
        </label>
        <input
          id="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search questions"
          className="h-12 w-full rounded-full border border-line bg-card px-4 text-base outline-none placeholder:text-muted focus-visible:border-green"
        />
      </div>

      <div className="space-y-2">
        <div className="flex gap-2">
          <KindChip active={kind === "all"} onClick={() => setKind("all")}>
            All
          </KindChip>
          <KindChip active={kind === "experience"} color="green" onClick={() => setKind("experience")}>
            Experience
          </KindChip>
          <KindChip active={kind === "knowledge"} color="blue" onClick={() => setKind("knowledge")}>
            Knowledge
          </KindChip>
        </div>
        <div className="chip-row -mx-4 flex gap-2 overflow-x-auto px-4">
          <Chip active={category === "all"} onClick={() => setCategory("all")}>
            All
          </Chip>
          {CATEGORIES.map((item) => (
            <Chip key={item.id} active={category === item.id} onClick={() => setCategory(item.id)}>
              {item.label}
            </Chip>
          ))}
        </div>
      </div>

      {error ? <p className="text-sm font-medium">{error}</p> : null}

      {questions === null && !error ? (
        <div className="space-y-3" aria-hidden="true">
          <div className="h-28 animate-pulse rounded-3xl bg-mint" />
          <div className="h-28 animate-pulse rounded-3xl bg-mint" />
          <div className="h-28 animate-pulse rounded-3xl bg-mint" />
        </div>
      ) : null}

      {questions && questions.length === 0 ? (
        <div className="rounded-3xl border border-line bg-card p-4">
          <p className="font-semibold">Nothing matches that yet.</p>
          <p className="mt-1 text-sm text-muted">Ask it. Someone may have lived it.</p>
          <Link
            to="/ask"
            className="mt-4 inline-flex h-11 items-center rounded-full bg-green px-4 text-sm font-semibold text-on-green"
          >
            Ask a person
          </Link>
        </div>
      ) : null}

      <ul className="space-y-3">
        {(questions ?? []).map((question) => (
          <li key={question.id}>
            <Link
              to="/q/$id"
              params={{ id: String(question.id) }}
              className="block rounded-3xl border border-line bg-card p-4"
            >
              <p className="text-sm text-muted">
                <span
                  className={question.kind === "experience" ? "font-medium text-green" : "font-medium text-blue"}
                >
                  {kindLabel(question.kind)}
                </span>
                <span> · {categoryLabel(question.category)}</span>
              </p>
              <h2 className="mt-2 text-lg font-semibold leading-snug">{question.title}</h2>
              <p className="mt-2 line-clamp-2 text-sm text-muted">{question.body}</p>
              <p className="mt-3 text-sm text-muted">
                <span className="font-medium text-ink">{question.authorName}</span>
                <span>
                  {" "}
                  · {question.answerCount} {question.answerCount === 1 ? "answer" : "answers"}
                </span>
                <span> · {formatWhen(question.createdAt)}</span>
                {question.editedAt ? <span className="italic"> · edited</span> : null}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      {hasMore ? (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="flex h-12 w-full items-center justify-center rounded-full border border-line bg-card text-sm font-semibold text-ink"
        >
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      ) : null}
    </div>
  );
}

function KindChip({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color?: "green" | "blue";
  onClick: () => void;
  children: string;
}) {
  const activeClass =
    color === "blue"
      ? "bg-blue text-white"
      : color === "green"
        ? "bg-green text-on-green"
        : "bg-ink text-on-ink";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 shrink-0 rounded-full px-4 text-sm font-medium ${
        active ? activeClass : "border border-line bg-card text-ink"
      }`}
    >
      {children}
    </button>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-10 shrink-0 rounded-full px-4 text-sm font-medium ${
        active ? "bg-ink text-on-ink" : "border border-line bg-card text-ink"
      }`}
    >
      {children}
    </button>
  );
}
