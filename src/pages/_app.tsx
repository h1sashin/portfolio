import '../styles/globals.css'
import { useEffect } from 'react'
import type { AppProps } from 'next/app'
import { Layout } from 'layouts'
import { NextPage } from 'next'
import { AnimatePresence } from 'framer-motion'

const MyApp: NextPage<AppProps> = ({ Component, pageProps }) => {
    return (
        <AnimatePresence>
            <Layout>
                <Component {...pageProps} />
            </Layout>
        </AnimatePresence>
    )
}

export default MyApp
