'use client';
import { InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';

export default function RenderTextOrMath({ text }: { text: string }) {
    if (!text) return null;

    const formatChemicalText = (str: string) => {
        if (!str) return '';

        let formatted = str;

        // 1. ডাটাবেজে থাকা আন্ডারস্কোর সাবস্ক্রিপ্ট ফরম্যাট (যেমন: H_2S, H_2SO_4, CH_3CSNH_2)
        // এটি কেবল আন্ডারস্কোরের ঠিক পরের সংখ্যাকে সাবস্ক্রিপ্ট করবে (ক্যাপিটাল লেটার বাদ দিয়ে)
        formatted = formatted.replace(/_([0-9]+)/g, '<sub>$1</sub>');
        formatted = formatted.replace(/_\{([^}]+)\}/g, '<sub>$1</sub>');

        // 2. সাধারণ কেমিক্যাল সংকেতের সংখ্যা সাবস্ক্রিপ্ট (যেমন: H2, SO4, CH3, H2O, (NH4)2)
        // ক্যাপিটাল এলিমেন্ট সিম্বল (H, Fe, Na, O, C) বা ক্লোজিং ব্র্যাকেটের পরের ডিজিট সাবস্ক্রিপ্ট হবে
        formatted = formatted.replace(/([A-Z][a-z]?|\))([0-9]+)/g, '$1<sub>$2</sub>');

        // 3. আয়নের চার্জ (Superscript, যেমন: Fe2+, SO4^2-, H+)
        formatted = formatted.replace(/\^([0-9]*[\+\-])/g, '<sup>$1</sup>');

        return formatted;
    };

    const hasMath = text.includes('\\') || text.includes('^');

    if (!hasMath) {
        const formattedHtml = formatChemicalText(text);
        return <span dangerouslySetInnerHTML={{ __html: formattedHtml }} />;
    }

    // Capture complete LaTeX commands with arguments like \frac{a}{b}, \sqrt{x}, \vec{v}, etc. or exponents like ^2 or ^{10}
    const parts = text.split(/(\\[a-zA-Z]+(?:\{[^{}]*\}|\[[^\[\]]*\])*(?:_[0-9a-zA-Z]+|_{[^{}]*})?(?:\^[0-9a-zA-Z]+|\^{[^{}]*})?|\^{.*?}|\^[0-9a-zA-Z]+)/g);

    return (
        <span className="leading-relaxed">
            {parts.map((part, index) => {
                if (!part) return null;

                if (part.startsWith('\\') || part.startsWith('^')) {
                    const katexMath = part.startsWith('^') ? `{}${part}` : part;
                    return (
                        <span key={index} className="inline-block mx-0.5">
                            <InlineMath math={katexMath} renderError={() => <span>{part}</span>} />
                        </span>
                    );
                }

                const formattedPart = formatChemicalText(part);
                return (
                    <span key={index} dangerouslySetInnerHTML={{ __html: formattedPart }} />
                );
            })}
        </span>
    );
}