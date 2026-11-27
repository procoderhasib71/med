// বিষয়, অধ্যায় আর টপিক কোন ক্রমে দেখাবে: সব পাতা এই এক ফাইল থেকে নেয়। ক্রম বদলাতে হলে শুধু SUBJECT_ORDER বদলান।
// শুধু দেখানোর ক্রম; ডেটাবেসের নাম বা প্রশ্ন বদলায় না।
const BIO1 = 'উদ্ভিদবিজ্ঞান', BIO2 = 'প্রাণিবিজ্ঞান';
const CHE = ['রসায়ন ১ম পত্র', 'রসায়ন ২য় পত্র'];
const PHY = ['পদার্থবিজ্ঞান ১ম পত্র', 'পদার্থবিজ্ঞান ২য় পত্র'];
const MATH = ['উচ্চতর গণিত ১ম পত্র', 'উচ্চতর গণিত ২য় পত্র'];
const BANGLA = ['বাংলা ১ম পত্র', 'বাংলা ২য় পত্র'];

export const SUBJECT_ORDER: Record<string, string[]> = {
    med: [BIO1, BIO2, ...CHE, ...PHY, 'English', 'সাধারণ জ্ঞান (বাংলাদেশ)', 'সাধারণ জ্ঞান (আন্তর্জাতিক)', 'মানবিক গুণাবলি'],
    ka: [...PHY, ...CHE, ...MATH, BIO1, BIO2],
    kha: [...BANGLA, 'English', 'বাংলাদেশ বিষয়াবলি', 'আন্তর্জাতিক বিষয়াবলি'],
    eng: [...PHY, ...CHE, ...MATH, 'English'],
};

/** বিষয় সাজানো। তালিকায় নেই এমন বিষয় শেষে, আগের ক্রমে। */
export function sortSubjects<T>(items: T[], platform: string | undefined, name: (x: T) => string = String): T[] {
    const order = SUBJECT_ORDER[platform || 'med'] || SUBJECT_ORDER.med;
    const rank = (x: T) => { const i = order.indexOf(name(x).trim()); return i < 0 ? order.length : i; };
    return [...items].sort((a, b) => rank(a) - rank(b));
}

const latin = (s: string) => s.replace(/[০-৯]/g, (d) => String('০১২৩৪৫৬৭৮৯'.indexOf(d)));
const byNumber = <T,>(items: T[], num: (x: T) => number) => [...items].sort((a, b) => num(a) - num(b));
// নম্বর না থাকলে (মডেল টেস্ট, Try Yourself, নম্বর ছাড়া টপিক) শেষে, আগের ক্রমে
const chapterNo = (s: string) => { const m = latin(s).match(/^\s*(?:অধ্যায়|অধ্যায়|chapter)[\s-]*(\d+(?:\.\d+)?)/i); return m ? Number(m[1]) : 1e6; };
const topicNo = (s: string) => { const m = latin(s).match(/^\s*type[\s-]*(\d+)/i); return m ? Number(m[1]) : 1e6; };

/** অধ্যায় ১, ২, ২.১, ৩ ... ১০ ক্রমে */
export function sortChapters<T>(items: T[], name: (x: T) => string = String): T[] {
    return byNumber(items, (x) => chapterNo(name(x).normalize('NFC')));
}
/** Type 1, 2 ... 10 (1, 10, 2 নয়) */
export const sortTopics = (items: string[]) => byNumber(items, topicNo);
