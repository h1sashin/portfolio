import { AboutMeSection, ContactSection, HeroSection, PortfolioSection } from 'components'
import type { GetStaticProps, NextPage } from 'next'
import { LandingProps } from 'types/global'

const Home: NextPage<LandingProps> = ({ aboutMe, portfolio, seo, skills }) => {
    console.log(
        process.env.NEXT_PUBLIC_VERCEL_URL,
        process.env.VERCEL_URL,
        process.env.CMS_TOKEN,
        process.env.NEXT_PUBLIC_URL
    )
    return (
        <div>
            <HeroSection links={aboutMe.links} company={aboutMe.company} />
            <PortfolioSection portfolio={portfolio.slice(0, 6)} />
            <AboutMeSection aboutMe={aboutMe} skills={skills} />
            <ContactSection />
        </div>
    )
}

export const getStaticProps: GetStaticProps<LandingProps> = async () =>
    await (await fetch(process.env.NEXT_PUBLIC_VERCEL_URL + '/api/getCmsData')).json()

export default Home
