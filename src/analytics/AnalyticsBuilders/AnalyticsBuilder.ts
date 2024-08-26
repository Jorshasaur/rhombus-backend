import analytics from '../analytics'

interface EventProperties {
    [key: string]: any
}

export default abstract class AnalyticsBuilder {
    protected abstract eventName: string

    private _properties: EventProperties = {}
    private _vendorId: string
    private _teamId: string
    private _userId: number
    private _documentId: string

    constructor(
        vendorId: string,
        userId: number,
        documentId: string,
        teamId: string
    ) {
        this._vendorId = vendorId
        this._userId = userId
        this._documentId = documentId
        this._teamId = teamId
    }

    withProperty(key: string, value: any) {
        this._properties[key] = value
        return this
    }

    track() {
        analytics.track(
            this.eventName,
            this._userId,
            this._documentId,
            this._vendorId,
            this._teamId,
            this._properties
        )
    }

    public getEventName() {
        return this.eventName
    }

    public readProperties() {
        return Object.assign({}, this._properties)
    }
}
