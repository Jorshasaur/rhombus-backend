import { Response, NextFunction } from 'express'

export default function TeamIdParam(
    req: any,
    res: Response,
    next: NextFunction
) {
    req.invision = {
        user: {
            teamId: req.params.teamId
        }
    }
    next()
}
