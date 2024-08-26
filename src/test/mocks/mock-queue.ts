export default class mockQueue {
    add = jest.fn()
    toKey = jest.fn((key: string) => {
        return key
    })
    isReady = jest.fn(() => {
        return Promise.resolve(this)
    })
    client = {
        takeLock: jest.fn(() => {
            return Promise.resolve(1)
        }),
        releaseLock: jest.fn(() => {
            return Promise.resolve(1)
        })
    }
    token = 'queuetoken'
    settings = {
        lockDuration: 10
    }
    getJob = jest.fn(() => {
        return this.job
    })

    constructor(public job: any = null) {}
}
