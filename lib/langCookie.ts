// ভাষার cookie এর নাম। আলাদা ফাইলে, কারণ 'use client' ফাইল (lib/i18n.tsx) থেকে সার্ভারের layout এ
// কোনো মান আনলে আসল লেখা নয়, client reference আসে।
export const LANG_COOKIE = 'admcq_lang';
export type Lang = 'bn' | 'en';
