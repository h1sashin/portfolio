import { Chain, Locale, Stage } from 'zeus'
import { pageMetadataSelector, projectSelector, skillSelector, socialSelector } from './selectors'

export const chain = Chain(process.env.NEXT_PUBLIC_HOST, {
    headers: {
        Authorization: `Bearer ${process.env.NEXT_PUBLIC_CMS_TOKEN}`
    }
})

export const getSocials = async () =>
    await chain('query')({
        socials: [{ stage: Stage.PUBLISHED, locales: [Locale.en] }, socialSelector]
    })

export const getPagesMetadata = async () =>
    await chain('query')({
        pagesMetadata: [{ stage: Stage.PUBLISHED, locales: [Locale.en] }, pageMetadataSelector]
    })

export const getPageMetadataBySlug = async (slug: string) =>
    await chain('query')({
        pageMetadata: [{ stage: Stage.PUBLISHED, locales: [Locale.en], where: { slug } }, pageMetadataSelector]
    })

export const getProjects = async () =>
    await chain('query')({
        projects: [{ stage: Stage.PUBLISHED, locales: [Locale.en] }, projectSelector]
    })

export const getSkills = async () =>
    await chain('query')({
        skills: [{ stage: Stage.PUBLISHED, locales: [Locale.en] }, skillSelector]
    })
