import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const PATTERNS = [
  {
    name: 'Supabase publishable key',
    regex: /sb_publishable_[A-Za-z0-9._-]{20,}/g,
  },
  {
    name: 'Supabase service role key',
    regex: /service_role|sb_secret_[A-Za-z0-9._-]{20,}|SUPABASE_SERVICE_ROLE/gi,
  },
  {
    name: 'GitHub personal access token',
    regex: /ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}/g,
  },
  {
    name: 'AWS access key id',
    regex: /AKIA[0-9A-Z]{16}/g,
  },
  {
    name: 'Private key block',
    regex: /BEGIN (RSA|OPENSSH|EC|DSA) PRIVATE KEY/g,
  },
]

const ALLOWLIST_FILES = new Set([
  '.env.example',
])

function getTrackedFiles() {
  const output = execSync('git ls-files', { encoding: 'utf8' })
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function scanFile(path) {
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch {
    return []
  }

  const findings = []
  for (const pattern of PATTERNS) {
    const matches = text.match(pattern.regex)
    if (!matches || matches.length === 0) {
      continue
    }
    findings.push({
      path,
      type: pattern.name,
      count: matches.length,
    })
  }
  return findings
}

const files = getTrackedFiles()
const results = []

for (const file of files) {
  if (ALLOWLIST_FILES.has(file)) {
    continue
  }
  results.push(...scanFile(file))
}

if (results.length === 0) {
  console.log('security:scan passed, no obvious secrets found in tracked files.')
  process.exit(0)
}

console.error('security:scan found potential sensitive content:')
for (const item of results) {
  console.error(`- ${item.path}: ${item.type} x${item.count}`)
}
console.error('Please remove/rotate leaked keys before pushing.')
process.exit(1)
