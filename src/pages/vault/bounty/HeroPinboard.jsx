import WantedPoster from '../components/WantedPoster'

export default function HeroPinboard({ bounties, fulfillableIds, onFulfill }) {
  if (!bounties || bounties.length === 0) return null

  return (
    <div className="mb-8">
      <div className="text-center mb-5">
        <h2
          className="font-bold tracking-[0.3em]"
          style={{
            fontFamily: 'Georgia, serif',
            fontSize: 24,
            color: '#ff8c00',
            textShadow: '0 0 20px rgba(255,140,0,0.4), 0 0 40px rgba(255,140,0,0.2)',
          }}
        >
          MOST WANTED
        </h2>
        <div className="text-[11px] tracking-[0.15em] mt-1" style={{ color: '#7a8a9a', fontFamily: "'Share Tech Mono', monospace" }}>
          HIGHEST BOUNTIES ON THE BOARD
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-6 px-4 items-start">
        {bounties.map((b, i) => (
          <div key={b.id} style={{ marginTop: [0, 16, 6, 22, 10][i % 5] }}>
            <WantedPoster
              bounty={b}
              size="lg"
              canFulfill={fulfillableIds?.includes(b.id)}
              onFulfill={onFulfill}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
