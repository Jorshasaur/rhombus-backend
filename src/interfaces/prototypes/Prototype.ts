import { Device } from './Device'

export interface Prototype {
    id: number
    hash: string
    userID: number
    companyID: number
    name: string
    homeScreenID: number
    sortTypeId: number
    mobileDeviceID: number
    isSample: boolean
    isMobile: boolean
    isArchived: boolean
    isOverQuota: boolean
    isInGracePeriod: boolean
    isAdvanced: boolean
    isSnap: boolean
    defaultBackgroundColor: string
    defaultBackgroundImageID: number
    defaultBackgroundImagePosition: string
    defaultBackgroundAutostretch: boolean
    defaultBackgroundFrame: boolean
    defaultAlignment: string
    defaultZoomScrollBehavior: number
    lastAccessedAt: string
    mobileStatusbarIsVisible: boolean
    mobileStatusbarIsOpaque: boolean
    mobileStatusbarBackgroundColor: string
    mobileStatusbarFontColor: string
    cdnKey: string
    isProcessed: boolean
    createdAt: string
    updatedAt: string
    defaultWidth?: number
    defaultHeight?: number
    presetSlug?: string
    homeScreenURL: string
    easings?: {
        lastID: number
    }
    homeScreenAssetURL: string
    mobileDevice: Device
}
