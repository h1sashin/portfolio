import { getAboutMe, getProjects, getSeo, getSkillCategories } from 'pages/api/chain'
import { NextApiRequest, NextApiResponse } from 'next'
import { LandingProps } from 'types/global'

export default async (_: NextApiRequest, res: NextApiResponse<{ props: LandingProps }>) =>
    res.status(200).json({
        props: {
            portfolio: (await getProjects()).projects,
            seo: (await getSeo()).seos[0],
            aboutMe: (await getAboutMe()).aboutMes[0],
            skills: (await getSkillCategories()).skillCategories
        }
    })
