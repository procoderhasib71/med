'use client';

import { ACCENT, COURSES } from '@/lib/courses';
import { useCourse } from '@/components/CourseProvider';
import CourseIcon from '@/components/CourseIcon';

// পেজের শিরোনামের পাশে ছোট করে চালু কোর্স, যাতে বোঝা যায় কোন কোর্সের হিসাব দেখছি
export default function CourseTag() {
    const { info } = useCourse();
    const c = info && COURSES.find((x) => x.id === info.current);
    if (!c) return null;
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10.5px] font-bold ${ACCENT[c.accent].icon}`}>
            <CourseIcon id={c.id} className="w-3 h-3" /> {c.name}
        </span>
    );
}
