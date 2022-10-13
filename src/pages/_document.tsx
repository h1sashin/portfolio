import { DocumentType } from 'next/dist/shared/lib/utils'
import { Html, Head, Main, NextScript } from 'next/document'

const Document: DocumentType = () => {
    return (
        <Html lang="en" className="bg-black">
            <Head>
                <link rel="icon" type="image/x-icon" href="/images/favicon.ico" />
                <link rel="apple-touch-icon" href="/images/apple-touch-icon.png" />
                <meta name="theme-color" content="#353e48" />
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="true" />
                <link href="https://fonts.googleapis.com/css2?family=Didact+Gothic&display=swap" rel="stylesheet" />
            </Head>
            <body className="bg-black">
                <Main />
                <NextScript />
            </body>
        </Html>
    )
}

export default Document
