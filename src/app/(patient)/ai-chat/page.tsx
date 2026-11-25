'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { ArrowLeft, Send, Bot, User, Loader2, Trash2 } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  sourceCount?: number
  timestamp?: string
}

const CHAT_STORAGE_KEY = 'hb_chat_main'

function loadMessages(): Message[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(CHAT_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveMessages(messages: Message[]) {
  try {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages))
  } catch { /* storage full */ }
}

export default function AIChatPage() {
  const { patientId } = useAuth()
  const router = useRouter()
  const [messages, setMessages] = useState<Message[]>(() => loadMessages())
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Persist messages
  useEffect(() => {
    if (messages.length > 0) {
      saveMessages(messages)
    }
  }, [messages])

  const clearChat = useCallback(() => {
    setMessages([])
    localStorage.removeItem(CHAT_STORAGE_KEY)
  }, [])

  const handleSend = useCallback(async () => {
    // if (!input.trim() || !patientId || loading) return --this is commented for prod enable it 
    if (!input.trim() || loading) return

    const effectivePatientId =
      patientId || (process.env.NODE_ENV === 'development' ? 'dev-patient' : null)

    if (!effectivePatientId) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({
        //     message: userMessage.content,
        //     patientId,
        //     history: messages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
        //   }


        // ),
        body: JSON.stringify({
          message: userMessage.content,
          patientId: effectivePatientId,
          history: messages.slice(-6).map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to get response')
      }

      const data = await response.json()

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response,
        sourceCount: data.sourceCount,
        timestamp: new Date().toISOString(),
      }

      setMessages((prev) => [...prev, aiMessage])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: "I'm sorry, I couldn't process your request. Please try again.",
          timestamp: new Date().toISOString(),
        },
      ])
    } finally {
      setLoading(false)
    }
  }, [input, patientId, loading, messages])

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button onClick={() => router.back()} className="rounded-lg p-2 hover:bg-bg">
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-1 items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
            <Bot size={16} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text">Ask AI</p>
            <p className="text-[10px] text-muted">Based on your health records</p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="rounded-lg p-2 text-muted hover:bg-bg hover:text-red-500"
            title="Clear chat history"
          >
            <Trash2 size={18} />
          </button>
        )}
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center pt-20 text-center">
            <Bot size={40} className="mb-3 text-primary/30" />
            <p className="text-sm font-medium text-text">Ask about your health records</p>
            <p className="mt-1 max-w-xs text-xs text-muted">
              I can help you understand your reports, track trends, or answer questions based on your medical history.
            </p>
            <div className="mt-4 space-y-2">
              {SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => setInput(suggestion)}
                  className="block w-full rounded-lg border border-border bg-card px-3 py-2 text-left text-xs text-text hover:border-primary/30"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`mb-4 flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Bot size={14} className="text-primary" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${msg.role === 'user'
                  ? 'bg-primary text-white'
                  : 'bg-card border border-border text-text'
                }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.sourceCount && msg.sourceCount > 0 && (
                <p className="mt-2 text-[10px] opacity-60">
                  Based on {msg.sourceCount} records
                </p>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary">
                <User size={14} className="text-white" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="mb-4 flex gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Bot size={14} className="text-primary" />
            </div>
            <div className="rounded-2xl border border-border bg-card px-4 py-3">
              <Loader2 size={16} className="animate-spin text-primary" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Disclaimer + Input */}
      <div className="border-t border-border bg-card px-4 pb-[env(safe-area-inset-bottom)] pt-2">
        <p className="mb-2 text-center text-[10px] text-muted">
          AI assistant — not a substitute for medical advice
        </p>
        <div className="flex items-center gap-2 pb-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Ask about your health records..."
            className="input flex-1"
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="btn-primary !min-h-[44px] !min-w-[44px] !p-0"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  )
}

const SUGGESTIONS = [
  'What does my latest blood test show?',
  'How is my blood sugar trending?',
  'Summarize my recent health records',
  'What should I discuss with my doctor?',
]
