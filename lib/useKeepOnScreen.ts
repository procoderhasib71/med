import { useLayoutEffect, useRef } from 'react';

// খোলা তালিকা পর্দার ডান পাশে বেরিয়ে গেলে ততটুকু বাঁয়ে সরিয়ে আনে (ফোনে ডান কলামের ড্রপডাউন)
export function useKeepOnScreen(open: boolean) {
    const ref = useRef<HTMLDivElement>(null);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!open || !el) return;
        el.style.marginLeft = '0px';
        const { left, right } = el.getBoundingClientRect();
        const over = right - (document.documentElement.clientWidth - 8);
        if (over > 0) el.style.marginLeft = `-${Math.min(over, left - 8)}px`;
    }, [open]);
    return ref;
}
