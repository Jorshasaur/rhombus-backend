export interface Share {
    id: number
    teamID: string
    userID: number
    prototypeID: number
    screenID: number
    selectedScreens: number[]
    password: string
    key: string
    liveshareConferenceID: string
    mobileDeviceID: number
    isCommentingAllowed: boolean
    isNavigateAllowed: boolean
    isResizeWindow: boolean
    isLoadAllScreens: boolean
    isUserTesting: boolean
    isAnonymousViewingAllowed: boolean
    isForceAddToHomescreenOnMobile: boolean
    isLiveShare: boolean
    isEmbed: boolean
    shareURL: string
    mobileShareURL: string
}
