import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Search, ArrowLeft, ChevronDown } from 'lucide-react'
import PageTitle from '../../components/PageTitle'
import Navbar from '../../components/layout/Navbar'
import { patchNotesService } from '../../services/database'
import patchBanner from '../../assets/patchnotebanner.webp'

const ITEM_CDN = 'https://cdn.smitesource.com/cdn-cgi/image/width=128,format=auto,quality=75'
// Full item image map scraped from smitesource.com/items (222 items)
const ITEM_IMAGES = {
    "bluestone pendant":"Items/AspectsInfluences/Icon_Starter_BluestonePendant","bumba's cudgel":"Items/AspectsInfluences/Icon_Starter_BumbasCudgel","conduit gem":"Items/AspectsInfluences/Icon_Starter_ConduitGem","death's toll":"Items/AspectsInfluences/Icon_Starter_DeathsToll","gilded arrow":"Items/AspectsInfluences/Icon_Starter_Arrow","leather cowl":"Items/AspectsInfluences/Icon_Starter_LeatherCowl","sands of time":"Items/AspectsInfluences/Icon_Starter_SandsOfTime","selflessness":"Items/AspectsInfluences/Icon_Starter_Selflessness","vampiric shroud":"Items/AspectsInfluences/Icon_VampiricCloak","war flag":"Items/AspectsInfluences/Icon_Starter_WarFlag","warrior's axe":"Items/AspectsInfluences/Icon_Aspect_Barbarian","archmage's gem":"Items/AspectsInfluences/Icon_Aspect_Arcanist","blood-soaked shroud":"Items/AspectsInfluences/Icon_BloodsoakedShroud","bluestone brooch":"Items/AspectsInfluences/Icon_Starter_BluestoneBrooch","bumba's hammer":"Items/AspectsInfluences/Icon_Starter_BumbasHammer","death's embrace":"Items/AspectsInfluences/Icon_Starter_DeathsTollUpgrade","heroism":"Items/AspectsInfluences/Icon_Starter_Heroism","hunter's cowl":"Items/AspectsInfluences/Icon_Starter_HuntersCowl","pendulum of the ages":"Items/AspectsInfluences/Icon_Starter_SandsOfTimeUpgrade","sharpshooter's arrow":"Items/AspectsInfluences/Icon_Aspect_Ranger","sundering axe":"Items/AspectsInfluences/Icon_Starter_SunderingAxeUpgrade","war banner":"Items/AspectsInfluences/Icon_Starter_WarBanner",
    "aegis of acceleration":"Items/T3/Icon_Relic_AegisOfAcceleration","blink rune":"Items/Utility/t_Blink_128","phantom shell":"Items/T3/Icon_Relic_PhantomShell","purification beads":"Items/Utility/T_Icon_Utility_PurificationBeads",
    "battle axe":"Items/T2/Icon_T2_BattleAxe","engraved guard":"Items/T2/Icon_T2_EngravedGuard","hunter's bow":"Items/T2/Icon_T2_HuntersBow","kopesh":"Items/T2/Icon_T2_Kopesh","lucerne hammer":"Items/T2/Icon_T2_LucerneHammer","mana tome":"Items/T2/Icon_T2_ManaTome","ring of dispel":"Items/T2/Icon_T2_RingOfDispel","skeggox":"Items/T2/Icon_T2_Skeggox","survivor's sash":"Items/T2/Icon_T2_SurvivorsSash","veve charm":"Items/T2/Icon_T2_VeveCharm",
    "amanita charm":"Items/T3/Icon_T3_RestorativeAmanita","ancient signet":"Items/T3/Icon_T3_AncientSignet","ancile":"Items/T3/Icon_T3_AncileShield","arondight":"Items/T3/Icons_T3_Arondight","avatar's parashu":"Items/T3/Icon_T3_Parashu","avenging blade":"Items/T3/Icon_T3_AvengingBlade","bancroft's talon":"Items/T3/Icon_T3_BancroftsTalon","barbed carver":"Items/T3/Icon_T3_BarbedCarver","berserker's shield":"Items/T3/Icons_T3_Berserker","blood-bound book":"Items/T3/Icon_T3_Blood-BoundBook","bloodforge":"Items/T3/Icon_T3_BloodForgedBlade","book of thoth":"Items/T3/Icon_T3_BookofThroth","bracer of the abyss":"Items/T3/Icon_T3_HandOfTheAbyss","bragi's harp":"Items/T3/Icon_T3_BragisHarp","brawler's beat stick":"Items/T3/Icon_T3_BrawlersRuin","breastplate of valor":"Items/TemporaryUI/SMITE1ItemIcons/Icon_BreastplateOfValor","chandra's grace":"Items/T3/Icons_T3_ChandrasGrace","chronos' pendant":"Items/T3/Icon_T3_ChronosPendant","circe's hexstone":"Items/T3/Icon_T3_CircesHexstone","contagion":"Items/T3/Icon_T3_Contagion","dagger of frenzy":"Items/T3/Icon_T3_DaggerOfFrenzy","daybreak gavel":"Items/T3/Icon_T3_DaybreakGavel","death metal":"Items/T3/Icon_T3_DeathMetal","deathbringer":"Items/T3/Icon_T3_Deathbringer","demon blade":"Items/T3/Icon_T3_BanefulRapier","devourer's gauntlet":"Items/T3/Icon_T3_DevoursGloves","divine ruin":"Items/T3/Icon_T3_DivineRuin","doom orb":"Items/T3/Icon_T3_DoomOrb","draconic scale":"Items/T3/Icons_T3_DraconicScales","dreamer's idol":"Items/T3/Icon_T3_DreamersIdol","dwarven plate":"Items/T3/Icon_T3_DwarfForgedPlate_Physical","erosion":"Items/T3/Icon_T3_Erosion","eye of erebus":"Items/T3/Icon_T3_EyeOfErebus","eye of providence":"Items/T3/Icon_T3_EyeOfProvidence","eye of the storm":"Items/T3/Icon_T3_EyeOfTheStorm","freya's tears":"Items/T3/Icon_T3_FreyasTears","gauntlet of thebes":"Items/T3/Icon_T3_GauntletOfThebes","gem of focus":"Items/T3/Icon_T3_GemOfFocus","gem of isolation":"Items/T3/Icon_T3_GemOfIsolation","genji's guard":"Items/T3/Icon_T3_GenjisGuard","gladiator's shield":"Items/T3/Icon_T3_LorgMor","glorious pridwen":"Items/T3/Icon_T3_Glorious_Pridwen","gluttonous grimoire":"Items/T3/Icon_T3_GluttonousGrimoire","golden blade":"Items/T3/Icon_T3_GoldenBlade","hastened fatalis":"Items/T3/Icon_T3_HastenedFatalis","heartseeker":"Items/T3/Icon_T3_Heartseeker","heartwood charm":"Items/T3/Icon_T3_HeartwoodCHarm","helm of darkness":"Items/T3/Icon_T3_HelmOfDarkness","helm of radiance":"Items/T3/Icon_T3_HelmOfRadiance","hide of the nemean lion":"Items/T3/Icon_T3_HideoftheNemeanLion","hussar's wings":"Items/T3/Icon_T3_HussarsWings","hydra's lament":"Items/T3/Icon_T3_HydrasLament","jade scepter":"Items/T3/Icon_T3_JadeScepter","jotunn's revenge":"Items/T3/Icon_T3_JotunnsRevenge","leviathan's hide":"Items/T3/Icon_T3_LevianthansHide","magi's cloak":"Items/T3/magisshelter","mantle of discord":"Items/T3/Icon_T3_MantleOfDiscord","musashi's dual swords":"Items/T3/Icon_T3_MusashisDualSwords","mystical mail":"Items/T3/Icons_T3_MysticalMail","necronomicon":"Items/T3/Icon_T3_Necronomicon","nimble ring":"Items/T3/Icon_T3_NimbleRing","obsidian shard":"Items/T3/Icon_T3_BalorsEye","odysseus' bow":"Items/T3/Icon_T3_OdysseusBow","oni hunter's garb":"Items/T3/Icons_T3_OniHuntersGarb","pendulum blade":"Items/T3/Icon_T3_PendulumBlade","pharaoh's curse":"Items/T3/Icon_T3_PharaohsCurse","phoenix feather":"Items/T3/Icon_T3_PhoenixAmulet","polynomicon":"Items/T3/Icon_T3_Polynomicon","prophetic cloak":"Items/T3/Icon_T3_Prophetic_Cloak","qin's blade":"Items/T3/Icon_T3_QinsBlade","rage":"Items/T3/Icon_T3_Rage","ragnarok's wake":"Items/T3/Icons_RagnaroksWake","regrowth striders":"Items/T3/Icon_T3_RegrowthStriders","riptalon":"Items/T3/Icons_T3_Riptalon","rod of tahuti":"Items/T3/Icon_T3_EldritchOrb","runeforged hammer":"Items/T3/Icon_T3_RuneforgedHammer","sanguine lash":"Items/T3/Icon_T3_SanguineLash","scepter of dominion":"Items/T3/Icon_T3_ScepterofDominion","screeching gargoyle":"Items/T3/Icon_T3_ScreechingGargoyle","shield of the phoenix":"Items/T3/Icon_T3_ShieldOfThePhoenix","shifter's shield":"Items/T3/Icon_T3_ShapeShifterShield","shogun's ofuda":"Items/T3/Icon_T3_ShogunsOfuda","soul gem":"Items/T3/Icons_T3_SoulGem","soul reaver":"Items/T3/Icon_T3_SoulDevourer","spear of desolation":"Items/T3/Icon_T3_SpearofDesolation","spectral armor":"Items/T3/Icon_T3_SpectralArmor","spectral visage":"Items/T3/Icon_T3_SpectralVisage","spirit robe":"Items/T3/Icon_T3_SpiritRobe","staff of myrddin":"Items/T3/Icon_T3_StaffOfMyrddin","stampede":"Items/T3/Icon_T3_Stampede","stone of binding":"Items/T3/Icon_T3_BindingsOfLyngvi","stygian anchor":"Items/T3/Icons_T3_StygianAnchor","tekko-kagi":"Items/T3/Icon_T3_TekkoKagi","the cosmic horror":"Items/T3/Icon_T3_StaffOfCosmicHorror","the crusher":"Items/T3/Icon_T3_Crusher","the executioner":"Items/T3/Icon_T3_TheExecutioner","the reaper":"Items/T3/Icon_T3_TheReaper","the world stone":"Items/T3/Icon_T3_TheWorldStone","titan's bane":"Items/T3/Icon_T3_ObsidianMacuahuitl","totem of death":"Items/T3/Icon_T3_TotemOfDeath","transcendence":"Items/T3/Icon_T3_Transcendence","typhon's heart":"Items/T3/Icon_T3_TyphonsHeart","tyrfing":"Items/T3/Icon_T3_Tyrfing","umbral link":"Items/T3/Icon_T3_UmbralLink","vital amplifier":"Items/T3/Icon_T3_VitalAmplifier","void shield":"Items/T3/Icon_T3_VoidShield","void stone":"Items/T3/Icon_T3_VoidStone","xibalban effigy":"Items/T3/Icons_T3_XibalbanEffigyNew","yogi's necklace":"Items/T3/Icon_T3_YogisNecklace",
}
function getItemImage(name) {
    return ITEM_IMAGES[name.toLowerCase()] ? `${ITEM_CDN}/${ITEM_IMAGES[name.toLowerCase()]}.png` : null
}

