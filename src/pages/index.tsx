import { AboutMeSection, ContactSection, HeroSection, PortfolioSection } from 'components'
import type { NextPage } from 'next'

const Home: NextPage = () => {
    return (
        <div>
            <HeroSection />
            <PortfolioSection />
            <AboutMeSection />
            <ContactSection />
        </div>
    )
}

export default Home
