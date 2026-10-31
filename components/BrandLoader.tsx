// পেজ তৈরি হওয়ার আগে পুরো পর্দায় AdMCQ এর লোগো (ক্লাসরুমে লগইন/কোর্স যাচাইয়ের সময়)
export default function BrandLoader() {
    return (
        <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-[#F8FAFC] dark:bg-[#0B1120]">
            <div className="flex items-center gap-2.5">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-500 to-blue-500 flex items-center justify-center font-black text-black text-2xl shadow-lg shadow-emerald-500/20">A</div>
                <span className="font-extrabold text-3xl tracking-tight text-slate-900 dark:text-white">Ad<span className="text-emerald-500">MCQ</span></span>
            </div>
            <div className="w-28 h-1 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                <div className="h-full w-1/2 rounded-full bg-emerald-500 animate-[brandbar_1s_ease-in-out_infinite]" />
            </div>
        </div>
    );
}