const CHANGE_BADGE = {
    new: { label: 'NEW', bg: 'bg-blue-500/20', text: 'text-blue-400' },
    rework: { label: 'REWORK', bg: 'bg-purple-500/20', text: 'text-purple-400' },
    stat_change: { label: 'STAT CHANGE', bg: 'bg-amber-500/20', text: 'text-amber-400' },
    removed: { label: 'REMOVED', bg: 'bg-red-500/20', text: 'text-red-400' },
    shift: { label: 'SHIFT', bg: 'bg-amber-500/20', text: 'text-amber-400' },
    buff: { label: 'BUFF', bg: 'bg-green-500/20', text: 'text-green-400' },
    nerf: { label: 'NERF', bg: 'bg-red-500/20', text: 'text-red-400' },
    adjustment: { label: 'ADJUSTMENT', bg: 'bg-amber-500/20', text: 'text-amber-400' },
    base_buff: { label: 'BASE BUFF', bg: 'bg-green-500/20', text: 'text-green-400' },
    base_nerf: { label: 'BASE NERF', bg: 'bg-red-500/20', text: 'text-red-400' },
    aspect_nerf: { label: 'ASPECT NERF', bg: 'bg-red-500/20', text: 'text-red-400' },
    aspect_buff: { label: 'ASPECT BUFF', bg: 'bg-green-500/20', text: 'text-green-400' },
    buff_aspect_nerf: { label: 'MIXED', bg: 'bg-purple-500/20', text: 'text-purple-400' },
}

