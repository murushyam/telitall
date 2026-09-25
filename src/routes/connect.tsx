import { useState, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, Timer, Send, Trash2, ArrowLeft } from "lucide-react";
import { createOrJoinEphemeralRoomFn } from "@/lib/telitall/server";
import type { EphemeralRoom, EphemeralMessage } from "@/lib/telitall/shared";

export const Route = createFileRoute("/connect")({
  component: ConnectPage,
});

const SUGGESTED_TOPICS = [
  "First heartbreak & feeling stuck",
  "Preparing for job interview with no experience",
  "Moved to a new city alone",
  "Exam burnout & mind wandering",
  "Handling family pressure on career",
  "Feeling lonely in a crowded place",
];

function ConnectPage() {
  const [topic, setTopic] = useState("");
  const [room, setRoom] = useState<EphemeralRoom | null>(null);
  const [messages, setMessages] = useState<EphemeralMessage[]>([]);
  const [inputMsg, setInputMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [timeLeft, setTimeLeft] = useState("60:00");

  useEffect(() => {
    if (!room) return;

    const timer = setInterval(() => {
      const now = Date.now();
      const expires = Date.parse(room.expiresAt);
      const remaining = Math.max(0, Math.floor((expires - now) / 1000));
      if (remaining <= 0) {
        setRoom(null);
        setMessages([]);
        setError("This chat has expired and was permanently wiped.");
        return;
      }
      const mins = Math.floor(remaining / 60);
      const secs = remaining % 60;
      setTimeLeft(`${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [room]);

  async function handleStartRoom(chosenTopic: string) {
    if (chosenTopic.length < 3) {
      setError("Name the situation or topic you want to connect about.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await createOrJoinEphemeralRoomFn({ data: { topic: chosenTopic } });
      if (!res.ok) {
        setError(res.error);
        setLoading(false);
        return;
      }
      setRoom(res.room);
      setMessages([
        {
          id: "sys_1",
          roomId: res.room.id,
          senderAlias: "System",
          isMine: false,
          content: `🔒 Connected anonymously with ${res.room.peerAlias}. No real names, phone numbers, or details are shared. This chat self-destructs in 1 hour.`,
          createdAt: new Date().toISOString(),
        },
        {
          id: "peer_1",
          roomId: res.room.id,
          senderAlias: res.room.peerAlias,
          isMine: false,
          content: `Hey... I saw you wanted to talk about "${chosenTopic}". How are you holding up today?`,
          createdAt: new Date().toISOString(),
        },
      ]);
    } catch {
      setError("Couldn't start chat right now. Try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!room || !inputMsg.trim()) return;
    const userMsg: EphemeralMessage = {
      id: "msg_" + Date.now(),
      roomId: room.id,
      senderAlias: room.myAlias,
      isMine: true,
      content: inputMsg.trim(),
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputMsg("");

    // Simulated empathetic response for interactive testing
    setTimeout(() => {
      const replies = [
        "I really hear you. That sounds exhausting to carry by yourself.",
        "I went through something very similar. Taking it one day at a time helped me.",
        "Thank you for sharing that out loud. It takes courage to put it into words.",
        "I know that exact feeling. You don't have to apologize for feeling this way.",
      ];
      const reply = replies[Math.floor(Math.random() * replies.length)];
      setMessages((prev) => [
        ...prev,
        {
          id: "peer_" + Date.now(),
          roomId: room.id,
          senderAlias: room.peerAlias,
          isMine: false,
          content: reply,
          createdAt: new Date().toISOString(),
        },
      ]);
    }, 1200);
  }

  if (room) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <div>
            <button
              type="button"
              onClick={() => setRoom(null)}
              className="flex items-center gap-1 text-sm font-semibold text-green hover:underline"
            >
              <ArrowLeft className="size-4" /> Leave Chat
            </button>
            <p className="mt-1 text-xs text-muted">
              Topic: <strong className="text-ink">{room.topic}</strong>
            </p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">
            <Timer className="size-3.5" /> Expires in {timeLeft}
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-mint p-3.5 text-xs font-medium text-ink">
          🔒 <strong>100% Anonymous & Ephemeral:</strong> Neither of you knows the other's real name, age, or details. This chat automatically self-destructs in 1 hour so you can speak freely without burden.
        </div>

        <div className="flex flex-col gap-3 py-2">
          {messages.map((m) => {
            if (m.senderAlias === "System") {
              return (
                <div key={m.id} className="rounded-xl border border-line bg-mint p-2.5 text-center text-xs text-ink">
                  {m.content}
                </div>
              );
            }
            return (
              <div
                key={m.id}
                className={`max-w-[85%] rounded-2xl p-3.5 text-sm ${
                  m.isMine
                    ? "ml-auto bg-ink text-on-ink"
                    : "mr-auto border border-line bg-card text-ink"
                }`}
              >
                <p className="mb-1 text-[11px] font-semibold text-muted">{m.senderAlias}</p>
                <p className="whitespace-pre-wrap">{m.content}</p>
              </div>
            );
          })}
        </div>

        <form onSubmit={handleSendMessage} className="mt-2 flex flex-col gap-2">
          <textarea
            value={inputMsg}
            onChange={(e) => setInputMsg(e.target.value)}
            placeholder="Type a message..."
            maxLength={1000}
            className="min-h-[4.5rem] w-full rounded-2xl border border-line bg-card p-3 text-sm text-ink outline-none focus:border-green"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!inputMsg.trim()}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-green py-2.5 text-sm font-semibold text-on-green disabled:opacity-50"
            >
              <Send className="size-4" /> Send Message
            </button>
            <button
              type="button"
              onClick={() => {
                setRoom(null);
                setMessages([]);
              }}
              className="flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-100"
            >
              <Trash2 className="size-4" /> Wipe & End
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Anonymous 1-Hour Connect</h1>
        <p className="mt-1 text-sm text-muted">
          Talk to a stranger going through a similar situation. Neither of you sees private details (name, age, phone). The chat self-destructs in 60 minutes so you don't feel burdened.
        </p>
      </div>

      <div className="flex items-start gap-3 rounded-2xl border border-line bg-mint p-4">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-green" />
        <div className="text-xs">
          <p className="font-semibold text-green">Privacy & Anonymity First</p>
          <p className="mt-0.5 text-ink">
            You are assigned random companion handles (e.g., <i>Companion #402</i>). Zero personal identity is shared unless you choose to tell it yourself.
          </p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void handleStartRoom(topic);
        }}
        className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm"
      >
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          What situation or burden do you want to talk about?
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="e.g. Preparing for a job interview with no experience..."
            maxLength={100}
            className="w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm outline-none focus:border-green"
          />
        </label>
        {error && <p className="text-xs font-semibold text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading || !topic.trim()}
          className="mt-1 rounded-full bg-green py-3 text-sm font-semibold text-on-green disabled:opacity-50"
        >
          {loading ? "Matching..." : "Start Anonymous 1-Hour Chat"}
        </button>
      </form>

      <div className="flex flex-col gap-3">
        <h2 className="text-base font-semibold text-ink">Common Experiences</h2>
        <div className="grid gap-2.5">
          {SUGGESTED_TOPICS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => void handleStartRoom(t)}
              className="flex flex-col rounded-2xl border border-line bg-card p-3.5 text-left shadow-sm hover:border-green"
            >
              <p className="text-sm font-semibold text-ink">{t}</p>
              <p className="mt-0.5 text-xs text-muted">Connect anonymously with someone who lived this.</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
