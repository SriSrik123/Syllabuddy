import { useState, useRef, useEffect } from 'react';
import { aiAPI } from '../services/api';
import toast from 'react-hot-toast';
import { Send, Loader2, MessageSquare, Bot, User } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
}

const SUGGESTIONS = [
  "What are all my upcoming exams?",
  "Grading breakdown for each class?",
  "When are assignments due this month?",
  "Office hours for my professors?",
  "Summarize attendance policies",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (question: string) => {
    if (!question.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: question.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const chatHistory = messages.map(m => ({ role: m.role, content: m.content }));
      const res = await aiAPI.chat(question.trim(), chatHistory);
      const assistantMsg: Message = {
        role: 'assistant',
        content: res.data.answer,
        sources: res.data.sources,
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to get AI response');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please check your AI credentials and try again.',
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="max-w-3xl mx-auto flex flex-col h-[calc(100vh-5rem)]">
      {/* Header */}
      <div className="mb-4">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Ask AI</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          Search across all your syllabi with natural language.
        </p>
      </div>

      {/* Chat area */}
      <div className="flex-1 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-10 h-10 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-3">
                <MessageSquare className="w-5 h-5 text-blue-500 dark:text-blue-400" />
              </div>
              <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                Ask anything about your syllabi
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mb-5">
                Questions about deadlines, grading, course content, professor info, and more.
              </p>
              <div className="flex flex-wrap gap-1.5 justify-center max-w-md">
                {SUGGESTIONS.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(s)}
                    className="text-xs px-2.5 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="w-6 h-6 bg-blue-50 dark:bg-blue-900/30 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Bot className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  </div>
                )}
                <div className={`max-w-[75%] ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-lg rounded-br-sm px-3.5 py-2.5'
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg rounded-bl-sm px-3.5 py-2.5'
                }`}>
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{msg.content}</p>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className={`mt-2 pt-2 border-t ${
                      msg.role === 'user' ? 'border-blue-500' : 'border-gray-200 dark:border-gray-700'
                    }`}>
                      <p className="text-[11px] text-gray-400 dark:text-gray-500">
                        Sources: {msg.sources.join(', ')}
                      </p>
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center flex-shrink-0 mt-0.5">
                    <User className="w-3.5 h-3.5 text-white" />
                  </div>
                )}
              </div>
            ))
          )}
          {loading && (
            <div className="flex gap-2.5">
              <div className="w-6 h-6 bg-blue-50 dark:bg-blue-900/30 rounded flex items-center justify-center flex-shrink-0">
                <Bot className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg rounded-bl-sm px-3.5 py-2.5">
                <div className="flex items-center gap-2 text-[13px] text-gray-500 dark:text-gray-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Searching...
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="px-4 py-3 border-t border-gray-200 dark:border-gray-800">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              disabled={loading}
              className="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-shadow disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
