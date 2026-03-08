import { Link } from 'react-router-dom'
import { MessageCircle, Sparkles } from 'lucide-react'
import smiteLogo from '../../assets/smite2.png'

const HomepageFooter = () => {
    return (
        <>
            {/* Coin Flip Link */}
            <div className="text-center pb-8">
                <Link
                    to="/coinflip"
                    className="text-sm text-(--color-text-secondary)/40 hover:text-(--color-accent) transition-colors"
                >
                    Flip coin
                </Link>
            </div>

            {/* Footer */}
            <footer className="py-8 px-4 border-t border-white/5">
                <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <img src={smiteLogo} alt="" className="h-6 w-auto opacity-50" />
                        <span className="text-sm text-(--color-text-secondary)/50">
                            SMITE 2 Companion
                        </span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap justify-center">
                        <a
                            href="https://discord.gg/vAdQMp65nK"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs text-(--color-text-secondary)/50 hover:text-[#5865F2] transition-colors"
                            title="smitecomp.com Discord"
                        >
                            <MessageCircle className="w-3.5 h-3.5" />
                            smitecomp.com Discord
                        </a>
                        <span className="text-(--color-text-secondary)/20 hidden sm:inline">·</span>
                        <Link
                            to="/support"
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-(--color-accent)/70 hover:text-(--color-accent) transition-colors"
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            Support smitecomp.com
                        </Link>
                    </div>
                    <p className="text-xs text-(--color-text-secondary)/30">
                        Community project · Not affiliated with Hi-Rez Studios
                    </p>
                </div>
            </footer>
        </>
    )
}

export default HomepageFooter
