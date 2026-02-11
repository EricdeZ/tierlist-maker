const SITE_NAME = 'SMITE 2 Companion'

const PageTitle = ({ title, description, noindex }) => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : SITE_NAME

    return (
        <>
            <title>{fullTitle}</title>
            {description && <meta name="description" content={description} />}
            {noindex && <meta name="robots" content="noindex, nofollow" />}
        </>
    )
}

export default PageTitle
