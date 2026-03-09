// src/services/database.js — barrel re-export
// All services are split into domain-specific modules under ./api/

export { setImpersonation, clearImpersonation, getImpersonation } from './api/core'

export {
    leagueService, seasonService, teamService, playerService,
    standingsService, transactionService, profileService, globalPlayerService,
    godService, godpoolService, bannedContentService,
} from './api/league'

export { matchService, statsService } from './api/matches'

export {
    passionService, coinflipService, smiterunnerService,
    challengeService, emberService,
} from './api/passion'

export { codexService } from './api/codex'

export { forgeService, referralService, predictionsService } from './api/forge'

export {
    orgService, scrimService, inhouseService,
    communityTeamService, adminCommunityService,
} from './api/community'

export {
    siteConfigService, featuredStreamerService,
    feedbackService, tierlistFeedService, arcadeNpcService,
} from './api/content'

export { cardclashService, cardclashAdminService } from './api/cardclash'
