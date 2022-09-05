import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { Layout } from 'layouts'
import { NextPage } from 'next'
import { AnimatePresence } from 'framer-motion'

const MyApp: NextPage<AppProps> = ({ Component, pageProps }) => {
    return (
        <Layout>
            <AnimatePresence exitBeforeEnter>
                <Component {...pageProps} />
            </AnimatePresence>
        </Layout>
    )
}

export default MyApp
