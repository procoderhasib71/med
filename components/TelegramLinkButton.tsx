'use client';

import { useState } from 'react';
import { Send, Copy, Check } from 'lucide-react';
import { authFetch } from '@/lib/authFetch';

const BOT_USERNAME = 'Machranga_ai_bot';

// মাছরাঙা বটের সাথে জোড়া: কোড নিয়ে বটে "/site কোড" লিখলে বটের পড়া সাইটে দেখা যাবে
export default function TelegramLinkButton() {
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState('');

    const getCode = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await authFetch('/api/me/link-code', { method: 'POST' });
            const data = await res.json();
            if (data.success) setCode(data.code);
            else setError(data.error || 'কোড আনা যায়নি');
        } catch {
            setError('কোড আনা যায়নি');
        } finally {
            setLoading(false);
        }
    };

    const command = `/site ${code}`;

    if (!code) {
        return (
            <div className="mb-3">
                <button
                    onClick={getCode}
                    disabled={loading}
                    className="w-full py-3 rounded-xl bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-300 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors cursor-pointer disabled:opacity-60"
                >
                    <Send size={15} /> {loading ? 'কোড আনা হচ্ছে...' : 'Telegram বট মাছরাঙা-র সাথে যুক্ত করো'}
                </button>
                {error && <p className="text-[11px] text-rose-500 mt-1 text-center">{error}</p>}
            </div>
        );
    }

    return (
        <div className="mb-3 p-3 rounded-xl bg-sky-50 dark:bg-sky-950/30 text-xs text-slate-700 dark:text-slate-200 space-y-2">
            <p>১৫ মিনিটের মধ্যে বটে এটা লেখো:</p>
            <button
                onClick={() => { navigator.clipboard.writeText(command); setCopied(true); }}
                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-white dark:bg-slate-900 font-mono font-bold text-sm cursor-pointer"
            >
                {command} {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
            </button>
            <a
                href={`https://t.me/${BOT_USERNAME}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-center py-2 rounded-lg bg-sky-600 text-white font-bold"
            >
                বট খোলো
            </a>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">যুক্ত হলে বটে দেওয়া উত্তরও তোমার Analysis, Mistakes আর লিডারবোর্ডে যোগ হবে।</p>
        </div>
    );
}
