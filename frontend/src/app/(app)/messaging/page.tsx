"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { Loader2, Plus, X, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

interface Conversation {
  id: string;
  conversation_type: string;
  title: string | null;
  is_pinned: boolean;
  is_archived: boolean;
  updated_at: string;
}

function NewConversationModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [participantIds, setParticipantIds] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const ids = participantIds.split(",").map((s) => s.trim()).filter(Boolean);
    if (!ids.length) {
      toast.error("Add at least one participant's user ID.");
      return;
    }
    setIsSubmitting(true);
    try {
      await apiClient.post("/conversations", { participant_ids: ids, title: title || null });
      toast.success("Conversation started.");
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Couldn't start this conversation.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-text">New Conversation</h3>
          <button onClick={onClose} className="text-text/50 hover:text-text"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-text mb-1">Title (optional)</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text mb-1">Participant user IDs *</label>
            <input
              value={participantIds}
              onChange={(e) => setParticipantIds(e.target.value)}
              placeholder="comma-separated user IDs"
              className="w-full rounded border border-border bg-background px-3 py-2 text-text focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-text/40 mt-1">Find user IDs on the Users page.</p>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-2 rounded bg-primary text-white py-2.5 font-medium hover:opacity-90 disabled:opacity-60 mt-2"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Start Conversation
          </button>
        </form>
      </div>
    </div>
  );
}

export default function MessagingPage() {
  const [showModal, setShowModal] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => (await apiClient.get("/conversations")).data.data as Conversation[],
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-text">Messages</h2>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded text-sm font-medium hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> New
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !data?.length ? (
        <div className="bg-card border border-border rounded-lg py-16 text-center text-text/50 text-sm flex flex-col items-center gap-2">
          <MessageSquare className="h-6 w-6 text-text/30" />
          No conversations yet.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg divide-y divide-border overflow-hidden">
          {data.map((c) => (
            <Link key={c.id} href={`/messaging/${c.id}`} className="p-4 flex items-center justify-between hover:bg-border/10 block">
              <div>
                <p className="text-sm font-medium text-text">{c.title || `${c.conversation_type} conversation`}</p>
                <p className="text-xs text-text/40 mt-0.5">Updated {new Date(c.updated_at).toLocaleString()}</p>
              </div>
              {c.is_pinned && <span className="text-xs text-primary">Pinned</span>}
            </Link>
          ))}
        </div>
      )}

      {showModal && <NewConversationModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
