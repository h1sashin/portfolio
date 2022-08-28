import { HomeSection, Section } from 'components'
import { getPagesMetadata } from 'lib/chain'
import type { GetStaticProps, NextPage } from 'next'

const Home: NextPage = () => {
    return (
        <div className="">
            <Section>
                <HomeSection />
            </Section>
        </div>
    )
}

export default Home