const SECTION_ICONS = {
    new_items: { icon: '\u2726', color: 'text-blue-400' },
    item_balance: { icon: '\u21C4', color: 'text-amber-400' },
    standard_item_balance: { icon: '\u21C4', color: 'text-amber-400' },
    god_buffs: { icon: '\u25B2', color: 'text-green-400' },
    god_nerfs: { icon: '\u25BC', color: 'text-red-400' },
    god_adjustments: { icon: '\u27F3', color: 'text-purple-400' },
}

const SECTION_LABELS = {
    new_items: 'New Items',
    item_balance: 'Item Changes',
    standard_item_balance: 'Standard Balance',
    god_buffs: 'God Buffs',
    god_nerfs: 'God Nerfs',
    god_adjustments: 'Adjustments',
}

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : ''

const borderColorForType = (type) => {
    if (!type) return 'border-white/10'
    if (type.includes('buff') && !type.includes('nerf')) return 'border-green-500/40'
    if (type.includes('nerf') && !type.includes('buff')) return 'border-red-500/40'
    return 'border-purple-500/40'
}

const Badge = ({ type }) => {
    const b = CHANGE_BADGE[type] || CHANGE_BADGE.adjustment
    return <span className={`px-2 py-0.5 rounded text-xs font-bold ${b.bg} ${b.text}`}>{b.label}</span>
}

