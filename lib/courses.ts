// চারটা কোর্স: প্রোফাইলে নেওয়া কোর্সগুলো চালু, বাকিগুলোতে "কোর্স নিন" (admcq.com এর landing এও একই তালিকা)
export const COURSES = [
    {
        id: 'med',
        title: 'Medical & Dental',
        name: 'মেডিকেল ও ডেন্টাল',
        url: 'https://med.admcq.com',
        stats: '8.5k+ MCQ',
        accent: 'emerald',
        includes: ['মেডিকেল ও ডেন্টাল প্রশ্নব্যাংক (সাল অনুযায়ী)', 'অধ্যায়ভিত্তিক প্র্যাকটিস ও মডেল টেস্ট', 'ভুল প্রশ্নের তালিকা ও বুকমার্ক', 'সারাদেশের লিডারবোর্ড'],
    },
    {
        id: 'ka',
        title: "Varsity 'Ka' Science",
        name: "ভার্সিটি 'ক' ইউনিট",
        url: 'https://ka.admcq.com',
        stats: '12k+ MCQ',
        accent: 'blue',
        includes: ["ঢাবি, জাবি, রাবি সহ 'ক' ইউনিটের প্রশ্ন", 'পদার্থ, রসায়ন, গণিত, জীববিজ্ঞান', 'অধ্যায়ভিত্তিক প্র্যাকটিস ও মডেল টেস্ট', 'আলাদা অ্যানালাইসিস ও র‍্যাঙ্ক'],
    },
    {
        id: 'kha',
        title: "Varsity 'Kha' Arts",
        name: "ভার্সিটি 'খ' ইউনিট",
        url: 'https://kha.admcq.com',
        stats: '10k+ MCQ',
        accent: 'amber',
        includes: ["'খ' ইউনিটের বিগত বছরের প্রশ্ন", 'বাংলা, ইংরেজি, সাধারণ জ্ঞান', 'বিষয়ভিত্তিক প্র্যাকটিস ও মডেল টেস্ট', 'আলাদা অ্যানালাইসিস ও র‍্যাঙ্ক'],
    },
    {
        id: 'eng',
        title: 'Engineering',
        name: 'ইঞ্জিনিয়ারিং',
        url: 'https://eng.admcq.com',
        stats: '6.5k+ MCQ',
        accent: 'cyan',
        includes: ['বুয়েট, চুয়েট, কুয়েট, রুয়েট প্রশ্ন', 'পদার্থ, রসায়ন, গণিত', 'অধ্যায়ভিত্তিক প্র্যাকটিস ও মডেল টেস্ট', 'আলাদা অ্যানালাইসিস ও র‍্যাঙ্ক'],
    },
] as const;

export type CourseId = (typeof COURSES)[number]['id'];
export const isCourse = (id: unknown): id is CourseId => COURSES.some((c) => c.id === id);

// Tailwind এর class গুলো পুরো লেখা থাকতে হয়, তাই রং অনুযায়ী আলাদা করে রাখা
export const ACCENT = {
    emerald: { icon: 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10', ring: 'hover:border-emerald-500/60', dot: 'text-emerald-500' },
    blue: { icon: 'text-blue-600 dark:text-blue-400 bg-blue-500/10', ring: 'hover:border-blue-500/60', dot: 'text-blue-500' },
    amber: { icon: 'text-amber-600 dark:text-amber-400 bg-amber-500/10', ring: 'hover:border-amber-500/60', dot: 'text-amber-500' },
    cyan: { icon: 'text-cyan-600 dark:text-cyan-400 bg-cyan-500/10', ring: 'hover:border-cyan-500/60', dot: 'text-cyan-500' },
} as const;
