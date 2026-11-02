import { turso } from '@/lib/turso';

// AdMCQ, Pomodoro আর Money এর এক প্রোফাইল (Turso site_users)। কোন অ্যাপে কী লাগে:
// Money: শুধু নাম। AdMCQ আর Pomodoro: নাম, ছেলে/মেয়ে, পড়ার ধরন, স্কুল/কলেজ। HSC ব্যাচ সবখানে ঐচ্ছিক।

export const STUDY_LEVELS = ['ssc', 'hsc', 'admission', 'mbbs', 'university', 'other'] as const;
export const GENDERS = ['male', 'female'] as const;

export type Account = {
    name: string; gender: string; studyLevel: string; institution: string; hscBatch: string;
    phone: string; email: string;
};

/** অ্যাপের দরকারি ঘরগুলো পূরণ আছে কিনা (Money কে "money", বাকিদের "full") */
export const isComplete = (a: Account, need: 'money' | 'full' = 'full') =>
    a.name.trim().length >= 2 && (need === 'money' || (Boolean(a.gender) && Boolean(a.studyLevel) && a.institution.trim().length >= 2));

export async function getAccount(uid: string): Promise<Account> {
    const r = await turso.execute({
        sql: 'SELECT name, gender, study_level, institution, hsc_batch, phone, email FROM site_users WHERE uid = ?', args: [uid] });
    const x = r.rows[0] || {};
    const s = (v: unknown) => String(v ?? '');
    return { name: s(x.name), gender: s(x.gender), studyLevel: s(x.study_level), institution: s(x.institution),
             hscBatch: s(x.hsc_batch), phone: s(x.phone), email: s(x.email) };
}

/** মাছরাঙা বটে এই অ্যাকাউন্ট যুক্ত থাকলে বটের master_id (একই uid তিন অ্যাপেই, তাই একবার যুক্ত করলেই হয়) */
export async function botMasterId(uid: string): Promise<string | null> {
    const r = await turso.execute({ sql: "SELECT master_id FROM hermes_site_links WHERE site_uid = ? AND site = 'medical' ORDER BY linked_at DESC LIMIT 1", args: [uid] });
    return r.rows[0] ? String(r.rows[0].master_id) : null;
}

/** শুধু পাঠানো ঘরগুলো বদলায়; ভুল মান হলে বাংলা আর ইংরেজি বার্তা ফেরত দেয় */
export async function updateAccount(uid: string, body: Record<string, unknown>): Promise<[string, string] | null> {
    const sets: string[] = [];
    const args: (string | null)[] = [];
    const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

    if ('name' in body) {
        const v = str(body.name);
        if (v.length < 2) return ['নাম লিখুন', 'Please enter your name'];
        sets.push('name = ?'); args.push(v.slice(0, 60));
    }
    if ('gender' in body) {
        const v = str(body.gender);
        if (!(GENDERS as readonly string[]).includes(v)) return ['ছেলে না মেয়ে বাছাই করুন', 'Please choose male or female'];
        sets.push('gender = ?'); args.push(v);
    }
    if ('studyLevel' in body) {
        const v = str(body.studyLevel);
        if (!(STUDY_LEVELS as readonly string[]).includes(v)) return ['পড়ার ধরন বাছাই করুন', 'Please choose what you study'];
        sets.push('study_level = ?'); args.push(v);
    }
    if ('institution' in body) {
        const v = str(body.institution);
        if (v.length < 2) return ['স্কুল/কলেজের নাম লিখুন', 'Please enter your school/college'];
        sets.push('institution = ?'); args.push(v.slice(0, 100));
    }
    if ('hscBatch' in body) {
        const v = str(body.hscBatch);
        if (v && !/^20[2-4]\d$/.test(v)) return ['HSC ব্যাচের সাল ঠিক নেই (যেমন 2026)', 'HSC batch year is not valid (e.g. 2026)'];
        sets.push('hsc_batch = ?'); args.push(v || null);
    }
    if (!sets.length) return null;
    await turso.execute({ sql: `UPDATE site_users SET ${sets.join(', ')}, updated_at = ? WHERE uid = ?`,
                          args: [...args, new Date().toISOString(), uid] });
    return null;
}
