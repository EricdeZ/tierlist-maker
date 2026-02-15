import { useEffect } from 'react'

const SITE_NAME = 'SMITE 2 Companion'
const SITE_URL = 'https://smitecomp.com'
const DEFAULT_IMAGE = `${SITE_URL}/smitecomp.png`

function updateMetaTag(attribute, key, value) {
    if (!value) return
    let el = document.querySelector(`meta[${attribute}="${key}"]`)
    if (el) {
        el.setAttribute('content', value)
    } else {
        el = document.createElement('meta')
        el.setAttribute(attribute, key)
        el.setAttribute('content', value)
        document.head.appendChild(el)
    }
}

function updateCanonical(url) {
    let el = document.querySelector('link[rel="canonical"]')
    if (el) {
        el.setAttribute('href', url)
    } else {
        el = document.createElement('link')
        el.setAttribute('rel', 'canonical')
        el.setAttribute('href', url)
        document.head.appendChild(el)
    }
}

const PageTitle = ({ title, description, noindex }) => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME
    const canonicalUrl = `${SITE_URL}${window.location.pathname}`

    useEffect(() => {
        document.title = fullTitle

        // Update OG tags for SPA navigation
        updateMetaTag('property', 'og:title', fullTitle)
        updateMetaTag('property', 'og:url', canonicalUrl)
        updateMetaTag('name', 'twitter:title', fullTitle)
        updateCanonical(canonicalUrl)

        if (description) {
            updateMetaTag('name', 'description', description)
            updateMetaTag('property', 'og:description', description)
            updateMetaTag('name', 'twitter:description', description)
        }

        if (noindex) {
            updateMetaTag('name', 'robots', 'noindex, nofollow')
        } else {
            updateMetaTag('name', 'robots', 'index, follow')
        }
    }, [fullTitle, description, noindex, canonicalUrl])

    return null
}

export default PageTitle
