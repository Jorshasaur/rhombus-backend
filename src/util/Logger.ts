import * as pino from 'pino'
import { Config } from '../config'

/**
 * The Logger class is just currently a Typescript friendly wrapper for the
 * InvisionLogger.  It also makes it easier to stub for unit testing.
 *
 * If you want to shut up individual logs, using sinon just stub out the prototype methods:
 *      sinon.stub(Logger, "error")
 *
 */
export const Logger = pino({
    name: Config.serviceName,
    level: Config.logLevel,

    // Pretty-print output for development and our test suite.
    prettyPrint: Config.prettyLogging && {
        ignore: 'hostname,name,pid',
        translateTime: 'SYS:h:MM tt'
    }
})
export type Logger = pino.Logger
