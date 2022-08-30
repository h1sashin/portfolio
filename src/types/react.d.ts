import React from 'react'

type Children = {
    children: ReactElement<any, any>
}

declare module 'react' {
    type WithChildren<P = {}> = P extends void ? Children : P & Children
}
