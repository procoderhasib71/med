import { Atom, BookOpen, Cpu, Stethoscope } from 'lucide-react';
import type { CourseId } from '@/lib/courses';

const ICONS = { med: Stethoscope, ka: Atom, kha: BookOpen, eng: Cpu } as const;

export default function CourseIcon({ id, className }: { id: CourseId; className?: string }) {
    const Icon = ICONS[id];
    return <Icon className={className} />;
}
