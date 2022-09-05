import { AboutMeSection, ContactSection, HomeSection, PortfolioSection, Section } from 'components'
import type { NextPage } from 'next'
import ReactFullPage from '@fullpage/react-fullpage'

const Home: NextPage = () => {
    return (
        <ReactFullPage
            navigation
            easing="easeInOutCubic"
            keyboardScrolling
            licenseKey="123456789"
            render={() => (
                <>
                    <Section id="home">
                        <HomeSection />
                    </Section>
                    <Section id="portfolio">
                        <PortfolioSection />
                    </Section>
                    <Section id="about-me">
                        <AboutMeSection />
                    </Section>
                    <Section id="contact">
                        <ContactSection />
                    </Section>
                </>
            )}
        />
    )
}

export default Home
