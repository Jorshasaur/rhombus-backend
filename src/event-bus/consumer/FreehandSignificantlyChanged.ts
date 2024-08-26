export const FREEHAND_SIGNIFICANTLY_CHANGED =
    'freehand_api.significantly_changed'

export interface FreehandSignificantlyChanged {
    type: typeof FREEHAND_SIGNIFICANTLY_CHANGED
    data: {
        team_id: string
        document_id: number
    }
}
