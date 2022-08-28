/// <reference types="next" />
/// <reference types="next/image-types/global" />

declare namespace NodeJS {
    interface ProcessEnv {
        NEXT_PUBLIC_HOST: string
        NEXT_PUBLIC_CMS_TOKEN: string
    }
}
