/**
 * Reusable Chat Widget component.
 * Can be embedded in any page with context-specific data.
 */

'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Send, X, MessageCircle, Loader2, Trash2 } from 'lucide-react'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  sourceCount?: number
  timestamp?: string
}

interface ChatWidgetProps {
  patientId: string
  contextType?: 'general' | 'journal' | 'reports'
  contextData?: string // Additional context to send with messages
  placeholder?: string
  title?: string
  inline?: boolean // If true, renders inline instead of floating
  storageKey?: string // localStorage key for persistence
}

const CHAT_STORAGE_PREFIX = 'hb_chat_'

function getChatHistory(key: string): ChatMessage[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(CHAT_STORAGE_PREFIX + key)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

function saveChatHistory(key: string, messages: ChatMessage[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(CHAT_STORAGE_PREFIX + key, JSON.stringify(messages))
  } catch {
    // Storage full, remove oldest
    localStorage.removeItem(CHAT_STORAGE_PREFIX + key)
  }
}

export function ChatWidget({
  patientId,
  contextType = 'general',
  contextData,
  placeholder = 'Ask about your health...',
  title = 'AI Health Chat',
  inline = false,
  storageKey,
}: ChatWidgetProps) {
  const chatKey = storageKey || `${contextType}_${patientId}`
  const [messages, setMessages] = useState<ChatMessage[]>(() => getChatHistory(chatKey))
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(inline)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Persist messages
  useEffect(() => {
    if (messages.length > 0) {
      saveChatHistory(chatKey, messages)
    }
  }, [messages, chatKey])

  const sendMessage = useCallback(async () => {
    if (!input.trim() || loading) return

    const userMsg: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: contextData
            ? `[Context: ${contextType}] ${input.trim()}\n\nAdditional context:\n${contextData}`
            : input.trim(),
          patientId,
          history: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
        }),
      })

      if (!res.ok) throw new Error('Failed to get response')

      const data = await res.json()
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.response,
        sourceCount: data.sourceCount,
        timestamp: new Date().toISOString(),
      }

      setMessages(prev => [...prev, assistantMsg])
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I couldn\'t process your request. Please try again.',
        timestamp: new Date().toISOString(),
      }])
    } finally {
      setLoading(false)
    }
  }, [input, loading, messages, patientId, contextType, contextData])

  const clearChat = useCallback(() => {
    setMessages([])
    localStorage.removeItem(CHAT_STORAGE_PREFIX + chatKey)
  }, [chatKey])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const chatContent = (
    <div className={`flex flex-col ${inline ? 'h-[500px]' : 'h-[70vh] max-h-[600px]'}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageCircle size={18} className="text-primary" />
          <span className="text-sm font-semibold text-text">{title}</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="rounded-lg p-1.5 text-muted hover:bg-bg hover:text-red-500"
              title="Clear chat"
            >
              <Trash2 size={16} />
            </button>
          )}
          {!inline && (
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1.5 text-muted hover:bg-bg"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <MessageCircle size={32} className="text-muted/40 mb-2" />
            <p className="text-sm text-muted">Ask me anything about your health data</p>
            <p className="text-xs text-muted/60 mt-1">I can see your reports, journal entries, and vitals</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-primary text-white rounded-br-sm'
                  : 'bg-card border border-border text-text rounded-bl-sm'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.sourceCount && msg.sourceCount > 0 && (
                <p className="mt-1 text-[10px] opacity-60">
                  Based on {msg.sourceCount} records
                </p>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-3 py-2">
              <Loader2 size={16} className="animate-spin text-primary" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={loading}
            className="flex-1 rounded-full bg-bg px-4 py-2 text-sm text-text placeholder:text-muted/50 focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-white disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </div>
        <p className="mt-1 text-center text-[10px] text-muted/50">
          AI assistant — not a substitute for medical advice
        </p>
      </div>
    </div>
  )

  if (inline) {
    return (
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        {chatContent}
      </div>
    )
  }

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-24 right-4 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-white shadow-lg hover:bg-primary/90 transition-transform hover:scale-105"
        >
          <MessageCircle size={22} />
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed inset-x-3 bottom-20 z-50 rounded-2xl border border-border bg-card shadow-2xl sm:left-auto sm:right-4 sm:w-[380px]">
          {chatContent}
        </div>
      )}
    </>
  )
}
