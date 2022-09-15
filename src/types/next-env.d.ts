/// <reference types="next" />
/// <reference types="next/image-types/global" />

declare namespace NodeJS {
    interface ProcessEnv {
        HOST: string
        CMS_TOKEN: string
        NEXT_PUBLIC_GTM_ID: string
    }
}
