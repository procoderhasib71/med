'use client';

import React from 'react';
import { InlineMath, BlockMath } from 'react-katex';
import 'katex/dist/katex.min.css';

export default function RenderTextOrMath({ text }: { text: string }) {
    if (!text) return null;

    // ১. ডাবল "ব্যাখ্যা: ব্যাখ্যাঃ" ক্লিন করা
    let cleanStr = text.replace(/^(ব্যাখ্যা[ঃ:]\s*)+/gi, 'ব্যাখ্যাঃ ');

    // ২. ব্রোকেন OCR ক্যারেক্টার ও ভুল কোড ফিক্স
    cleanStr = cleanStr.replace(/[\u09F1ৱ]/g, '১');

    // ৩. এস্কেপ ক্যারেক্টার ও টাইপো ফিক্স (\frac, \vec, \beta, \bar, \because)
    cleanStr = cleanStr
        .replace(/\x0c/g, '\\f')
        .replace(/[↑\u2191]rac/g, '\\frac')
        .replace(/\\x0crac/g, '\\frac')
        // \because ও Backspace (\x08 / \b) ফিক্স
        .replace(/\x08ecause/g, '\\because ')
        .replace(/[\u0008]ecause/g, '\\because ')
        // ভেক্টর, গ্রিক প্রতীক ও বার ফিক্স
        .replace(/\x0bec/g, '\\vec')
        .replace(/\x0b/g, '\\vec ')
        .replace(/\x08eta/g, '\\beta')
        .replace(/\x08ar/g, '\\bar');

    // ৪. KaTeX Math মোডের ভেতরের বাংলা সংখ্যা ইংরেজিতে কনভার্ট করা
    cleanStr = cleanStr.replace(/(\$\$[\s\S]*?\$\$|\$[^\$]+?\$)/g, (match) => {
        return match
            .replace(/০/g, '0')
            .replace(/১/g, '1')
            .replace(/২/g, '2')
            .replace(/৩/g, '3')
            .replace(/৪/g, '4')
            .replace(/৫/g, '5')
            .replace(/৬/g, '6')
            .replace(/৭/g, '7')
            .replace(/৮/g, '8')
            .replace(/৯/g, '9');
    });

    // ➕ মিসিং ডলার ($) ও আন-এনক্লোজড ল্যাটেক্স অটো-ফিক্স
    const hasLatexCommands = /\\(frac|text|times|cong|pm|sqrt|sum|alpha|beta|theta|vec|bar|because)/.test(cleanStr);
    if (hasLatexCommands) {
        const dollarCount = (cleanStr.match(/\$/g) || []).length;
        if (dollarCount % 2 !== 0) {
            cleanStr = `${cleanStr}$`;
        }
    }

    // ৫. রসায়নের সংকেত ফরম্যাট
    const formatChemicalText = (str: string) => {
        if (!str) return '';
        return str
            .replace(/([A-Z][a-z]?|\))([0-9]+)/g, '$1<sub>$2</sub>')
            .replace(/\^([0-9]*[\+\-])/g, '<sup>$1</sup>');
    };

    // ৬. টেক্সট ও ম্যাথ টোকেনাইজার রেজেক্স
    const regex = /(\$\$[\s\S]*?\$\$|\$[^\$]+?\$|\\frac\s*\{.*?\}(?:\s*\{.*?\})?|(?:\\[a-zA-Z]+(?:\{[^{}]*\}\vert{}\[[^\[\]]*\])*(?:_[0-9a-zA-Z]+|_{[^{}]*})?(?:\^[0-9a-zA-Z]+|\^{[^{}]*})?)+)/g;
    const parts = cleanStr.split(regex);

    return (
        <div className="text-[15px] sm:text-base leading-relaxed whitespace-pre-line text-left font-normal text-slate-700 dark:text-slate-300 tracking-normal antialiased">
            {parts.map((part, index) => {
                if (!part) return null;

                // 📐 Block Math ($$...$$)
                if (part.startsWith('$$') && part.endsWith('$$') && part.length >= 4) {
                    const math = part.slice(2, -2).trim();
                    return (
                        <div
                            key={index}
                            className="my-2 text-left overflow-x-auto overflow-y-hidden no-scrollbar text-[1.05em] [&_.katex-display]:!my-0.5 [&_.katex-display]:!text-left [&_.katex-display>.katex]:!text-left"
                        >
                            <BlockMath
                                math={math}
                                renderError={() => <span className="text-red-500 font-mono text-xs">{part}</span>}
                                settings={{ strict: false, trust: true }}
                            />
                        </div>
                    );
                }

                // 📐 Inline Math ($...$)
                if (part.startsWith('$') && part.endsWith('$') && part.length >= 2) {
                    const math = part.slice(1, -1).trim();
                    const mathWithDisplayStyle = math.includes('\\frac') && !math.startsWith('\\displaystyle')
                        ? `\\displaystyle ${math}`
                        : math;

                    return (
                        <span
                            key={index}
                            className="inline-block mx-1 align-middle text-[1em] overflow-x-auto overflow-y-hidden no-scrollbar max-w-full [&_.katex]:!text-[1em]"
                        >
                            <InlineMath
                                math={mathWithDisplayStyle}
                                renderError={() => <span>{part}</span>}
                                settings={{ strict: false, trust: true }}
                            />
                        </span>
                    );
                }

                // 📐 Raw LaTeX
                if (part.startsWith('\\')) {
                    const rawWithDisplay = part.includes('\\frac') && !part.startsWith('\\displaystyle')
                        ? `\\displaystyle ${part}`
                        : part;

                    return (
                        <span
                            key={index}
                            className="inline-block mx-1 align-middle text-[1em] overflow-x-auto overflow-y-hidden no-scrollbar max-w-full [&_.katex]:!text-[1em]"
                        >
                            <InlineMath
                                math={rawWithDisplay}
                                renderError={() => <span>{part}</span>}
                                settings={{ strict: false, trust: true }}
                            />
                        </span>
                    );
                }

                // 📝 সাধারণ টেক্সট (বাংলা ও ইংরেজি)
                return (
                    <span
                        key={index}
                        dangerouslySetInnerHTML={{ __html: formatChemicalText(part) }}
                    />
                );
            })}
        </div>
    );
}