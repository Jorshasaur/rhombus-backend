'use strict'
/**
 * New Relic agent configuration.
 *
 * See lib/config/default.js in the agent distribution for a more complete
 * description of configuration variables and their potential values.
 */
exports.config = {
    allow_all_headers: true,
    attributes: {
        /**
         * Prefix of attributes to exclude from all destinations. Allows * as wildcard
         * at end.
         *
         * NOTE: If excluding headers, they must be in camelCase form to be filtered.
         *
         * @env NEW_RELIC_ATTRIBUTES_EXCLUDE
         */
        exclude: [
            'request.headers.cookie',
            'request.headers.authorization',
            'request.headers.proxyAuthorization',
            'request.headers.setCookie*',
            'request.headers.x*',
            'response.headers.cookie',
            'response.headers.authorization',
            'response.headers.proxyAuthorization',
            'response.headers.setCookie*',
            'response.headers.x*'
        ]
    },
    distributed_tracing: {
        enabled: true
    },
    slow_sql: {
        enabled: true
    },
    transaction_tracer: {
        record_sql: 'obfuscated',
        explain_threshold: 250
    }
}
