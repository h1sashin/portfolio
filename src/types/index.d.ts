import { DataLayerArgs } from 'react-gtm-module'
class DataLayer {
    push(args: {
        event: string
        eventProps?: {
            [key: string]: string | number | boolean
        }
        gtm?: { uniqueEventId: string | number }
    }): void
}
declare global {
    interface Window {
        dataLayer: DataLayer
    }
}
