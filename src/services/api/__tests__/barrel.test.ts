import { describe, it, expect } from 'vitest'
import * as db from '../../database'

describe('database barrel re-exports', () => {
    const expectedServices = [
        'leagueService', 'seasonService', 'teamService', 'playerService',
        'standingsService', 'transactionService', 'profileService', 'globalPlayerService',
        'godService', 'godpoolService', 'bannedContentService',
        'matchService', 'statsService',
        'passionService', 'coinflipService', 'smiterunnerService', 'challengeService', 'emberService',
        'codexService',
        'forgeService', 'referralService', 'predictionsService',
        'orgService', 'scrimService', 'inhouseService', 'communityTeamService', 'adminCommunityService',
        'siteConfigService', 'featuredStreamerService', 'feedbackService', 'tierlistFeedService', 'arcadeNpcService',
        'cardclashService', 'cardclashAdminService',
    ]

    const expectedHelpers = [
        'setImpersonation', 'clearImpersonation', 'getImpersonation',
    ]

    it('exports all service objects', () => {
        for (const name of expectedServices) {
            expect(db).toHaveProperty(name)
            expect(typeof (db as any)[name]).toBe('object')
        }
    })

    it('exports impersonation helpers', () => {
        for (const name of expectedHelpers) {
            expect(db).toHaveProperty(name)
            expect(typeof (db as any)[name]).toBe('function')
        }
    })

    it('each service has at least one method', () => {
        for (const name of expectedServices) {
            const service = (db as any)[name]
            const methods = Object.keys(service).filter(k => typeof service[k] === 'function')
            expect(methods.length).toBeGreaterThan(0)
        }
    })

    it('total export count matches expected', () => {
        const allExports = Object.keys(db)
        expect(allExports.length).toBe(expectedServices.length + expectedHelpers.length)
    })
})
