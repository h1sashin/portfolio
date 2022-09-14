import '../styles/globals.css'
import { useEffect } from 'react'
import type { AppProps } from 'next/app'
import { Layout } from 'layouts'
import { NextPage } from 'next'
import { AnimatePresence } from 'framer-motion'
import TagManager from 'react-gtm-module'

const MyApp: NextPage<AppProps> = ({ Component, pageProps }) => {
    useEffect(() => {
        TagManager.initialize({
            gtmId: process.env.NEXT_PUBLIC_GTM_ID || 'G-RCRRMRVD7C'
        })
    }, [])
    return (
        <AnimatePresence>
            <Layout>
                <Component {...pageProps} />
            </Layout>
        </AnimatePresence>
    )
}

export default MyApp
