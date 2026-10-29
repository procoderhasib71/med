'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    Trophy,
    ArrowLeft,
    RotateCcw,
    Loader2,
    Crown,
    Medal
} from 'lucide-react';
import { getLeaderboard } from '@/lib/siteApi';
import { onAuthStateChanged } from '@/lib/session';
import { session as auth } from '@/lib/session';

interface LeaderboardUser {
    id: string;
    name: string;
    score: number;
    rank?: number;
}

export default function LeaderboardPage() {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<LeaderboardUser[]>([]);
    const [currentUser, setCurrentUser] = useState<any>(null);
    const [myRankData, setMyRankData] = useState<LeaderboardUser | null>(null);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            setCurrentUser(user);
        });
        return () => unsubscribe();
    }, []);

    const fetchLeaderboard = useCallback(async () => {
        setLoading(true);
        try {
            const { rows, me } = await getLeaderboard();
            const rawList: { id: string; name: string; score: number }[] = [...rows];
            const uid = auth.currentUser?.uid;

            rawList.sort((a, b) => b.score - a.score);

            const list: LeaderboardUser[] = [];
            let foundMe = false;

            rawList.slice(0, 50).forEach((item, idx) => {
                const rankItem: LeaderboardUser = {
                    ...item,
                    score: Number(item.score.toFixed(2)),
                    rank: idx + 1,
                };
                list.push(rankItem);

                if (uid && item.id === uid) {
                    setMyRankData(rankItem);
                    foundMe = true;
                }
            });

            if (uid && !foundMe && me) {
                setMyRankData({ ...me, score: Number(me.score.toFixed(2)) });
            } else if (uid && !foundMe) {
                const myInRaw = rawList.find(u => u.id === uid);
                if (myInRaw) {
                    const myActualRank = rawList.findIndex(u => u.id === uid) + 1;
                    setMyRankData({
                        ...myInRaw,
                        score: Number(myInRaw.score.toFixed(2)),
                        rank: myActualRank > 50 ? undefined : myActualRank,
                    });
                }
            }

            setUsers(list);
        } catch (error) {
            console.error('Leaderboard error:', error);
            setUsers([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchLeaderboard();
    }, [fetchLeaderboard, currentUser]);   // লগইন হলে আবার, যাতে নিজের র‍্যাংক আসে

    const renderRankBadge = (rank: number) => {
        if (rank === 1) {
            return (
                <div className="relative shrink-0 flex items-center justify-center">
                    <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 text-white flex flex-col items-center justify-center shadow-md shadow-amber-500/20 ring-2 ring-amber-300/80">
                        <Crown size={13} className="text-amber-100 fill-amber-100 -mb-0.5" />
                        <span className="text-[12px] font-black leading-none">#1</span>
                    </div>
                </div>
            );
        }
        if (rank === 2) {
            return (
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-200 via-slate-300 to-slate-400 text-slate-800 flex flex-col items-center justify-center shadow-xs ring-2 ring-slate-200 shrink-0">
                    <Medal size={13} className="text-slate-700 -mb-0.5" />
                    <span className="text-[12px] font-black leading-none">#2</span>
                </div>
            );
        }
        if (rank === 3) {
            return (
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-600 via-orange-500 to-amber-700 text-white flex flex-col items-center justify-center shadow-xs ring-2 ring-orange-300/70 shrink-0">
                    <Trophy size={13} className="text-orange-100 -mb-0.5" />
                    <span className="text-[12px] font-black leading-none">#3</span>
                </div>
            );
        }
        return (
            <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border border-slate-200/90 dark:border-slate-700 flex items-center justify-center font-black text-sm shrink-0">
                {rank}
            </div>
        );
    };

    const getRowStyle = (rank: number, isMe: boolean) => {
        if (isMe) {
            return 'bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-500 shadow-xs ring-1 ring-emerald-500/30';
        }
        if (rank === 1) {
            return 'bg-white dark:bg-[#111927] border-amber-300/80 dark:border-amber-600/40 shadow-xs';
        }
        if (rank === 2) {
            return 'bg-white dark:bg-[#111927] border-slate-300/80 dark:border-slate-700 shadow-2xs';
        }
        if (rank === 3) {
            return 'bg-white dark:bg-[#111927] border-orange-200 dark:border-orange-900/40 shadow-2xs';
        }
        return 'bg-white dark:bg-[#111927] border-slate-200/80 dark:border-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700';
    };

    return (
        <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#070B14] text-slate-900 dark:text-slate-100 font-sans pb-28">
            {/* Header */}
            <header className="sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/85 dark:bg-[#070B14]/85 backdrop-blur-md">
                <div className="mx-auto max-w-2xl px-4 h-14 flex items-center justify-between">
                    <button
                        onClick={() => router.back()}
                        className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Back"
                    >
                        <ArrowLeft size={16} />
                    </button>

                    <div className="flex items-center gap-2">
                        <Trophy size={17} className="text-amber-500" />
                        <h1 className="text-sm sm:text-base font-bold tracking-tight text-slate-900 dark:text-white">
                            Leaderboard
                        </h1>
                    </div>

                    <button
                        onClick={() => fetchLeaderboard()}
                        className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors cursor-pointer"
                        title="Refresh"
                    >
                        <RotateCcw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </header>

            <main className="mx-auto max-w-2xl px-3 sm:px-4 pt-5">
                {/* Loading State */}
                {loading ? (
                    <div className="py-24 flex flex-col items-center justify-center text-slate-400">
                        <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-2.5" />
                        <span className="text-xs font-semibold text-slate-500 tracking-wider uppercase">
                            Loading rankings...
                        </span>
                    </div>
                ) : users.length === 0 ? (
                    <div className="text-center py-16 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-xs">
                        <Trophy size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-2" />
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">
                            No rankings yet
                        </h3>
                        <p className="text-xs text-slate-400">
                            Participate in model tests to appear on the leaderboard.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {users.map((item) => {
                            const isMe = currentUser?.uid && item.id === currentUser.uid;
                            const avatarChar = item.name.trim().charAt(0).toUpperCase() || 'U';

                            return (
                                <div
                                    key={item.id}
                                    className={`flex items-center gap-3.5 p-3 sm:px-4 rounded-2xl border transition-all ${getRowStyle(item.rank!, isMe)}`}
                                >
                                    {/* Rank Badge */}
                                    {renderRankBadge(item.rank!)}

                                    {/* User Avatar Initial */}
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${item.rank === 1
                                            ? 'bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-200'
                                            : item.rank === 2
                                                ? 'bg-slate-100 text-slate-800 border border-slate-300 dark:bg-slate-800 dark:text-slate-200'
                                                : item.rank === 3
                                                    ? 'bg-orange-100 text-orange-800 border border-orange-200 dark:bg-orange-950/60 dark:text-orange-200'
                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                                        }`}>
                                        {avatarChar}
                                    </div>

                                    {/* Name and Tag */}
                                    <div className="flex-1 min-w-0 flex items-center gap-2">
                                        <span className={`text-sm font-bold truncate ${isMe
                                                ? 'text-emerald-700 dark:text-emerald-400'
                                                : 'text-slate-900 dark:text-white'
                                            }`}>
                                            {item.name}
                                        </span>
                                        {isMe && (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-600 text-white shrink-0">
                                                YOU
                                            </span>
                                        )}
                                    </div>

                                    {/* Score Display */}
                                    <div className={`flex items-baseline gap-1 px-3.5 py-1.5 rounded-xl border shrink-0 ${item.rank === 1
                                            ? 'bg-amber-500/10 border-amber-300/80 text-amber-700 dark:text-amber-300'
                                            : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200/80 dark:border-slate-700 text-emerald-600 dark:text-emerald-400'
                                        }`}>
                                        <span className="text-sm font-black">
                                            {item.score}
                                        </span>
                                        <span className="text-[11px] font-semibold opacity-70">
                                            pts
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </main>

            {/* Sticky Current User Rank Bar */}
            {myRankData && (
                <div className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 dark:bg-[#070B14]/95 backdrop-blur-md border-t border-slate-800 p-3 sm:py-3.5 shadow-2xl">
                    <div className="mx-auto max-w-2xl px-4 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs sm:text-sm shadow-xs shrink-0">
                                {myRankData.rank ? `#${myRankData.rank}` : '50+'}
                            </div>
                            <div className="min-w-0">
                                <span className="text-xs sm:text-sm font-bold text-white block truncate">
                                    Your Rank
                                </span>
                                <span className="text-[10px] sm:text-[11px] text-slate-400 block truncate">
                                    {myRankData.rank ? `Ranked #${myRankData.rank} overall` : 'Score more points to reach top 50'}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-baseline gap-1 px-3.5 py-1.5 rounded-xl bg-slate-800/90 text-right shrink-0 border border-slate-700/60">
                            <span className="text-sm sm:text-base font-black text-emerald-400">
                                {myRankData.score}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400">
                                pts
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}