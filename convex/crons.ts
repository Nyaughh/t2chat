import { cronJobs } from 'convex/server'
import { internal } from './_generated/api'

const crons = cronJobs()

// Reset credits for free users every day at midnight UTC
crons.cron('reset-credits', '0 0 * * *', internal.users.resetCredits)

export default crons 