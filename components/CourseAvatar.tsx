'use client';

import { useCourse } from '@/components/CourseProvider';
import type { Platform } from '@/lib/platform';

// প্রোফাইলের ছবি: চালু কোর্স অনুযায়ী একটা নির্দিষ্ট চরিত্র, গোল আর হালকা রঙের পটভূমিতে।
// মেডিকেলে সাদা অ্যাপ্রন আর গলায় স্টেথোস্কোপসহ ডাক্তার, ভার্সিটিতে গ্র্যাজুয়েশন টুপি, ইঞ্জিনিয়ারিংয়ে হেলমেট।
// সব ডিভাইসে একই রকম দেখাতে emoji নয়, SVG।

const BG: Record<Platform, string> = {
    med: '#D1FAE5',
    ka: '#DBEAFE',
    kha: '#FEF3C7',
    eng: '#E0E7FF',
};

function Figure({ p }: { p: Platform }) {
    const skin = '#F5CBA7';
    const hair = '#3B2F2F';
    const coat = p === 'med' ? '#FFFFFF' : p === 'eng' ? '#2563EB' : p === 'kha' ? '#B45309' : '#1D4ED8';
    return (
        <svg viewBox="0 0 64 64" className="w-full h-full" aria-hidden>
            <circle cx="32" cy="32" r="32" fill={BG[p]} />
            <g>
                {/* জামা */}
                <path d="M8 66c1-13 11-20 24-20s23 7 24 20z" fill={coat} stroke={p === 'med' ? '#CBD5E1' : 'none'} strokeWidth="1" />
                {p === 'med' && (
                    <>
                        {/* অ্যাপ্রনের ভেতরের সবুজ জামা আর কলার */}
                        <path d="M26 46l6 9 6-9z" fill="#10B981" />
                        <path d="M26 46l6 9-3 11h-3z M38 46l-6 9 3 11h3z" fill="#F1F5F9" />
                    </>
                )}
                {p !== 'med' && <path d="M27 46l5 6 5-6z" fill="#F8FAFC" />}
                {/* গলা আর মাথা */}
                <rect x="28.5" y="38" width="7" height="9" rx="3" fill={skin} />
                <circle cx="32" cy="29" r="11.5" fill={skin} />
                <path d="M20.5 28c-.5-8 4.5-13.5 11.5-13.5S44 20 43.5 28c-1.5-3.5-4-5.5-8-6-3 2.5-8 3.5-15 6z" fill={hair} />
                <circle cx="27.8" cy="30.5" r="1.3" fill="#1F2937" />
                <circle cx="36.2" cy="30.5" r="1.3" fill="#1F2937" />
                <circle cx="25.5" cy="34" r="1.6" fill="#F9A8A8" opacity=".55" />
                <circle cx="38.5" cy="34" r="1.6" fill="#F9A8A8" opacity=".55" />
                <path d="M29.3 35c1.6 1.3 3.8 1.3 5.4 0" stroke="#9A5B3C" strokeWidth="1.4" fill="none" strokeLinecap="round" />

                {p === 'med' && (
                    <g fill="none" stroke="#334155" strokeWidth="1.8" strokeLinecap="round">
                        {/* স্টেথোস্কোপ: গলার দুই পাশ থেকে নেমে বুকের চাকতিতে */}
                        <path d="M25 46c-1.5 5 .5 9 5 10.5" />
                        <path d="M39 46c1.5 4.5 0 8-3 9.5" />
                        <circle cx="35" cy="56.5" r="2.4" fill="#94A3B8" stroke="#334155" />
                    </g>
                )}
                {(p === 'ka' || p === 'kha') && (
                    <g>
                        <path d="M17 20.5l15-7 15 7-15 7z" fill="#0F172A" />
                        <path d="M24.5 23.5v3.5c0 2 3.4 3.4 7.5 3.4s7.5-1.4 7.5-3.4v-3.5l-7.5 3.5z" fill="#1E293B" />
                        <path d="M45 21v7" stroke="#FACC15" strokeWidth="1.6" strokeLinecap="round" />
                        <circle cx="45" cy="28.8" r="1.5" fill="#FACC15" />
                    </g>
                )}
                {p === 'eng' && (
                    <g>
                        <path d="M19.5 26c0-8 5.5-13 12.5-13s12.5 5 12.5 13z" fill="#FACC15" />
                        <rect x="17.5" y="24.5" width="29" height="3.5" rx="1.75" fill="#EAB308" />
                        <rect x="30.5" y="13" width="3" height="11" rx="1.5" fill="#EAB308" />
                    </g>
                )}
            </g>
        </svg>
    );
}

/** className: মাপ (যেমন 'w-9 h-9')। ছবিটা সবসময় গোল। */
export default function CourseAvatar({ className = 'w-9 h-9', platform }: { className?: string; rounded?: string; platform?: Platform }) {
    const { info } = useCourse();
    const p = platform || info?.current || 'med';
    return (
        <span className={`inline-block rounded-full overflow-hidden shrink-0 ${className}`}>
            <Figure p={p} />
        </span>
    );
}
