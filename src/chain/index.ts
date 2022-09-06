import { AboutMeOrderByInput, Chain, Locale, SeoOrderByInput, Stage, _OrderDirection } from 'zeus'
import { seoSelector, projectSelector, skillCategorySelector, aboutMeSelector } from './selectors'

export const chain = Chain(process.env.HOST, {
    headers: {
        Authorization: `Bearer ${process.env.CMS_TOKEN}`
    }
})

export const getSeo = async () =>
    await chain('query')({
        seos: [{ stage: Stage.PUBLISHED, locales: [Locale.en], orderBy: SeoOrderByInput.updatedAt_DESC }, seoSelector]
    })

export const getProjects = async () =>
    await chain('query')({
        projects: [{ stage: Stage.PUBLISHED, locales: [Locale.en] }, projectSelector]
    })

export const getSkillCategories = async () =>
    await chain('query')({
        skillCategories: [{ stage: Stage.PUBLISHED, locales: [Locale.en] }, skillCategorySelector]
    })

export const getAboutMe = async () =>
    await chain('query')({
        aboutMes: [
            { stage: Stage.PUBLISHED, locales: [Locale.en], orderBy: AboutMeOrderByInput.updatedAt_DESC },
            aboutMeSelector
        ]
    })
