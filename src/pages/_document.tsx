import { DocumentType } from 'next/dist/shared/lib/utils'
import { Html, Head, Main, NextScript } from 'next/document'

const Document: DocumentType = () => {
    return (
        <Html lang="en" className="bg-black">
            <Head>
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