const LOWER_IS_BETTER = /cooldown|cost|mana\s*cost/i
const ChangeLine = ({ stat, oldVal, newVal, isNewItem }) => {
    if (isNewItem) return <div className="text-green-400 text-sm">{stat}: {newVal || oldVal}</div>
    const oldNum = parseFloat(oldVal)
    const newNum = parseFloat(newVal)
    const increased = newNum > oldNum
    const inverted = LOWER_IS_BETTER.test(stat)
    const isBuffDir = inverted ? !increased : increased
    const valColor = isNaN(oldNum) || isNaN(newNum) ? 'text-white/80' : isBuffDir ? 'text-green-400' : 'text-red-400'
    return (
        <div className="flex items-center gap-2 text-sm">
            <span className="text-white/50">{stat}</span>
            {oldVal && <span className="line-through text-white/30">{oldVal}</span>}
            <span className="text-white/20">&rarr;</span>
            <span className={valColor}>{newVal}</span>
        </div>
    )
}

const ItemCard = ({ item }) => {
    const stats = typeof item.stats === 'string' ? JSON.parse(item.stats) : item.stats
    const isNew = item.change_type === 'new'
    const imgUrl = getItemImage(item.item_name)
    return (
        <div className="bg-(--color-secondary) border border-white/10 rounded-xl p-5">
            <div className="flex items-center gap-3 mb-2">
                {imgUrl && <img src={imgUrl} alt={item.item_name} className="w-10 h-10 rounded-lg object-cover" />}
                <h3 className="font-(--font-heading) text-lg font-bold text-white">{item.item_name}</h3>
                <Badge type={item.change_type} />
            </div>
            {(item.cost || item.build_path) && (
                <p className="text-white/40 text-xs mb-3">
                    {item.cost}{item.cost && item.build_path && ' \u2014 '}{item.build_path}
                </p>
            )}
            {stats?.length > 0 && (
                <div className="space-y-1 mb-3">
                    {stats.map((s, i) => (
                        <ChangeLine key={i} stat={s.stat} oldVal={s.old_value || s.value} newVal={s.new_value || s.value} isNewItem={isNew} />
                    ))}
                </div>
            )}
            {item.passive_text && (() => {
                const prefixMatch = item.passive_text.match(/^(New Passive:|Passive:|Active:)\s*/)
                return (
                    <div className="border-l-2 border-(--color-accent)/50 pl-3 mt-3 text-sm text-white/70">
                        {prefixMatch ? (
                            <>
                                <span className="text-(--color-accent) font-semibold">{prefixMatch[1]}</span>{' '}
                                {item.passive_text.slice(prefixMatch[0].length)}
                            </>
                        ) : (
                            item.passive_text
                        )}
                    </div>
                )
            })()}
        </div>
    )
}

