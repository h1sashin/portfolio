import { Html, Head, Main, NextScript } from 'next/document'

const Document = () => {
    return (
        <Html lang="en">
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
