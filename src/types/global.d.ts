import { AboutMeType, ProjectType, SeoType, SkillCategoryType } from 'pages/api/chain/selectors'

declare module 'types/global' {
    interface LandingProps {
        portfolio: ProjectType[]
        seo: SeoType
        aboutMe: AboutMeType
        skills: SkillCategoryType[]
    }
}