const GodCard = ({ god }) => {
    const abilities = typeof god.abilities === 'string' ? JSON.parse(god.abilities) : god.abilities
    return (
        <div className={`bg-(--color-secondary) border-l-4 ${borderColorForType(god.change_type)} border border-white/10 rounded-xl p-5`}>
            <div className="flex items-center gap-4 mb-4">
                {god.god_image_url && (
                    <img src={god.god_image_url} alt={god.god_name} className="w-16 h-16 rounded-lg object-cover" />
                )}
                <div>
                    <h3 className="font-(--font-heading) text-lg font-bold text-white">{god.god_name}</h3>
                    <Badge type={god.change_type} />
                </div>
            </div>
            {abilities?.map((ab, i) => (
                <div key={i} className="bg-(--color-primary) rounded-lg p-3 mb-2">
                    <p className="text-(--color-accent) font-semibold text-sm mb-1.5">
                        {ab.name} <span className="text-white/30 font-normal">({ab.slot})</span>
                    </p>
                    <div className="space-y-1">
                        {ab.changes?.map((c, j) => (
                            <ChangeLine key={j} stat={c.stat} oldVal={c.old_value} newVal={c.new_value} />
                        ))}
                    </div>
                </div>
            ))}
            {god.notes && (
                <div className="border-l-2 border-purple-500/50 pl-3 mt-3 text-sm text-white/60 italic">{god.notes}</div>
            )}
        </div>
    )
}

