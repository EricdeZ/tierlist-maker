export default function XpScrimHelpWindow() {
    const sectionStyle = { marginBottom: 10 }
    const headingStyle = { fontWeight: 700, fontSize: 12, color: '#003399', marginBottom: 3, borderBottom: '1px solid #ccc', paddingBottom: 2 }
    const textStyle = { fontSize: 11, lineHeight: '1.5', color: '#222' }
    const listStyle = { fontSize: 11, lineHeight: '1.6', color: '#222', paddingLeft: 16, margin: '2px 0' }
    const warnStyle = { fontSize: 11, lineHeight: '1.5', color: '#cc0000', fontWeight: 600, background: '#fff0f0', border: '1px solid #ffcccc', padding: '4px 6px', borderRadius: 2, marginTop: 4 }

    return (
        <div style={{ padding: 8 }}>
            <div style={sectionStyle}>
                <div className="xp-text" style={headingStyle}>How It Works</div>
                <ol className="xp-text" style={listStyle}>
                    <li><b>Post a Scrim</b> &mdash; Captains pick a date/time, pick mode, and which tiers can accept.</li>
                    <li><b>Accept a Scrim</b> &mdash; Browse Open Scrims and accept with one of your captain teams.</li>
                    <li><b>Play the Match</b> &mdash; Show up at the scheduled time and play your scrim.</li>
                    <li><b>Report Outcome</b> &mdash; After the scheduled time, report the result: Completed, We No-Showed, or They No-Showed.</li>
                </ol>
            </div>

            <div style={sectionStyle}>
                <div className="xp-text" style={headingStyle}>Outcome Reporting</div>
                <div className="xp-text" style={textStyle}>
                    After a scrim's scheduled time passes, either captain can report the outcome:
                </div>
                <ul className="xp-text" style={listStyle}>
                    <li><b>Completed</b> &mdash; The scrim was played successfully.</li>
                    <li><b>We No-Showed</b> &mdash; Your team didn't make it. This is a self-admission and is immediately confirmed.</li>
                    <li><b>They No-Showed</b> &mdash; The other team didn't show up. The accused team has 24 hours to dispute the claim.</li>
                </ul>
            </div>

            <div style={sectionStyle}>
                <div className="xp-text" style={headingStyle}>Disputes</div>
                <div className="xp-text" style={textStyle}>
                    If you're accused of a no-show, you have <b>24 hours</b> to dispute it. A disputed no-show won't count against your reliability score. If you don't dispute within 24 hours, the no-show is confirmed.
                </div>
            </div>

            <div style={sectionStyle}>
                <div className="xp-text" style={headingStyle}>Reliability Score</div>
                <div className="xp-text" style={textStyle}>
                    Every team has a reliability score shown as a percentage next to their name. It's calculated as:
                </div>
                <div className="xp-text" style={{ ...textStyle, textAlign: 'center', fontWeight: 700, margin: '4px 0', fontFamily: 'monospace' }}>
                    completed / (completed + confirmed no-shows) &times; 100
                </div>
                <div className="xp-text" style={textStyle}>
                    Disputed and self-admitted no-shows that are within the dispute window don't affect the score until confirmed. Only confirmed no-shows (undisputed after 24h) count against you.
                </div>
                <div className="xp-text" style={warnStyle}>
                    Teams with low reliability scores will be visible to all captains. If your reliability drops too low, you won't be able to post or accept new scrims until it improves.
                </div>
            </div>

            <div style={sectionStyle}>
                <div className="xp-text" style={headingStyle}>Blacklist</div>
                <div className="xp-text" style={textStyle}>
                    Captains can block specific teams from accepting their scrims. Blocked teams won't see your open scrim requests at all. Blacklisting is one-directional &mdash; if you block a team, they can't accept your scrims, but you can still see and accept theirs. Neither side can send direct challenges to the other while blocked.
                </div>
            </div>

            <div style={sectionStyle}>
                <div className="xp-text" style={headingStyle}>Pick Modes</div>
                <ul className="xp-text" style={listStyle}>
                    <li><b>Regular</b> &mdash; Standard picks and bans.</li>
                    <li><b>Fearless</b> &mdash; No god can be picked or banned more than once across all games.</li>
                    <li><b>Fearless Picks</b> &mdash; No god can be picked more than once (bans can repeat).</li>
                    <li><b>Fearless Bans</b> &mdash; No ban can repeat (picks can repeat).</li>
                </ul>
            </div>

            <div style={sectionStyle}>
                <div className="xp-text" style={headingStyle}>Direct Challenges</div>
                <div className="xp-text" style={textStyle}>
                    Instead of posting an open request, you can directly challenge a specific team. They'll see the challenge in their "My Scrims" tab under incoming challenges. They can accept or decline.
                </div>
            </div>
        </div>
    )
}
