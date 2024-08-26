import { Logger } from './Logger'
import { Config } from '../config'
import { Sequelize } from 'sequelize-typescript'
import { createHash } from 'crypto'
import { Transaction } from 'sequelize'

export default class SequelizeManager {
    private logger: Logger

    public sequelize: Sequelize

    public static instance: SequelizeManager

    private constructor() {
        this.logger = Logger
    }

    public static getInstance() {
        if (this.instance === null || this.instance === undefined) {
            this.instance = new SequelizeManager()
        }
        return this.instance
    }

    public init() {
        this.sequelize = new Sequelize({
            host: Config.pg.host as string,
            port: Config.pg.port as number,
            database: Config.pg.database as string,
            dialect: 'postgres',
            username: Config.pg.user as string,
            password: Config.pg.password as string,
            logging: false,
            pool: {
                max: Config.pg.poolSize as number,
                min: Config.pg.poolMin as number
            },
            dialectOptions: {
                statement_timeout: Config.pg.timeout
            },
            modelPaths: [__dirname + '/../models']
        })
    }

    public async initAsWorker(callback: Function): Promise<any> {
        this.sequelize = new Sequelize({
            host: Config.pg.host as string,
            port: Config.pg.port as number,
            database: Config.pg.database as string,
            dialect: 'postgres',
            username: Config.pg.user as string,
            password: Config.pg.password as string,
            logging: false,
            pool: {
                max: Config.pg.workerPoolSize as number,
                min: Config.pg.workerPollMinSize as number
            },
            dialectOptions: {
                statement_timeout: Config.pg.workerTimeout
            },
            modelPaths: [__dirname + '/../models']
        })

        try {
            return await callback()
        } finally {
            // this finally block will complete after awaiting the callback
            // even though we are returning the promise in the try block.
            this.sequelize.close()
        }
    }

    public async createAdvisoryLock(
        lockName: string,
        transaction: Transaction
    ) {
        this.logger.info('advisory lock!')
        const key = this.strToKey(lockName)
        this.logger.debug(`Creating advisory lock for ${key[0]}, ${key[1]}`)
        await this.sequelize.query(
            `SELECT pg_advisory_xact_lock(${key[0]}, ${key[1]})`,
            { transaction: transaction }
        )
    }

    private strToKey(name: string): Array<number> {
        const buf = createHash('sha256')
            .update(name)
            .digest()
        return [buf.readInt32LE(0), buf.readInt32LE(4)]
    }
}