export default function PatchNotesDetail() {
    const { slug } = useParams()
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [searchQuery, setSearchQuery] = useState('')
    const [activeSection, setActiveSection] = useState(null)
    const [collapsedSections, setCollapsedSections] = useState({})
    const sectionRefs = useRef({})

    const toggleSection = useCallback((id) => {
        setCollapsedSections(prev => ({ ...prev, [id]: !prev[id] }))
    }, [])

    useEffect(() => {
        let cancelled = false
        setLoading(true)
        setError(null)
        patchNotesService.getDetail(slug).then(d => {
            if (!cancelled) setData(d)
        }).catch(e => {
            if (!cancelled) setError(e.message)
        }).finally(() => {
            if (!cancelled) setLoading(false)
        })
        return () => { cancelled = true }
    }, [slug])

    const sections = useMemo(() => {
        if (!data) return []
        const { godChanges = [], itemChanges = [] } = data
        const q = searchQuery.toLowerCase()
        const filterItem = (it) => !q || it.item_name?.toLowerCase().includes(q)
        const filterGod = (g) => !q || g.god_name?.toLowerCase().includes(q)

        const groups = []
        const itemsBySection = {}
        itemChanges.filter(filterItem).forEach(it => {
            const s = it.section || 'item_balance'
            ;(itemsBySection[s] ||= []).push(it)
        })
        for (const key of ['new_items', 'item_balance', 'standard_item_balance']) {
            if (itemsBySection[key]?.length) {
                groups.push({ id: key, label: SECTION_LABELS[key], items: itemsBySection[key], type: 'items' })
            }
        }

        const buffs = [], nerfs = [], adjustments = []
        godChanges.filter(filterGod).forEach(g => {
            const t = g.change_type || ''
            if (t.includes('buff') && !t.includes('nerf')) buffs.push(g)
            else if (t.includes('nerf') && !t.includes('buff')) nerfs.push(g)
            else adjustments.push(g)
        })
        if (buffs.length) groups.push({ id: 'god_buffs', label: SECTION_LABELS.god_buffs, items: buffs, type: 'gods' })
        if (nerfs.length) groups.push({ id: 'god_nerfs', label: SECTION_LABELS.god_nerfs, items: nerfs, type: 'gods' })
        if (adjustments.length) groups.push({ id: 'god_adjustments', label: SECTION_LABELS.god_adjustments, items: adjustments, type: 'gods' })

        return groups
    }, [data, searchQuery])

    // IntersectionObserver for active section tracking
    useEffect(() => {
        if (!sections.length) return
        const obs = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    setActiveSection(entry.target.dataset.sectionId)
                    break
                }
            }
        }, { rootMargin: '-80px 0px -60% 0px', threshold: 0 })

        Object.values(sectionRefs.current).forEach(el => el && obs.observe(el))
        return () => obs.disconnect()
    }, [sections])

    const scrollTo = useCallback((id) => {
        sectionRefs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, [])

    if (loading) {
        return (
            <div className="min-h-screen">
                <PageTitle title="Patch Notes" />
                <Navbar title="Patch Notes" />
                <div className="pt-24 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-(--color-accent) mx-auto" />
                </div>
            </div>
        )
    }

    if (error || !data?.patchNote) {
        return (
            <div className="min-h-screen">
                <PageTitle title="Patch Notes" />
                <Navbar title="Patch Notes" />
                <div className="pt-24 text-center">
                    <p className="text-red-400 mb-4">{error || 'Patch note not found.'}</p>
                    <Link to="/patchnotes" className="text-(--color-accent) hover:underline">Back to Patch Notes</Link>
                </div>
            </div>
        )
    }

    const { patchNote } = data

    return (
        <div className="min-h-screen">
            <PageTitle title={`${patchNote.title} Patch Notes`} description={`${patchNote.version} balance changes`} />
            <Navbar title="Patch Notes" />

            {/* Hero Banner */}
            <div className="relative w-full h-56 sm:h-72 overflow-hidden">
                <img src={patchBanner} alt="Patch Notes Banner" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-(--color-primary) via-black/30 to-transparent" />
            </div>

            {/* Header — below banner */}
            <div className="text-center py-8">
                <Link to="/patchnotes" className="inline-flex items-center gap-1.5 text-white/50 hover:text-(--color-accent) text-sm mb-3 transition-colors">
                    <ArrowLeft size={14} /> All Patches
                </Link>
                <h1 className="text-4xl sm:text-5xl font-bold text-white uppercase tracking-[0.15em]" style={{ fontFamily: "'Cinzel', serif" }}>
                    {patchNote.title}
                </h1>
                <p className="text-white/50 mt-2 text-sm tracking-wider">{patchNote.version} &middot; {formatDate(patchNote.patch_date)}</p>
                {patchNote.subtitle && <p className="text-(--color-accent)/70 text-xs mt-1 uppercase tracking-[0.2em]">{patchNote.subtitle}</p>}
            </div>

            <div className="max-w-7xl mx-auto px-4">

                <div className="flex gap-6 pb-16">
                    {/* Sidebar — desktop: sticky column, mobile: horizontal scroll pills */}
                    <aside className="hidden lg:block w-56 shrink-0">
                        <div className="sticky top-24 space-y-1">
                            {sections.map(s => {
                                const si = SECTION_ICONS[s.id] || SECTION_ICONS.item_balance
                                const active = activeSection === s.id
                                return (
                                    <button
                                        key={s.id}
                                        onClick={() => scrollTo(s.id)}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm flex items-center gap-2 transition-colors ${
                                            active ? 'bg-(--color-accent)/10 text-(--color-accent) border-l-2 border-(--color-accent)' : 'text-white/50 hover:text-white/80 border-l-2 border-transparent'
                                        }`}
                                    >
                                        <span className={si.color}>{si.icon}</span>
                                        {s.label}
                                        <span className="ml-auto text-white/20 text-xs">{s.items.length}</span>
                                    </button>
                                )
                            })}
                            <div className="pt-4">
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" size={14} />
                                    <input
                                        type="text"
                                        placeholder="Filter..."
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        className="w-full pl-8 pr-3 py-2 rounded-lg bg-(--color-secondary) border border-white/10 text-white text-sm placeholder-white/30 focus:outline-none focus:border-(--color-accent)/40"
                                    />
                                </div>
                            </div>
                        </div>
                    </aside>

                    {/* Mobile pill bar */}
                    <div className="lg:hidden fixed top-16 left-0 right-0 z-30 bg-(--color-primary)/95 backdrop-blur border-b border-white/10 px-3 py-2 flex gap-2 overflow-x-auto scrollbar-hide">
                        {sections.map(s => {
                            const si = SECTION_ICONS[s.id] || SECTION_ICONS.item_balance
                            const active = activeSection === s.id
                            return (
                                <button
                                    key={s.id}
                                    onClick={() => scrollTo(s.id)}
                                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                                        active ? 'bg-(--color-accent)/20 text-(--color-accent)' : 'bg-white/5 text-white/50'
                                    }`}
                                >
                                    <span className={si.color}>{si.icon}</span> {s.label}
                                </button>
                            )
                        })}
                        <div className="shrink-0 relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" size={12} />
                            <input
                                type="text"
                                placeholder="Filter..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                className="pl-7 pr-2 py-1.5 rounded-full bg-white/5 border border-white/10 text-white text-xs placeholder-white/30 w-28 focus:outline-none focus:border-(--color-accent)/40"
                            />
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 space-y-10 lg:mt-0 mt-12">
                        {sections.length === 0 && (
                            <p className="text-center text-white/40 py-12">
                                {searchQuery ? 'No changes match your search.' : 'No changes in this patch.'}
                            </p>
                        )}
                        {sections.map(s => {
                            const isCollapsed = collapsedSections[s.id]
                            return (
                                <section
                                    key={s.id}
                                    ref={el => { sectionRefs.current[s.id] = el }}
                                    data-section-id={s.id}
                                    className="scroll-mt-24"
                                >
                                    <button
                                        onClick={() => toggleSection(s.id)}
                                        className="w-full mb-6 cursor-pointer group"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                                            <div className="flex items-center gap-2.5">
                                                <span className={`text-lg ${SECTION_ICONS[s.id]?.color}`}>{SECTION_ICONS[s.id]?.icon}</span>
                                                <span
                                                    className="text-xl sm:text-2xl font-bold text-white uppercase tracking-[0.2em] group-hover:text-(--color-accent) transition-colors"
                                                    style={{ fontFamily: "'Cinzel', serif" }}
                                                >
                                                    {s.label}
                                                </span>
                                                <span className="text-white/20 text-xs font-normal tracking-normal">({s.items.length})</span>
                                                <ChevronDown
                                                    size={16}
                                                    className={`text-white/30 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
                                                />
                                            </div>
                                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                                        </div>
                                    </button>
                                    {!isCollapsed && (
                                        <div className="grid gap-4">
                                            {s.items.map((item, i) =>
                                                s.type === 'items'
                                                    ? <ItemCard key={item.id || i} item={item} />
                                                    : <GodCard key={item.id || i} god={item} />
                                            )}
                                        </div>
                                    )}
                                </section>
                            )
                        })}
                    </div>
                </div>
            </div>
        </div>
    )
}
