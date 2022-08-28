import React from 'react'

type PropsWithChildren<P = {}> = P & {
    children: React.ReactElement<any, any>
}

declare module 'react' {
    interface FCC<P = {}> {
        (props: PropsWithChildren<P>, context?: any): ReactElement<any, any> | null
    }
}
