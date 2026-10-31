'use client';

import { useCourse } from '@/components/CourseProvider';
import type { Platform } from '@/lib/platform';

// প্রোফাইলের ছবি: চালু কোর্স অনুযায়ী একটা নির্দিষ্ট চরিত্র। মেডিকেলে গলায় স্টেথোস্কোপসহ ডাক্তার,
// ভার্সিটিতে গ্র্যাজুয়েশন টুপি পরা ছাত্র, ইঞ্জিনিয়ারিংয়ে হলুদ হেলমেট। সব ডিভাইসে একই রকম দেখাতে emoji নয়, SVG।

const BG: Record<Platform, string> = {
    med: 'from-emerald-400 to-teal-600',
    ka: 'from-sky-400 to-blue-600',
    kha: 'from-amber-300 to-orange-500',
    eng: 'from-cyan-400 to-indigo-600',
};

function Figure({ p }: { p: Platform }) {
    const skin = '#F2C9A0';
    const hair = '#2B2B33';
    return (
        <svg viewBox="0 0 64 64" className="w-full h-full" aria-hidden>
            {/* কাঁধ আর জামা: ডাক্তারের সাদা অ্যাপ্রন, অন্যদের রঙিন জামা */}
            <path d="M10 64c0-13 9.5-20 22-20s22 7 22 20z" fill={p === 'med' ? '#FFFFFF' : p === 'eng' ? '#1E3A8A' : '#334155'} />
            {p === 'med' && <path d="M27 44l5 9 5-9" fill="#CBD5E1" />}
            {p !== 'med' && <path d="M27 44l5 6 5-6" fill="#F8FAFC" />}
            {/* গলা আর মাথা */}
            <rect x="28" y="36" width="8" height="8" rx="3" fill={skin} />
            <circle cx="32" cy="27" r="11" fill={skin} />
            <path d="M21 26c0-8 5-13 11-13s11 5 11 13c-2-4-6-6-11-6s-9 2-11 6z" fill={hair} />
            <circle cx="28" cy="28" r="1.3" fill="#1F2937" />
            <circle cx="36" cy="28" r="1.3" fill="#1F2937" />
            <path d="M29 32.5c1.8 1.4 4.2 1.4 6 0" stroke="#9A5B3C" strokeWidth="1.4" fill="none" strokeLinecap="round" />

            {p === 'med' && (
                <g fill="none" stroke="#0F172A" strokeWidth="2" strokeLinecap="round">
                    {/* স্টেথোস্কোপ: গলায় ঝোলানো, বুকের কাছে চাকতি */}
                    <path d="M24 44c-2 6 0 11 5 12" />
                    <path d="M40 44c2 5 1 9-2 11" />
                    <circle cx="36" cy="56.5" r="2.6" fill="#94A3B8" />
                </g>
            )}
            {(p === 'ka' || p === 'kha') && (
                <g>
                    {/* গ্র্যাজুয়েশন টুপি */}
                    <path d="M17 18l15-7 15 7-15 7z" fill="#0F172A" />
                    <path d="M24 21v4c0 2 3.5 3.5 8 3.5s8-1.5 8-3.5v-4l-8 3.7z" fill="#1E293B" />
                    <path d="M45 18.5v7" stroke="#FACC15" strokeWidth="1.6" strokeLinecap="round" />
                    <circle cx="45" cy="26.5" r="1.4" fill="#FACC15" />
                </g>
            )}
            {p === 'eng' && (
                <g>
                    {/* হলুদ হেলমেট */}
                    <path d="M19 24c0-8 6-13 13-13s13 5 13 13z" fill="#FACC15" />
                    <rect x="17" y="22.5" width="30" height="3.5" rx="1.75" fill="#EAB308" />
                    <rect x="30.5" y="11" width="3" height="11" rx="1.5" fill="#EAB308" />
                </g>
            )}
        </svg>
    );
}

/** size: Tailwind এর মাপ (যেমন 'w-9 h-9'); rounded: কোণার গোলাই */
export default function CourseAvatar({ className = 'w-9 h-9', rounded = 'rounded-xl', platform }: { className?: string; rounded?: string; platform?: Platform }) {
    const { info } = useCourse();
    const p = platform || info?.current || 'med';
    return (
        <span className={`inline-flex items-end justify-center overflow-hidden bg-gradient-to-br ${BG[p]} ${rounded} ${className} shrink-0`}>
            <Figure p={p} />
        </span>
    );
}
