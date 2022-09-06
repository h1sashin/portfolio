import { AboutMeSection, ContactSection, HeroSection, PortfolioSection } from 'components'
import type { GetStaticProps, NextPage } from 'next'
import { LandingProps } from 'types/global'

const Home: NextPage<LandingProps> = ({ aboutMe, portfolio, seo, skills }) => {
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
    await (await fetch(process.env.VERCEL_URL + '/api/getCmsData')).json()

export default Home
