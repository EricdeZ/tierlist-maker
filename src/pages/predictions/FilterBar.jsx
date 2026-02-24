import { Search } from 'lucide-react'
import { getLeagueLogo } from '../../utils/leagueImages'
import { getDivisionImage } from '../../utils/divisionImages'

export function FilterBar({ leagues, selectedLeague, setSelectedLeague, selectedDivision, setSelectedDivision, availableDivisions, search, setSearch }) {
    return (
        <div className="mb-6 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <button onClick={() => setSelectedLeague('')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        !selectedLeague ? 'text-[#f8c56a] font-bold' : 'text-white/60 hover:text-white'
                    }`}
                    style={{ background: !selectedLeague ? 'rgba(248,197,106,0.12)' : 'rgba(255,255,255,0.06)' }}>
                    All
                </button>
                {leagues.map(l => {
                    const logo = getLeagueLogo(l.slug)
                    const isActive = selectedLeague === l.slug
                    return (
                        <button key={l.id} onClick={() => setSelectedLeague(isActive ? '' : l.slug)}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                                isActive ? 'text-white font-bold' : 'text-white/60 hover:text-white'
                            }`}
                            style={{
                                background: isActive ? `${l.color || '#f8c56a'}20` : 'rgba(255,255,255,0.06)',
                                boxShadow: isActive ? `inset 0 0 0 1px ${l.color || '#f8c56a'}40` : 'none',
                            }}>
                            {logo && <img src={logo} alt="" className="w-5 h-5 object-contain" />}
                            <span className="hidden sm:inline">{l.name}</span>
                        </button>
                    )
                })}

                <div className="flex-1" />
                <div className="relative w-full sm:w-48">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
                    <input type="text" placeholder="Search teams..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs text-white placeholder:text-white/30 outline-none transition-colors"
                        style={{ background: 'rgba(255,255,255,0.06)' }} />
                </div>
            </div>

            {selectedLeague && availableDivisions.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    <button onClick={() => setSelectedDivision('')}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                            !selectedDivision ? 'text-[#f8c56a] font-bold' : 'text-white/50 hover:text-white/80'
                        }`}
                        style={{ background: !selectedDivision ? 'rgba(248,197,106,0.1)' : 'rgba(255,255,255,0.05)' }}>
                        All Divisions
                    </button>
                    {availableDivisions.map(d => {
                        const divImg = getDivisionImage(selectedLeague, d.slug, d.tier)
                        const isActive = selectedDivision === d.slug
                        return (
                            <button key={d.id} onClick={() => setSelectedDivision(isActive ? '' : d.slug)}
                                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                                    isActive ? 'text-white font-bold' : 'text-white/50 hover:text-white/80'
                                }`}
                                style={{
                                    background: isActive ? 'rgba(248,197,106,0.1)' : 'rgba(255,255,255,0.05)',
                                    boxShadow: isActive ? 'inset 0 0 0 1px rgba(248,197,106,0.2)' : 'none',
                                }}>
                                {divImg && <img src={divImg} alt="" className="w-4 h-4 object-contain" />}
                                {d.name}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
