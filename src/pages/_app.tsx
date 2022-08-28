import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { Layout } from 'layouts'
import { NextPage } from 'next'

const MyApp: NextPage<AppProps> = ({ Component, pageProps }) => {
    return (
        <Layout>
            <Component {...pageProps} />
        </Layout>
    )
}

export default MyApp
