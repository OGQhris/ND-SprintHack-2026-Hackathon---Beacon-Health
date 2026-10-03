"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Sparkles,
  ArrowUp,
  ArrowUpRight,
  Check,
  LoaderCircle,
  TriangleAlert,
  Plus,
  ShieldCheck,
  CalendarClock,
  UsersRound,
  Search,
  Square,
  Settings2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ChatEvent } from "@/lib/ai/responseLoop";
type Activity = { id: string; label: string; done: boolean; ok: boolean };
type Message = {
  id: string;
  role: string;
  content: string;
  activities?: Activity[];
  error?: boolean;
};
const prompts = [
  {
    text: "Who has licenses expiring soon?",
    icon: CalendarClock,
    detail: "Stay ahead of the next renewal",
  },
  {
    text: "Show everyone expiring within 30 days.",
    icon: CalendarClock,
    detail: "Plan for upcoming expirations",
  },
  {
    text: "Tell me about Kathryn Cell.",
    icon: Search,
    detail: "Get a complete credential picture",
  },
  {
    text: "Who reports to Christianna Davison?",
    icon: UsersRound,
    detail: "Review a manager’s team",
  },
  {
    text: "Who needs attention?",
    icon: ShieldCheck,
    detail: "Find the records to follow up on",
  },
  {
    text: "Verify Kathryn Cell.",
    icon: ShieldCheck,
    detail: "Check the Michigan state source",
  },
];
export function Chat({ compact = false }: { compact?: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [activity, setActivity] = useState("Reviewing your question");
  const bottom = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const loadSession = useCallback(async (reset = false) => {
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/chat/session", {
        method: reset ? "POST" : "GET",
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setMessages(data.messages);
      setConfigured(data.configured);
      if (data.busy)
        setError(
          "Another assistant response is still running. Please wait a moment.",
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load conversation.");
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void loadSession(), 0);
    return () => {
      clearTimeout(timer);
      requestRef.current?.abort();
    };
  }, [loadSession]);
  useEffect(() => {
    bottom.current?.scrollIntoView({
      behavior: busy ? "instant" : "smooth",
      block: "end",
    });
  }, [messages, busy]);
  const submit = async (value: string) => {
    const message = value.trim();
    if (!message || busy) return;
    if (!configured) {
      setError(
        "Add your OpenAI key to .env.local and restart the server to enable the assistant.",
      );
      return;
    }
    setError("");
    setDraft("");
    setBusy(true);
    setActivity("Reviewing your question");
    const id = crypto.randomUUID();
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), role: "user", content: message },
      { id, role: "assistant", content: "", activities: [] },
    ]);
    const update = (fn: (m: Message) => Message) =>
      setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)));
    const controller = new AbortController();
    requestRef.current = controller;
    let complete = false;
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "The assistant is unavailable.");
      }
      const reader = response.body?.getReader();
      if (!reader) throw new Error("Could not open the response stream.");
      const decoder = new TextDecoder();
      let buffer = "";
      const processEvent = (event: ChatEvent) => {
        if (event.type === "text_delta") {
          setActivity("Writing your answer");
          update((m) => ({ ...m, content: m.content + (event.text || "") }));
        }
        if (event.type === "tool_call_start") {
          setActivity(event.label || "Checking credentials");
          update((m) => ({
            ...m,
            activities: [
              ...(m.activities || []),
              {
                id: event.callId || crypto.randomUUID(),
                label: event.label || "Reviewing records",
                done: false,
                ok: true,
              },
            ],
          }));
        }
        if (event.type === "tool_call_complete")
          update((m) => ({
            ...m,
            activities: m.activities?.map((a) =>
              a.id === event.callId
                ? { ...a, done: true, ok: event.ok !== false }
                : a,
            ),
          }));
        if (event.type === "assistant_complete") complete = true;
        if (event.type === "error")
          throw new Error(event.message || "The assistant request failed.");
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let split;
        while ((split = buffer.indexOf("\n\n")) >= 0) {
          const chunk = buffer.slice(0, split);
          buffer = buffer.slice(split + 2);
          const data = chunk
            .split("\n")
            .filter((l) => l.startsWith("data: "))
            .map((l) => l.slice(6))
            .join("\n");
          if (data) processEvent(JSON.parse(data));
        }
      }
      if (!complete)
        throw new Error(
          "The response stream was interrupted. Please try again.",
        );
    } catch (e) {
      const message = controller.signal.aborted
        ? "Response stopped. Credential checks already started may finish on the dashboard."
        : e instanceof Error
          ? e.message
          : "The assistant could not respond.";
      setError(message);
      update((m) => ({ ...m, error: true, content: m.content || message }));
    } finally {
      setBusy(false);
      requestRef.current = null;
      composer.current?.focus();
    }
  };
  return (
    <div className={`chat ${compact ? "chat-compact" : ""}`}>
      <div className="chat-toolbar">
        <div>
          <span className="chat-toolbar-icon">
            <Sparkles size={17} />
          </span>
          <strong>Credential assistant</strong>
          <span className="chat-beta">AI ASSISTED</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => void loadSession(true)}
          disabled={busy || loading}
        >
          <Plus size={15} />
          New chat
        </Button>
      </div>
      {configured === false && (
        <div className="setup-banner">
          <Settings2 size={18} />
          <div>
            <strong>Your assistant is one key away.</strong>
            <p>
              Add <code>OPENAI_API_KEY</code> to <code>.env.local</code>, then
              restart the server. Your dashboard and credential checks are ready
              to use.
            </p>
          </div>
        </div>
      )}
      <div className="chat-scroll">
        {loading ? (
          <div className="chat-loading">
            <LoaderCircle className="spin" size={23} />
            <span>Loading your conversation…</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="chat-welcome">
            <div className="assistant-orb">
              <Sparkles size={29} />
              <span />
            </div>
            <div className="eyebrow">BEACON HEALTH SYSTEM</div>
            <h1>
              Your team.
              <br />
              <span>A little more clarity.</span>
            </h1>
            <p>
              Ask a question. Check a credential. Know what needs your
              attention.
            </p>
            <div className="prompt-grid">
              {prompts
                .slice(0, compact ? 4 : 6)
                .map(({ text, icon: Icon, detail }) => (
                  <button key={text} onClick={() => void submit(text)}>
                    <Icon size={18} />
                    <strong>{text}</strong>
                    <span>{detail}</span>
                    <ArrowUpRight className="prompt-arrow" size={15} />
                  </button>
                ))}
            </div>
            <div className="chat-grounded">
              <ShieldCheck size={13} /> Answers grounded in your credential
              records
            </div>
          </div>
        ) : (
          <div
            className="messages"
            aria-live="polite"
            aria-relevant="additions text"
          >
            {messages.map((m) => (
              <div
                key={m.id}
                className={`message message-${m.role} ${m.error ? "message-error" : ""}`}
              >
                {m.role === "assistant" && (
                  <span className="message-avatar">
                    <Sparkles size={17} />
                  </span>
                )}
                <div className="message-body">
                  {m.role === "assistant" && (
                    <div className="message-author">Credential assistant</div>
                  )}
                  {m.activities?.length ? (
                    <div className="tool-activities">
                      {m.activities.map((a) => (
                        <details key={a.id}>
                          <summary>
                            {a.done ? (
                              a.ok ? (
                                <Check size={13} />
                              ) : (
                                <TriangleAlert size={13} />
                              )
                            ) : (
                              <LoaderCircle size={13} className="spin" />
                            )}
                            {a.label}
                            <span>
                              {a.done
                                ? a.ok
                                  ? "Complete"
                                  : "Needs attention"
                                : "Working"}
                            </span>
                          </summary>
                          <p>
                            Approved credential tool ·{" "}
                            {a.done ? "Finished" : "In progress"}. Results come
                            from the application database or Michigan MILARA.
                          </p>
                        </details>
                      ))}
                    </div>
                  ) : null}
                  {m.role === "user" ? (
                    <p>{m.content}</p>
                  ) : (
                    <div
                      className={`markdown ${busy && m.id === messages.at(-1)?.id && m.content ? "streaming" : ""}`}
                    >
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          a: (props) => (
                            <a {...props} target="_blank" rel="noreferrer" />
                          ),
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {busy && (
              <div className="working-pill">
                <span />
                <span />
                <span />
                <strong>{activity}…</strong>
              </div>
            )}
          </div>
        )}
        <div ref={bottom} />
      </div>
      <div className="composer-wrap">
        {error && (
          <div className="chat-error" role="alert">
            <TriangleAlert size={15} />
            <span>{error}</span>
          </div>
        )}
        <form
          className="composer"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(draft);
          }}
        >
          <textarea
            ref={composer}
            value={draft}
            maxLength={6000}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                void submit(draft);
              }
            }}
            placeholder="Ask about your team’s credentials…"
            aria-label="Message credential assistant"
            rows={1}
            disabled={loading}
          />
          <div className="composer-footer">
            <span>
              <Sparkles size={13} /> Beacon Health System Credential Assistant
            </span>
            {busy ? (
              <button
                type="button"
                className="send-button stop"
                onClick={() => requestRef.current?.abort()}
                aria-label="Stop response"
              >
                <Square size={15} />
              </button>
            ) : (
              <button
                className="send-button"
                type="submit"
                disabled={!draft.trim() || loading || !configured}
                aria-label="Send message"
              >
                <ArrowUp size={19} />
              </button>
            )}
          </div>
        </form>
        <p className="chat-disclaimer">
          Verify important details with the state source.{" "}
          <span>Enter to send · Shift + Enter for a new line</span>
        </p>
      </div>
    </div>
  );
}
