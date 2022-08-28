import { Selector, InputType, GraphQLTypes } from 'zeus'

export const pageMetadataSelector = Selector('PageMetadata')({
    id: true,
    slug: true,
    image: [{}, { url: [{}, true] }],
    pageNumber: true,
    summary: true,
    title: true
})

export type PageMetadataType = InputType<GraphQLTypes['Query'], typeof pageMetadataSelector>

export const projectSelector = Selector('Project')({
    id: true,
    image: [{}, { url: [{}, true] }],
    demo: true,
    name: true,
    sourceCode: true,
    description: true,
    tags: true
})

export type ProjectType = InputType<GraphQLTypes['Query'], typeof projectSelector>

export const skillSelector = Selector('Skill')({
    id: true,
    icon: [{}, { url: [{}, true] }],
    name: true
})

export type SkillType = InputType<GraphQLTypes['Query'], typeof skillSelector>

export const socialSelector = Selector('Social')({
    id: true,
    name: true,
    url: true,
    color: {
        hex: true
    },
    image: [{}, { url: [{}, true] }]
})

export type SocialType = InputType<GraphQLTypes['Query'], typeof socialSelector>
