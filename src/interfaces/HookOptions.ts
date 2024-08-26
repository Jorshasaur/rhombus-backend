import { Transaction } from 'sequelize'

export interface HookOptions {
    transaction?: Transaction
    hooks: boolean
    validate: boolean
    returning: boolean
    fields: string[]
    defaultFields: string[]
}
