import { Link } from 'react-router-dom'

export default function PromoCard({ title, description, ctaText, ctaLink, icon }) {
    return (
        <div className="flex flex-col items-center justify-center text-center py-4 px-3">
            {icon && <div className="text-3xl mb-2 opacity-60">{icon}</div>}
            <p className="font-heading font-bold text-sm mb-1">{title}</p>
            <p className="text-xs text-(--color-text-secondary) mb-3">{description}</p>
            <Link
                to={ctaLink}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-(--color-accent)/10 text-(--color-accent) text-xs font-semibold hover:bg-(--color-accent)/20 transition-colors"
            >
                {ctaText}
            </Link>
        </div>
    )
}
