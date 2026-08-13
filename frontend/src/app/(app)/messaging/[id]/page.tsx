"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { useAuth } from "@/context/auth-context";
import { Loader2, ArrowLeft, Send, Archive } from "lucide-react";
import { toast } from "sonner";
import clsx from "clsx";

interface Message {
  id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

interface ConversationDetail {
  id: string;
  conversation_type: string;
  title: string | null;
  other_participants: { user_id: string; full_name: string | null }[];
}

export default function ConversationThreadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [content, setContent] = useState("");
  const [isSending, setIsSending] = useState(false);

  const { data: conversation } = useQuery({
    queryKey: ["conversation", id],
    queryFn: async () => (await apiClient.get(`/conversations/${id}`)).data.data as ConversationDetail,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["messages", id],
    queryFn: async () => (await apiClient.get(`/conversations/${id}/messages`, { params: { page_size: 100 } })).data.data as Message[],
    refetchInterval: 10000,
  });

  const headerLabel =
    conversation?.title ||
    conversation?.other_participants?.map((p) => p.full_name || "Unknown user").join(", ") ||
    "Conversation";

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setIsSending(true);
    try {
      await apiClient.post(`/conversations/${id}/messages`, { content });
      setContent("");
      queryClient.invalidateQueries({ queryKey: ["messages", id] });
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't send that message.");
    } finally {
      setIsSending(false);
    }
  }

  async function archive() {
    try {
      await apiClient.patch(`/conversations/${id}/archive`);
      toast.success("Conversation archived.");
      router.push("/messaging");
    } catch {
      toast.error("Couldn't archive this conversation.");
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => router.push("/messaging")} className="flex items-center gap-1 text-sm text-text/60 hover:text-text">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <h2 className="text-sm font-semibold text-text">{headerLabel}</h2>
        <button onClick={archive} className="flex items-center gap-1 text-xs text-red-500 hover:underline">
          <Archive className="h-3 w-3" /> Archive
        </button>
      </div>

      <div className="flex-1 overflow-y-auto bg-card border border-border rounded-lg p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : !data?.length ? (
          <p className="text-center text-text/50 text-sm py-16">No messages yet. Say hello.</p>
        ) : (
          data.map((m) => {
            const mine = m.sender_id === user?.id;
            return (
              <div key={m.id} className={clsx("flex", mine ? "justify-end" : "justify-start")}>
                <div className={clsx("max-w-[75%] rounded-lg px-3 py-2 text-sm", mine ? "bg-primary text-white" : "bg-border/30 text-text")}>
                  <p>{m.content}</p>
                  <p className={clsx("text-[10px] mt-1", mine ? "text-white/70" : "text-text/40")}>
                    {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      <form onSubmit={sendMessage} className="flex gap-2 mt-3">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 rounded border border-border bg-background px-3 py-2.5 text-sm text-text focus:outline-none focus:ring-2 focus:ring-primary"
        />
        <button
          type="submit"
          disabled={isSending || !content.trim()}
          className="flex items-center justify-center rounded bg-primary text-white px-4 hover:opacity-90 disabled:opacity-60"
        >
          {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </form>
    </div>
  );
}
