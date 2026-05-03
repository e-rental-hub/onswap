'use client';
import { useState, useRef, useEffect } from 'react';
import { Message, User } from '@/types';
import { ordersApi } from '@/lib/api';
import { logger } from '@/lib/logger';

interface Props {
  orderId: string;
  messages: Message[];
  currentUser: User;
  onNewMessage: (msg: Message) => void;
}

export default function OrderChat({ orderId, messages, currentUser, onNewMessage }: Props) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const res = await ordersApi.sendMessage(orderId, { content });
      onNewMessage(res.data.message);
      setText('');
      logger.info('Message sent');
    } catch (err) {
      logger.error('Failed to send message:', err);
    } finally {
      setSending(false);
    }
  };

  const getSenderId = (sender: string | User) =>
    typeof sender === 'string' ? sender : sender.id || (sender as unknown as { _id: string })._id;

  const getSenderName = (sender: string | User) =>
    typeof sender === 'object' ? sender.displayName : 'User';

  return (
    <div className="card flex flex-col" style={{ height: '420px' }}>
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="w-2 h-2 rounded-full bg-green-400"></div>
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Order Chat</span>
        <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>End-to-end secured</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8 text-sm" style={{ color: 'var(--text-muted)' }}>
            No messages yet. Start the conversation.
          </div>
        )}
        {messages.map((msg, i) => {
          const isMe = getSenderId(msg.sender) === currentUser.id;
          const isSystem = msg.type === 'system';

          if (isSystem) {
            return (
              <div key={i} className="chat-bubble-system px-4 py-2 mx-4">
                {msg.content}
              </div>
            );
          }

          return (
            <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-xs">
                {!isMe && (
                  <div className="text-xs mb-1 ml-1" style={{ color: 'var(--text-muted)' }}>
                    {getSenderName(msg.sender)}
                  </div>
                )}
                <div className={`px-4 py-2.5 text-sm ${isMe ? 'chat-bubble-me' : 'chat-bubble-other'}`}
                  style={{ color: 'var(--text-primary)' }}>
                  {msg.content}
                </div>
                <div className={`text-xs mt-1 ${isMe ? 'text-right mr-1' : 'ml-1'}`} style={{ color: 'var(--text-muted)' }}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t flex gap-2" style={{ borderColor: 'var(--border-subtle)' }}>
        <input
          className="input-dark flex-1 text-sm"
          style={{ padding: '8px 12px' }}
          placeholder="Type a message…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="btn-pi px-4 py-2 text-sm"
          style={{ minWidth: '64px' }}
        >
          {sending ? '…' : 'Send'}
        </button>
      </div>
    </div>
  );
}
