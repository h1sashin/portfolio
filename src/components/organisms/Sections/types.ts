import { AboutMeType, CompanyType, LinkType, ProjectType, SkillCategoryType } from 'chain/selectors'

export interface HeroProps {
    links: LinkType[]
    company?: CompanyType
}

export interface PortfolioProps {
    portfolio: ProjectType[]
}

export interface AboutMeProps {
    skills: SkillCategoryType[]
    aboutMe: AboutMeType
}
