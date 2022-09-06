import { Selector, InputType, GraphQLTypes } from 'zeus'

export const projectSelector = Selector('Project')({
    id: true,
    image: [{}, { url: [{}, true] }],
    demo: true,
    name: true,
    sourceCode: true,
    description: true,
    stack: true
})

export type ProjectType = InputType<GraphQLTypes['Project'], typeof projectSelector>

export const skillSelector = Selector('Skill')({
    id: true,
    icon: [{}, { url: [{}, true] }],
    name: true
})

export type SkillType = InputType<GraphQLTypes['Skill'], typeof skillSelector>

export const skillCategorySelector = Selector('SkillCategory')({
    id: true,
    name: true,
    skillsList: [{}, { '...on Skill': skillSelector }]
})

export type SkillCategoryType = InputType<GraphQLTypes['SkillCategory'], typeof skillCategorySelector>

export const seoSelector = Selector('Seo')({
    description: true,
    og_image: [{}, { url: [{}, true] }],
    keywords: true,
    title: true,
    updatedAt: true
})

export type SeoType = InputType<GraphQLTypes['Seo'], typeof seoSelector>

export const companySelector = Selector('Company')({
    companyName: true,
    companyWebsite: true
})
export type CompanyType = InputType<GraphQLTypes['Company'], typeof companySelector>

export const linkSelector = Selector('Link')({
    icon: [{}, { url: [{}, true] }],
    name: true,
    url: true
})
export type LinkType = InputType<GraphQLTypes['Link'], typeof linkSelector>

export const aboutMeSelector = Selector('AboutMe')({
    links: [{}, { '...on Link': linkSelector }],
    contactEmail: true,
    company: [{}, companySelector],
    description: true,
    photo: [{}, { url: [{}, true] }]
})

export type AboutMeType = InputType<GraphQLTypes['AboutMe'], typeof aboutMeSelector>
