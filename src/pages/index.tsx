import { getAboutMe, getProjects, getSeo, getSkillCategories } from 'chain'
import { AboutMeSection, ContactSection, HeroSection, PortfolioSection } from 'components'
import type { GetStaticProps, NextPage } from 'next'
import Head from 'next/head'
import { LandingProps } from 'types/global'

const Home: NextPage<LandingProps> = ({ aboutMe, portfolio, seo, skills }) => {
    return (
        <>
            <Head>
                <title>{seo.title}</title>
                <meta name="og:title" content={seo.title} />
                <meta name="twitter:title" content={seo.title} />

                <meta name="description" content={seo.description} />
                <meta name="og:description" content={seo.description} />
                <meta name="twitter:description" content={seo.description} />

                <meta name="keywords" content={seo.keywords.join(',')} />
                <meta name="og:keywords" content={seo.keywords.join(',')} />
                <meta name="twitter:keywords" content={seo.keywords.join(',')} />

                <meta name="og:image" content={seo.og_image?.url} />
                <meta name="twitter:image" content={seo.og_image?.url} />
                <meta name="twitter:card" content="summary_large_image" />

                <meta name="twitter:site" content="@szemborowski" />
                <meta name="twitter:creator" content="@szemborowski" />
                <meta name="og:site_name" content={seo.title} />
                <meta name="og:type" content="website" />
                <meta name="og:locale" content="en_US" />
                <meta name="og:url" content="https://szemborowski.com" />
            </Head>
            <HeroSection links={aboutMe.links} company={aboutMe.company} />
            <PortfolioSection portfolio={portfolio.slice(0, 6)} />
            <AboutMeSection aboutMe={aboutMe} skills={skills} />
            <ContactSection />
        </>
    )
}

export const getStaticProps: GetStaticProps<LandingProps> = async () => ({
    props: {
        portfolio: (await getProjects()).projects,
        seo: (await getSeo()).seos[0],
        aboutMe: (await getAboutMe()).aboutMes[0],
        skills: (await getSkillCategories()).skillCategories
    }
})

export default Home
