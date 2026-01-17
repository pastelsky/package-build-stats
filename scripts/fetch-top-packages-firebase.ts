import * as admin from 'firebase-admin'
import * as path from 'path'

// Initialize Firebase using the service account file
const serviceAccountPath = path.resolve(
  __dirname,
  'firebase-service-account.json',
)

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccountPath),
    databaseURL: 'https://module-cost.firebaseio.com', // From bundlephobia source
  })
  // console.log('Successfully initialized Firebase Admin.'); // Commented out to keep output clean
} catch (error) {
  console.error('Error initializing Firebase:', error)
  process.exit(1)
}

const db = admin.database()

async function getTopSearches() {
  // console.log('\nFetching top searches from "searches-v2"...'); // Commented out to keep output clean

  try {
    const ref = db.ref('searches-v2')

    // fetch top 5000 by count to ensure we have enough candidates after filtering
    const snapshot = await ref
      .orderByChild('count')
      .limitToLast(5000)
      .once('value')

    const searches: { name: string; count: number; lastSearched: number }[] = []

    snapshot.forEach(child => {
      const val = child.val()
      searches.push(val)
    })

    // Reverse to show highest first
    searches.reverse()

    // Filter for last 6 months
    const sixMonthsAgo = Date.now() - 6 * 30 * 24 * 60 * 60 * 1000
    const recentSearches = searches.filter(s => s.lastSearched > sixMonthsAgo)

    // Keep top 100
    const top100Recent = recentSearches.slice(0, 100)

    const formattedSearches = top100Recent.map(s => s.name)
    // Don't log anything else before this line if we want pure JSON output
    console.log(JSON.stringify(formattedSearches, null, 2))
  } catch (error) {
    console.error('Error fetching top searches:', error)
  }
}

async function main() {
  await getTopSearches()
  process.exit(0)
}

main().catch(console.error)
