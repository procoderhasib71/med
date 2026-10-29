import Link from 'next/link';
import { ACCOUNT_URL, PLATFORMS, type Platform } from '@/lib/platform';

// যে প্ল্যাটফর্মে এখনো প্রশ্ন যোগ হয়নি
export default function ComingSoon({ platform }: { platform: Platform }) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 text-center bg-[#F8FAFC] dark:bg-[#0B1120] text-slate-800 dark:text-slate-100">
            <div className="text-5xl">⏳</div>
            <h1 className="text-xl font-black">{PLATFORMS[platform].name} এর প্রশ্নব্যাংক শীঘ্রই আসছে</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 max-w-sm">
                প্রশ্ন যোগ হলেই এখানে প্র্যাকটিস, মডেল টেস্ট আর Analysis চালু হবে। তোমার অ্যাকাউন্ট একই থাকবে।
            </p>
            <Link href={ACCOUNT_URL} className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-bold">অন্য প্ল্যাটফর্ম দেখো</Link>
        </div>
    );
}
