import { AboutMeType, ProjectType, SeoType, SkillCategoryType } from 'chain/selectors'

declare module 'types/global' {
    interface LandingProps {
        portfolio: ProjectType[]
        seo: SeoType
        aboutMe: AboutMeType
        skills: SkillCategoryType[]
    }
}
