import { Flame, Snowflake, ChevronDown, ChevronUp, X } from 'lucide-react'
import TeamLogo from '../../components/TeamLogo'
import passionCoin from '../../assets/passion/passion.png'
import sparkIcon from '../../assets/spark.png'
import ForgeChargeButton from './ForgeChargeButton'

export default function ForgeTradeModal({
    player, mode, amount, setAmount, balance,
    trading, result, error, freeSparksRemaining,
    referralSparksAvailable = 0,
    onExecute, onFreeFuel, onReferralFuel, onClose,
}) {
    const isFuel = mode === 'fuel'
    const hasFreeSparks = isFuel && freeSparksRemaining > 0
    const hasReferralSparks = isFuel && !hasFreeSparks && referralSparksAvailable > 0
    const estimatedCost = isFuel
        ? Math.round(player.currentPrice * amount * (1 + 0.005 * amount))
        : null
    const estimatedProceeds = !isFuel && player.currentPrice
        ? Math.round(player.currentPrice * amount * 0.9)
        : null
    const coolableSparks = player.holding?.coolableSparks != null ? player.holding.coolableSparks : (player.holding?.sparks || 0)
    const maxSparks = !isFuel && player.holding ? coolableSparks : 10
    const cantAfford = isFuel && estimatedCost != null && balance != null && balance < estimatedCost
    const holdingTutorial = player.holding?.tutorialSparks || 0
    const holdingReferral = player.holding?.referralSparks || 0

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
            onClick={e => { if (e.target === e.currentTarget) onClose() }}
        >
            <div
                className="border border-[var(--forge-border)] p-6 w-full max-w-sm mx-4"
                style={{
                    background: 'var(--color-primary)',
                    clipPath: 'polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% 100%, 20px 100%, 0 calc(100% - 20px))',
                }}
            >
                {/* Top accent */}
                <div
                    className="h-[3px] -mx-6 -mt-6 mb-4"
                    style={{
                        background: isFuel
                            ? 'linear-gradient(90deg, var(--forge-ember), var(--forge-flame), var(--forge-flame-bright))'
                            : 'linear-gradient(90deg, var(--forge-cool-dim), var(--forge-cool))',
                    }}
                />

                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h3 className="forge-head text-2xl font-bold tracking-wider flex items-center gap-2">
                        {isFuel
                            ? <Flame className="text-[var(--forge-flame)]" size={20} />
                            : <Snowflake className="text-[var(--forge-cool)]" size={20} />
                        }
                        {!player.isFreeAgent && (
                            <TeamLogo slug={player.teamSlug} name={player.teamName} size={20} color={player.teamColor} />
                        )}
                        {isFuel ? 'Fuel' : 'Cool'} {player.playerName}
                    </h3>
                    <button onClick={onClose} className="p-1 hover:bg-white/5 rounded transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Result display */}
                {result && (
                    <div className={`mb-4 p-3 border ${
                        isFuel
                            ? 'bg-[var(--forge-flame)]/8 border-[var(--forge-flame)]/25'
                            : 'bg-[var(--forge-cool)]/8 border-[var(--forge-cool)]/25'
                    }`}>
                        <div className="forge-head text-base font-bold tracking-wider mb-1">
                            {result.isFreeSpark ? 'Starter Spark Used!' : result.isReferralSpark ? 'Referral Spark Used!' : (isFuel ? 'Fueled!' : 'Cooled!')}
                        </div>
                        {isFuel ? (
                            (result.isFreeSpark || result.isReferralSpark) ? (
                                <div className="text-sm text-[var(--forge-text-mid)]">
                                    {result.isReferralSpark ? 'Referral Spark applied!' : 'Free Starter Spark applied!'}
                                    {' '}New value: <strong className="forge-num text-[var(--forge-flame-bright)]">{Math.round(result.newPrice).toLocaleString()}</strong>
                                    {result.isFreeSpark && result.freeSparksRemaining > 0 && (
                                        <span className="text-[var(--forge-gold)]">
                                            {' '}&mdash; {result.freeSparksRemaining} Starter Spark{result.freeSparksRemaining !== 1 ? 's' : ''} left
                                        </span>
                                    )}
                                </div>
                            ) : (
                                <div className="text-sm text-[var(--forge-text-mid)]">
                                    Spent <strong className="forge-num text-[var(--forge-flame-bright)]">{result.totalCost?.toLocaleString()}</strong> Passion.
                                    New value: <strong className="forge-num text-[var(--forge-flame-bright)]">{Math.round(result.newPrice).toLocaleString()}</strong>
                                </div>
                            )
                        ) : (
                            <div className="text-sm text-[var(--forge-text-mid)]">
                                Received <strong className="forge-num text-[var(--forge-gain)]">{result.netProceeds?.toLocaleString()}</strong> Passion
                                (tax: <span className="forge-num">{result.coolingTax?.toLocaleString()}</span>).
                                {result.profit != null && (
                                    <span className={result.profit >= 0 ? ' text-[var(--forge-gain)]' : ' text-[var(--forge-loss)]'}>
                                        {' '}P&L: <span className="forge-num">{result.profit >= 0 ? '+' : ''}{result.profit.toLocaleString()}</span>
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="mb-4 p-3 bg-[var(--forge-loss)]/8 border border-[var(--forge-loss)]/25 text-base text-[var(--forge-loss)]">
                        {error}
                    </div>
                )}

                {/* Free Starter Spark mode */}
                {!result && hasFreeSparks && (
                    <>
                        <div className="mb-4 p-3 bg-[var(--forge-flame)]/8 border border-[var(--forge-flame)]/25">
                            <div className="flex items-center gap-2 mb-1">
                                <img src={sparkIcon} alt="" className="w-6 h-6 object-contain" style={{ filter: 'drop-shadow(0 0 6px rgba(232,101,32,0.5))' }} />
                                <span className="forge-head text-sm font-bold tracking-wider text-[var(--forge-flame-bright)]">
                                    {freeSparksRemaining} STARTER SPARK{freeSparksRemaining !== 1 ? 'S' : ''} LEFT
                                </span>
                            </div>
                            <div className="forge-body text-sm text-[var(--forge-text-mid)] leading-relaxed">
                                Fuel 1 free Spark on this player. Starter Sparks can't be cooled, but you keep any profit at season end.
                            </div>
                        </div>

                        <ForgeChargeButton
                            mode="fuel"
                            label={trading ? 'Fueling...' : 'Use Starter Spark (FREE)'}
                            onFire={() => onFreeFuel(player.sparkId)}
                            disabled={trading}
                        />

                        <div className="forge-head text-center text-[0.7rem] text-[var(--forge-text-dim)] tracking-wider mt-3 mb-3">
                            &mdash; OR FUEL WITH PASSION &mdash;
                        </div>
                    </>
                )}

                {/* Free Referral Spark mode */}
                {!result && hasReferralSparks && (
                    <>
                        <div className="mb-4 p-3 bg-[var(--forge-flame)]/8 border border-[var(--forge-flame)]/25">
                            <div className="flex items-center gap-2 mb-1">
                                <img src={sparkIcon} alt="" className="w-6 h-6 object-contain" style={{ filter: 'drop-shadow(0 0 6px rgba(232,101,32,0.5))' }} />
                                <span className="forge-head text-sm font-bold tracking-wider text-[var(--forge-flame-bright)]">
                                    {referralSparksAvailable} REFERRAL SPARK{referralSparksAvailable !== 1 ? 'S' : ''} AVAILABLE
                                </span>
                            </div>
                            <div className="forge-body text-sm text-[var(--forge-text-mid)] leading-relaxed">
                                Use your free Referral Spark on any player. Like Starter Sparks, these can't be cooled but you keep any profit at season end.
                            </div>
                        </div>

                        <ForgeChargeButton
                            mode="fuel"
                            label={trading ? 'Fueling...' : 'Use Referral Spark (FREE)'}
                            onFire={() => onReferralFuel(player.sparkId)}
                            disabled={trading}
                        />

                        <div className="forge-head text-center text-[0.7rem] text-[var(--forge-text-dim)] tracking-wider mt-3 mb-3">
                            &mdash; OR FUEL WITH PASSION &mdash;
                        </div>
                    </>
                )}

                {/* Amount selector (normal Passion-based trading) */}
                {!result && !hasFreeSparks && !hasReferralSparks && (
                    <>
                        {/* Current holdings summary */}
                        {player.holding && player.holding.sparks > 0 && (
                            <div className="mb-3 flex items-center gap-2 text-sm text-[var(--forge-text-mid)]">
                                <img src={sparkIcon} alt="" className="w-5 h-5 object-contain" />
                                <span className="forge-num">{player.holding.sparks} held</span>
                                {holdingTutorial > 0 && (
                                    <span className="forge-head text-[0.65rem] tracking-wider text-[var(--forge-flame)] bg-[var(--forge-flame)]/8 border border-[var(--forge-flame)]/15 px-1">
                                        {holdingTutorial} free
                                    </span>
                                )}
                                {holdingReferral > 0 && (
                                    <span className="forge-head text-[0.65rem] tracking-wider text-[var(--forge-gold)] bg-[var(--forge-gold)]/8 border border-[var(--forge-gold)]/15 px-1">
                                        {holdingReferral} referral
                                    </span>
                                )}
                            </div>
                        )}

                        <div className="mb-4">
                            <label className="forge-head text-[0.75rem] font-semibold tracking-wider text-[var(--forge-text-dim)] mb-2 block">
                                Sparks to {isFuel ? 'fuel' : 'cool'}
                            </label>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setAmount(Math.max(1, amount - 1))}
                                    className="p-2 bg-[var(--forge-surface)] hover:bg-[var(--forge-edge)] disabled:opacity-30 transition-colors forge-clip-btn"
                                    disabled={amount <= 1}
                                >
                                    <ChevronDown size={16} />
                                </button>
                                <div className="flex-1 text-center flex items-center justify-center gap-2">
                                    <span className="forge-num text-4xl">{amount}</span>
                                    <img src={sparkIcon} alt="" className="w-9 h-9 object-contain" />
                                    <span className="forge-head text-sm text-[var(--forge-text-dim)]">
                                        Spark{amount !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                <button
                                    onClick={() => setAmount(Math.min(maxSparks, amount + 1))}
                                    className="p-2 bg-[var(--forge-surface)] hover:bg-[var(--forge-edge)] disabled:opacity-30 transition-colors forge-clip-btn"
                                    disabled={amount >= maxSparks}
                                >
                                    <ChevronUp size={16} />
                                </button>
                            </div>
                        </div>

                        {/* Holdings breakdown (cool mode) */}
                        {!isFuel && player.holding && (holdingTutorial > 0 || holdingReferral > 0) && (
                            <div className="mb-4 p-3 bg-[var(--forge-surface)]">
                                <div className="forge-head text-xs font-semibold tracking-wider text-[var(--forge-text-dim)] mb-2">Your Holdings</div>
                                <div className="flex items-center justify-between text-sm mb-1">
                                    <span className="text-[var(--forge-text-mid)]">Total Sparks</span>
                                    <span className="forge-num">{player.holding.sparks}</span>
                                </div>
                                {holdingTutorial > 0 && (
                                    <div className="flex items-center justify-between text-sm mb-1">
                                        <span className="text-[var(--forge-text-dim)]">Starter (can't cool)</span>
                                        <span className="forge-num text-[var(--forge-text-dim)]">{holdingTutorial}</span>
                                    </div>
                                )}
                                {holdingReferral > 0 && (
                                    <div className="flex items-center justify-between text-sm mb-1">
                                        <span className="text-[var(--forge-text-dim)]">Referral (can't cool)</span>
                                        <span className="forge-num text-[var(--forge-text-dim)]">{holdingReferral}</span>
                                    </div>
                                )}
                                <div className="flex items-center justify-between text-sm pt-1 border-t border-[var(--forge-border)]">
                                    <span className="text-[var(--forge-cool)]">Coolable</span>
                                    <span className="forge-num text-[var(--forge-cool)]">{coolableSparks}</span>
                                </div>
                            </div>
                        )}

                        {/* Cost preview */}
                        <div className="mb-4 p-3 bg-[var(--forge-surface)]">
                            {isFuel ? (
                                <>
                                    <div className="flex items-center justify-between text-base">
                                        <span className="forge-head text-sm tracking-wider text-[var(--forge-text-dim)]">Estimated cost</span>
                                        <span className="flex items-center gap-1 forge-num text-[var(--forge-flame-bright)]">
                                            <img src={passionCoin} alt="" className="w-3.5 h-3.5" />
                                            ~{estimatedCost?.toLocaleString()}
                                        </span>
                                    </div>
                                    {balance != null && (
                                        <div className={`flex items-center justify-between text-sm mt-1 ${cantAfford ? 'text-[var(--forge-loss)]' : 'text-[var(--forge-text-dim)] opacity-60'}`}>
                                            <span className="forge-head text-xs tracking-wider">Your balance</span>
                                            <span className="flex items-center gap-1 forge-num">
                                                <img src={passionCoin} alt="" className="w-3 h-3" />
                                                {Math.floor(balance).toLocaleString()}
                                            </span>
                                        </div>
                                    )}
                                    {cantAfford && (
                                        <div className="text-[var(--forge-loss)] forge-head text-xs tracking-wider mt-2">
                                            Not enough Passion
                                        </div>
                                    )}
                                </>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between text-base mb-1">
                                        <span className="forge-head text-sm tracking-wider text-[var(--forge-text-dim)]">Estimated proceeds</span>
                                        <span className="flex items-center gap-1 forge-num text-[var(--forge-gain)]">
                                            <img src={passionCoin} alt="" className="w-3.5 h-3.5" />
                                            ~{estimatedProceeds?.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="text-sm text-[var(--forge-text-dim)] opacity-60">
                                        Includes 10% cooling tax
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Charge-to-confirm button */}
                        <ForgeChargeButton
                            mode={mode}
                            label={trading
                                ? (isFuel ? 'Fueling...' : 'Cooling...')
                                : cantAfford
                                    ? 'Not Enough Passion'
                                    : (isFuel ? `Fuel ${amount} Spark${amount !== 1 ? 's' : ''}` : `Cool ${amount} Spark${amount !== 1 ? 's' : ''}`)
                            }
                            onFire={onExecute}
                            disabled={trading || cantAfford}
                        />
                    </>
                )}

                {/* Passion fuel option shown below free spark section */}
                {!result && (hasFreeSparks || hasReferralSparks) && (
                    <>
                        <div className="mb-4">
                            <label className="forge-head text-[0.75rem] font-semibold tracking-wider text-[var(--forge-text-dim)] mb-2 block">
                                Sparks to fuel
                            </label>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setAmount(Math.max(1, amount - 1))}
                                    className="p-2 bg-[var(--forge-surface)] hover:bg-[var(--forge-edge)] disabled:opacity-30 transition-colors forge-clip-btn"
                                    disabled={amount <= 1}
                                >
                                    <ChevronDown size={16} />
                                </button>
                                <div className="flex-1 text-center flex items-center justify-center gap-2">
                                    <span className="forge-num text-4xl">{amount}</span>
                                    <img src={sparkIcon} alt="" className="w-9 h-9 object-contain" />
                                    <span className="forge-head text-sm text-[var(--forge-text-dim)]">
                                        Spark{amount !== 1 ? 's' : ''}
                                    </span>
                                </div>
                                <button
                                    onClick={() => setAmount(Math.min(10, amount + 1))}
                                    className="p-2 bg-[var(--forge-surface)] hover:bg-[var(--forge-edge)] disabled:opacity-30 transition-colors forge-clip-btn"
                                    disabled={amount >= 10}
                                >
                                    <ChevronUp size={16} />
                                </button>
                            </div>
                        </div>

                        <div className="mb-4 p-3 bg-[var(--forge-surface)]">
                            <div className="flex items-center justify-between text-base">
                                <span className="forge-head text-sm tracking-wider text-[var(--forge-text-dim)]">Estimated cost</span>
                                <span className="flex items-center gap-1 forge-num text-[var(--forge-flame-bright)]">
                                    <img src={passionCoin} alt="" className="w-3.5 h-3.5" />
                                    ~{estimatedCost?.toLocaleString()}
                                </span>
                            </div>
                            {balance != null && (
                                <div className={`flex items-center justify-between text-sm mt-1 ${cantAfford ? 'text-[var(--forge-loss)]' : 'text-[var(--forge-text-dim)] opacity-60'}`}>
                                    <span className="forge-head text-xs tracking-wider">Your balance</span>
                                    <span className="flex items-center gap-1 forge-num">
                                        <img src={passionCoin} alt="" className="w-3 h-3" />
                                        {Math.floor(balance).toLocaleString()}
                                    </span>
                                </div>
                            )}
                            {cantAfford && (
                                <div className="text-[var(--forge-loss)] forge-head text-xs tracking-wider mt-2">
                                    Not enough Passion
                                </div>
                            )}
                        </div>

                        <ForgeChargeButton
                            mode="fuel"
                            label={trading ? 'Fueling...' : cantAfford ? 'Not Enough Passion' : `Fuel ${amount} Spark${amount !== 1 ? 's' : ''}`}
                            onFire={onExecute}
                            disabled={trading || cantAfford}
                        />
                    </>
                )}

                {/* Done button after result */}
                {result && (
                    <button
                        onClick={onClose}
                        className="w-full py-3 forge-head text-base font-bold tracking-wider bg-[var(--forge-surface)] hover:bg-[var(--forge-edge)] transition-colors forge-clip-btn"
                    >
                        Close
                    </button>
                )}
            </div>
        </div>
    )
}
