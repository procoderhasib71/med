// অপেক্ষার সময় পুরো পর্দায় AdMCQ এর লোগো, চারপাশে ঘুরতে থাকা রঙিন বৃত্ত
// (ক্লাসরুমে লগইন/কোর্স যাচাই, লগইন পেজে আগে থেকে লগইন আছে কিনা দেখা, প্রোফাইল লোড)
export default function BrandLoader({ text = '' }: { text?: string }) {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-[#F8FAFC] dark:bg-[#0B1120]" role="status" aria-label="লোড হচ্ছে">
            <div className="relative w-20 h-20">
                {/* ঘুরন্ত বৃত্ত: conic gradient এর মাঝখানটা পেজের রঙে ঢাকা */}
                <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,transparent_0%,#10b981_45%,#3b82f6_80%,transparent_100%)] animate-spin [animation-duration:1.1s]" />
                <div className="absolute inset-[3px] rounded-full bg-[#F8FAFC] dark:bg-[#0B1120]" />
                <div className="absolute inset-[7px] rounded-full bg-emerald-500/10 animate-pulse" />
                <div className="absolute inset-0 flex items-center justify-center">
                    <span className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-blue-500 flex items-center justify-center font-black text-black text-2xl shadow-lg shadow-emerald-500/30">A</span>
                </div>
            </div>
            <div className="flex flex-col items-center gap-1">
                <span className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-white">Ad<span className="text-emerald-500">MCQ</span></span>
                {text && <span className="text-xs text-slate-500 dark:text-slate-400">{text}</span>}
            </div>
        </div>
    );
}
