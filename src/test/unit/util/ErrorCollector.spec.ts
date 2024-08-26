import { newrelic, ErrorCollector } from '../../../util/ErrorCollector'
import bugsnag from '../../../bugsnag'

describe('ErrorCollector', () => {
    const errorString = 'test error'

    beforeAll(() => {
        bugsnag.notify = jest.fn()
        newrelic = jest.fn()
        newrelic.noticeError = jest.fn()
    })

    it('should not report to New Relic if it is a warning', () => {
        ErrorCollector.notify(errorString, { severity: 'warning' })
        expect(newrelic.noticeError).not.toHaveBeenCalled()
    })
    it('should report to New Relic', () => {
        ErrorCollector.notify(errorString, {})
        expect(newrelic.noticeError).not.toHaveBeenCalled()

        ErrorCollector.notify(errorString, { severity: 'error' })
        expect(newrelic.noticeError).toHaveBeenCalled()
    })
    it('always reports to Bugsnag', () => {
        ErrorCollector.notify(errorString, {})
        expect(bugsnag.notify).toHaveBeenCalledWith(errorString, {})

        ErrorCollector.notify(errorString, { severity: 'warning' })
        expect(bugsnag.notify).toHaveBeenCalledWith(errorString, {
            severity: 'warning'
        })

        ErrorCollector.notify(errorString, { severity: 'error' })
        expect(bugsnag.notify).toHaveBeenCalledWith(errorString, {
            severity: 'error'
        })
    })
})
