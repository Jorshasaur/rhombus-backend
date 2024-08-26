import AnalyticsBuilder from './AnalyticsBuilder'

const DOCUMENT_SESSION = {
    event: 'App.Rhombus.EditSessionStarted',
    properties: {
        numberOfEdits: {
            name: 'numberOfEdits'
        },
        numberOfDeletes: {
            name: 'numberOfDeletes'
        },
        sessionStart: {
            name: 'sessionStart'
        },
        sessionEnd: {
            name: 'sessionEnd'
        },
        sessionTimeoutInSeconds: {
            name: 'sessionTimeoutInSeconds'
        }
    }
}

export default class DocumentSessionAnalytics extends AnalyticsBuilder {
    protected eventName: string = DOCUMENT_SESSION.event

    constructor(
        vendorId: string,
        userId: number,
        documentId: string,
        teamId: string
    ) {
        super(vendorId, userId, documentId, teamId)
    }

    public numberOfEdits = (num: number = 0) =>
        this.withProperty(DOCUMENT_SESSION.properties.numberOfEdits.name, num)

    public numberOfDeletes = (num: number = 0) =>
        this.withProperty(DOCUMENT_SESSION.properties.numberOfDeletes.name, num)

    public sessionStart = (date: Date) =>
        this.withProperty(DOCUMENT_SESSION.properties.sessionStart.name, date)

    public sessionEnd = (date: Date) =>
        this.withProperty(DOCUMENT_SESSION.properties.sessionEnd.name, date)

    public sessionTimeoutInSeconds = (num: number = 3600) =>
        this.withProperty(
            DOCUMENT_SESSION.properties.sessionTimeoutInSeconds.name,
            num
        )
}
