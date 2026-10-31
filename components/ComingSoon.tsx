'use client';

import Link from 'next/link';
import { useLang } from '@/lib/i18n';
import { PLATFORMS, type Platform } from '@/lib/platform';

// যে প্ল্যাটফর্মে এখনো প্রশ্ন যোগ হয়নি
export default function ComingSoon({ platform }: { platform: Platform }) {
    const { t } = useLang();
    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-800 dark:text-slate-100">
            <div className="text-5xl">⏳</div>
            <h1 className="text-xl font-black">{t(`${PLATFORMS[platform].name} এর প্রশ্নব্যাংক শীঘ্রই আসছে`, `${PLATFORMS[platform].short} question bank is coming soon`)}</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                {t('প্রশ্ন যোগ হলেই এখানে প্র্যাকটিস, মডেল টেস্ট আর অ্যানালাইসিস চালু হবে। তোমার অ্যাকাউন্ট একই থাকবে।', 'Practice, model tests and analysis open here once questions are added. Your account stays the same.')}
            </p>
            <Link href="/" className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold">{t('হোমে ফিরে যাও', 'Back to home')}</Link>
        </div>
    );
}
