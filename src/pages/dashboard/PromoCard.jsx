import { Link } from 'react-router-dom'

export default function PromoCard({ title, description, ctaText, ctaLink, icon }) {
    return (
        <div className="flex flex-col items-center justify-center text-center py-5 px-4 border border-dashed border-white/10 rounded-xl">
            {icon && (
                <div className="w-12 h-12 rounded-full bg-(--color-accent)/15 flex items-center justify-center text-2xl mb-3 ring-1 ring-(--color-accent)/20">
                    {icon}
                </div>
            )}
            <p className="font-heading font-bold text-sm mb-1">{title}</p>
            <p className="text-xs text-(--color-text-secondary) mb-4 max-w-[180px]">{description}</p>
            <Link
                to={ctaLink}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-(--color-accent) to-(--color-accent)/70 text-white text-xs font-semibold hover:opacity-90 transition-opacity shadow-sm shadow-(--color-accent)/20"
            >
                {ctaText}
            </Link>
        </div>
    )
}
