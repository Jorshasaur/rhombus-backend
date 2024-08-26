jest.mock('../../config', () => {
    return {
        bugsnagEnabled: true
    }
})
import bs from '../../bugsnag'
const Bugsnag = require('@bugsnag/js')

describe('bugsnag helper', () => {
    it('should clear out personal identifiable information from logging', () => {
        Bugsnag.start({ apiKey: process.env.BUGSNAG_KEY })
        const req = {
            invision: {
                user: {
                    name: 'Username',
                    email: 'username@user.com',
                    userId: 120394
                }
            }
        }
        Bugsnag.notify = jest.fn()
        bs.notify('Test error', { req })
        expect(Bugsnag.notify).toHaveBeenCalledWith(
            'Test error',
            expect.any(Function)
        )
    })
})
