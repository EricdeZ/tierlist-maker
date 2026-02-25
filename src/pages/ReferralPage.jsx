import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { referralService } from '../services/database'
import PageTitle from '../components/PageTitle'
import Navbar from '../components/layout/Navbar'
import { Copy, Check, Users, Flame, Link as LinkIcon, UserCheck } from 'lucide-react'
import passionCoin from '../assets/passion/passion.png'

export default function ReferralPage() {
    const { user, login } = useAuth()
    const [stats, setStats] = useState(null)
    const [loading, setLoading] = useState(true)
    const [copiedField, setCopiedField] = useState(null)
    const [websiteCode, setWebsiteCode] = useState('')
    const [forgeCode, setForgeCode] = useState('')
    const [claimError, setClaimError] = useState({})
    const [claiming, setClaiming] = useState({})

    const claimCode = async (type) => {
        const code = type === 'website' ? websiteCode.trim() : forgeCode.trim()
        if (!code) return
        setClaiming(prev => ({ ...prev, [type]: true }))
        setClaimError(prev => ({ ...prev, [type]: null }))
        try {
            const result = await referralService.claimReferral(code, type)
            setStats(prev => ({
                ...prev,
                referredBy: {
                    ...prev.referredBy,
                    [type]: { username: result.referrerUsername, at: new Date().toISOString() },
                },
            }))
        } catch (err) {
            setClaimError(prev => ({ ...prev, [type]: err.message || 'Failed to claim' }))
        } finally {
            setClaiming(prev => ({ ...prev, [type]: false }))
        }
    }

    const loadStats = useCallback(async () => {
        if (!user) { setLoading(false); return }
        try {
            const data = await referralService.getMyStats()
            setStats(data)
        } catch (err) {
            console.error('Failed to load referral stats:', err)
        } finally {
            setLoading(false)
        }
    }, [user])

    useEffect(() => { loadStats() }, [loadStats])

    const copyToClipboard = (text, field) => {
        navigator.clipboard.writeText(text)
        setCopiedField(field)
        setTimeout(() => setCopiedField(null), 2000)
    }

    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    const websiteLink = stats ? `${origin}/?ref=${stats.referralCode}` : ''
    const forgeLink = stats ? `${origin}/forge?forge_ref=${stats.referralCode}` : ''

    return (
        <>
            <PageTitle title="Refer a Friend" />
            <Navbar />
            <div className="max-w-2xl mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold mb-2">Refer a Friend</h1>
                <p className="text-(--color-text-secondary)/60 mb-8">
                    Share your referral links and earn rewards when friends join.
                </p>

                {!user ? (
                    <div className="bg-(--color-secondary) border border-white/[0.06] rounded-lg p-8 text-center">
                        <Users size={40} className="mx-auto mb-4 text-(--color-text-secondary)/50" />
                        <p className="text-lg mb-4">Log in to get your referral links</p>
                        <button onClick={login} className="px-6 py-2 bg-[#5865F2] hover:bg-[#4752C4] text-white rounded-lg font-semibold transition-colors">
                            Login with Discord
                        </button>
                    </div>
                ) : loading ? (
                    <div className="text-center py-12 text-(--color-text-secondary)/50">Loading...</div>
                ) : stats ? (
                    <div className="space-y-6">
                        {/* Referral Code */}
                        <div className="bg-(--color-secondary) border border-white/[0.06] rounded-lg p-5">
                            <div className="text-xs font-semibold uppercase tracking-wider text-(--color-text-secondary)/50 mb-2">Your Referral Code</div>
                            <div className="flex items-center gap-3">
                                <code className="text-2xl font-bold tracking-widest flex-1">{stats.referralCode}</code>
                                <button
                                    onClick={() => copyToClipboard(stats.referralCode, 'code')}
                                    className="p-2 hover:bg-white/5 rounded transition-colors"
                                    title="Copy code"
                                >
                                    {copiedField === 'code' ? <Check size={18} className="text-green-400" /> : <Copy size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* Shareable Links */}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="bg-(--color-secondary) border border-white/[0.06] rounded-lg p-5">
                                <div className="flex items-center gap-2 mb-3">
                                    <Users size={16} className="text-blue-400" />
                                    <span className="text-sm font-semibold uppercase tracking-wider">Website Referral</span>
                                </div>
                                <p className="text-xs text-(--color-text-secondary)/50 mb-3">
                                    New users get <strong>50 Passion</strong>, you get <strong>25 Passion</strong>
                                </p>
                                <button
                                    onClick={() => copyToClipboard(websiteLink, 'website')}
                                    className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/25 rounded text-sm transition-colors"
                                >
                                    {copiedField === 'website' ? (
                                        <><Check size={14} className="text-green-400" /> Copied!</>
                                    ) : (
                                        <><LinkIcon size={14} /> Copy Website Link</>
                                    )}
                                </button>
                            </div>

                            <div className="bg-(--color-secondary) border border-white/[0.06] rounded-lg p-5">
                                <div className="flex items-center gap-2 mb-3">
                                    <Flame size={16} className="text-orange-400" />
                                    <span className="text-sm font-semibold uppercase tracking-wider">Forge Referral</span>
                                </div>
                                <p className="text-xs text-(--color-text-secondary)/50 mb-3">
                                    Both you and your friend get <strong>1 free Spark</strong>
                                </p>
                                <button
                                    onClick={() => copyToClipboard(forgeLink, 'forge')}
                                    className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/25 rounded text-sm transition-colors"
                                >
                                    {copiedField === 'forge' ? (
                                        <><Check size={14} className="text-green-400" /> Copied!</>
                                    ) : (
                                        <><LinkIcon size={14} /> Copy Forge Link</>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="bg-(--color-secondary) border border-white/[0.06] rounded-lg p-5">
                            <div className="text-xs font-semibold uppercase tracking-wider text-(--color-text-secondary)/50 mb-4">Your Stats</div>
                            <div className="grid grid-cols-3 gap-4 text-center">
                                <div>
                                    <div className="text-2xl font-bold">{stats.websiteReferrals}</div>
                                    <div className="text-xs text-(--color-text-secondary)/50">Website Referrals</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-bold">{stats.forgeReferrals}</div>
                                    <div className="text-xs text-(--color-text-secondary)/50">Forge Referrals</div>
                                </div>
                                <div>
                                    <div className="text-2xl font-bold flex items-center justify-center gap-1">
                                        <img src={passionCoin} alt="" className="w-5 h-5" />
                                        {stats.totalPassionEarned}
                                    </div>
                                    <div className="text-xs text-(--color-text-secondary)/50">Passion Earned</div>
                                </div>
                            </div>
                        </div>

                        {/* Referred By / Enter Code */}
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="bg-(--color-secondary) border border-white/[0.06] rounded-lg p-5">
                                <div className="flex items-center gap-2 mb-3">
                                    <Users size={16} className="text-blue-400" />
                                    <span className="text-xs font-semibold uppercase tracking-wider text-(--color-text-secondary)/50">Website Referrer</span>
                                </div>
                                {stats.referredBy?.website ? (
                                    <div className="flex items-center gap-2">
                                        <UserCheck size={16} className="text-green-400" />
                                        <span className="font-semibold">{stats.referredBy.website.username}</span>
                                    </div>
                                ) : (
                                    <div>
                                        <div className="mb-3 p-3 rounded bg-blue-500/[0.06] border border-blue-500/15">
                                            <p className="text-sm font-semibold text-blue-400 mb-0.5">Got a friend's code?</p>
                                            <p className="text-xs text-(--color-text-secondary)/50">
                                                Enter it below to earn <strong className="text-(--color-text)">50 Passion</strong> as a welcome bonus!
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={websiteCode}
                                                onChange={e => setWebsiteCode(e.target.value)}
                                                placeholder="Enter code"
                                                maxLength={8}
                                                className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded text-sm placeholder:text-(--color-text-secondary)/30 focus:outline-none focus:border-blue-500/50"
                                            />
                                            <button
                                                onClick={() => claimCode('website')}
                                                disabled={claiming.website || !websiteCode.trim()}
                                                className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded text-sm text-blue-300 font-semibold disabled:opacity-40 transition-colors"
                                            >
                                                {claiming.website ? '...' : 'Claim'}
                                            </button>
                                        </div>
                                        {claimError.website && (
                                            <p className="text-xs text-red-400 mt-1.5">{claimError.website}</p>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="bg-(--color-secondary) border border-white/[0.06] rounded-lg p-5">
                                <div className="flex items-center gap-2 mb-3">
                                    <Flame size={16} className="text-orange-400" />
                                    <span className="text-xs font-semibold uppercase tracking-wider text-(--color-text-secondary)/50">Forge Referrer</span>
                                </div>
                                {stats.referredBy?.forge ? (
                                    <div className="flex items-center gap-2">
                                        <UserCheck size={16} className="text-green-400" />
                                        <span className="font-semibold">{stats.referredBy.forge.username}</span>
                                    </div>
                                ) : (
                                    <div>
                                        <div className="mb-3 p-3 rounded bg-orange-500/[0.06] border border-orange-500/15">
                                            <p className="text-sm font-semibold text-orange-400 mb-0.5">Unlock a free Spark!</p>
                                            <p className="text-xs text-(--color-text-secondary)/50">
                                                Enter a friend's code and you'll <strong className="text-(--color-text)">both</strong> get a free Spark to invest in the Forge.
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <input
                                                type="text"
                                                value={forgeCode}
                                                onChange={e => setForgeCode(e.target.value)}
                                                placeholder="Enter code"
                                                maxLength={8}
                                                className="flex-1 px-3 py-1.5 bg-white/5 border border-white/10 rounded text-sm placeholder:text-(--color-text-secondary)/30 focus:outline-none focus:border-orange-500/50"
                                            />
                                            <button
                                                onClick={() => claimCode('forge')}
                                                disabled={claiming.forge || !forgeCode.trim()}
                                                className="px-3 py-1.5 bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/30 rounded text-sm text-orange-300 font-semibold disabled:opacity-40 transition-colors"
                                            >
                                                {claiming.forge ? '...' : 'Claim'}
                                            </button>
                                        </div>
                                        {claimError.forge && (
                                            <p className="text-xs text-red-400 mt-1.5">{claimError.forge}</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Recent Referrals */}
                        {stats.recentReferrals?.length > 0 && (
                            <div className="bg-(--color-secondary) border border-white/[0.06] rounded-lg p-5">
                                <div className="text-xs font-semibold uppercase tracking-wider text-(--color-text-secondary)/50 mb-3">Recent Referrals</div>
                                <div className="space-y-2">
                                    {stats.recentReferrals.map((r, i) => (
                                        <div key={i} className="flex items-center justify-between text-sm py-1.5 border-b border-white/[0.06] last:border-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold">{r.username}</span>
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase ${
                                                    r.type === 'website'
                                                        ? 'bg-blue-500/15 text-blue-400'
                                                        : 'bg-orange-500/15 text-orange-400'
                                                }`}>
                                                    {r.type}
                                                </span>
                                            </div>
                                            <span className="text-(--color-text-secondary)/50 text-xs">
                                                {new Date(r.createdAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* How it Works */}
                        <div className="bg-(--color-secondary) border border-white/[0.06] rounded-lg p-5">
                            <div className="text-xs font-semibold uppercase tracking-wider text-(--color-text-secondary)/50 mb-3">How It Works</div>
                            <div className="space-y-3 text-sm text-(--color-text-secondary)/50">
                                <div className="flex gap-3">
                                    <Users size={16} className="text-blue-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <strong className="text-(--color-text)">Website Referral</strong> — Share your link. When someone signs up through it,
                                        they get 50 Passion as a welcome bonus and you earn 25 Passion.
                                    </div>
                                </div>
                                <div className="flex gap-3">
                                    <Flame size={16} className="text-orange-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <strong className="text-(--color-text)">Forge Referral</strong> — Share your Forge link. When someone visits the Forge for the first time
                                        through it, you both get 1 free Spark to invest in any player.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                ) : null}
            </div>
        </>
    )
}
