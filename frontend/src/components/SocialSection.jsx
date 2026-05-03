import { useMemo, useState } from 'react'

const feedEntries = [
  { id: 'f1', user: 'Nadia', initials: 'NA', color: 'emerald', text: 'Won a 3+2 game with a clean bishop sacrifice.', time: '2m' },
  { id: 'f2', user: 'Ari', initials: 'AR', color: 'cyan', text: 'Started a study: Practical rook endgames.', time: '11m' },
  { id: 'f3', user: 'Dani', initials: 'DA', color: 'violet', text: 'Joined Weekend Arena.', time: '28m' }
]

const teams = [
  { id: 'tm1', name: 'CHESS Core Club', members: 324, forumPosts: 12, color: 'emerald' },
  { id: 'tm2', name: 'Rapid Warriors', members: 188, forumPosts: 8, color: 'amber' },
  { id: 'tm3', name: 'Tactics Daily', members: 561, forumPosts: 19, color: 'rose' }
]

const forums = [
  { id: 'fr1', title: 'Best anti-Sicilian lines for club players?', replies: 47, hot: true },
  { id: 'fr2', title: 'How to convert equal rook endgames?', replies: 23, hot: false },
  { id: 'fr3', title: 'Post your favorite attacking game this week', replies: 64, hot: true }
]

const accentMap = {
  emerald: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  cyan: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/20',
  violet: 'bg-violet-500/15 text-violet-300 border-violet-500/20',
  amber: 'bg-amber-500/15 text-amber-300 border-amber-500/20',
  rose: 'bg-rose-500/15 text-rose-300 border-rose-500/20'
}

function Avatar({ initials, color }) {
  return (
    <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${accentMap[color] || accentMap.emerald}`}>
      {initials}
    </div>
  )
}

function SocialSection() {
  const [postText, setPostText] = useState('')
  const [posts, setPosts] = useState(feedEntries)
  const onlineFriends = useMemo(() => 14, [])

  const publishPost = () => {
    const text = postText.trim()
    if (!text) return
    setPosts((cur) => [
      { id: `new-${Date.now()}`, user: 'You', initials: 'YO', color: 'cyan', text, time: 'now' },
      ...cur
    ])
    setPostText('')
  }

  return (
    <div className='space-y-4'>
      {/* Hero */}
      <div className='relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#1e1e1e]'>
        <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_0%_0%,rgba(99,102,241,0.12),transparent_60%)]' />
        <div className='pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_40%_60%_at_100%_100%,rgba(16,185,129,0.07),transparent_60%)]' />
        <div className='relative px-6 py-5 md:px-8'>
          <div className='flex flex-wrap items-center justify-between gap-4'>
            <div>
              <p className='text-[11px] font-bold uppercase tracking-[0.2em] text-indigo-400 mb-1'>Social</p>
              <h1 className='text-2xl font-bold text-white md:text-3xl'>Your Chess Community</h1>
              <p className='mt-1 text-sm text-slate-400'>Friends, clubs, and discussions — all in one place.</p>
            </div>
            <div className='flex items-center gap-2'>
              {/* Online friend avatars */}
              <div className='flex -space-x-2'>
                {['NA', 'AR', 'DA'].map((i) => (
                  <div key={i} className='flex h-7 w-7 items-center justify-center rounded-full border-2 border-[#1e1e1e] bg-[#252526] text-[9px] font-bold text-slate-300'>
                    {i}
                  </div>
                ))}
              </div>
              <span className='flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-300'>
                <span className='h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse' />
                {onlineFriends} online
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className='grid grid-cols-1 gap-4 xl:grid-cols-12'>
        {/* Main feed */}
        <section className='space-y-4 xl:col-span-8'>
          {/* Post composer */}
          <div className='rounded-2xl border border-white/[0.08] bg-[#1e1e1e] p-4'>
            <p className='mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-500'>Share with your circle</p>
            <div className='flex gap-2'>
              <input
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && publishPost()}
                placeholder='What happened in your last game?'
                className='h-10 flex-1 rounded-xl border border-white/[0.08] bg-[#252526] px-4 text-sm text-slate-100 placeholder:text-slate-600 focus:border-indigo-400/40 focus:outline-none transition'
              />
              <button
                onClick={publishPost}
                className='rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 text-sm font-bold text-white transition hover:brightness-110 active:scale-95'
              >
                Post
              </button>
            </div>
          </div>

          {/* Activity feed */}
          <div className='rounded-2xl border border-white/[0.08] bg-[#1e1e1e] p-4'>
            <div className='mb-4 flex items-center justify-between'>
              <h2 className='text-base font-bold text-white'>Activity Feed</h2>
              <span className='text-[11px] text-slate-600'>{posts.length} updates</span>
            </div>
            <div className='space-y-2'>
              {posts.map((entry) => (
                <div key={entry.id} className='flex items-start gap-3 rounded-xl border border-white/[0.06] bg-[#252526] px-4 py-3 transition hover:border-white/10'>
                  <Avatar initials={entry.initials} color={entry.color} />
                  <div className='min-w-0 flex-1'>
                    <p className='text-sm text-slate-200'>
                      <span className='font-semibold text-white'>{entry.user}</span>{' '}
                      <span className='text-slate-400'>{entry.text}</span>
                    </p>
                  </div>
                  <span className='shrink-0 rounded-full bg-[#2d2d30] px-2 py-0.5 text-[10px] text-slate-500'>{entry.time}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Sidebar */}
        <aside className='space-y-4 xl:col-span-4'>
          {/* Teams */}
          <section className='rounded-2xl border border-white/[0.08] bg-[#1e1e1e] p-4'>
            <div className='mb-3 flex items-center justify-between'>
              <h3 className='text-base font-bold text-white'>Teams</h3>
              <span className='text-[11px] text-slate-600'>{teams.length} clubs</span>
            </div>
            <div className='space-y-2'>
              {teams.map((team) => (
                <div key={team.id} className={`flex items-center gap-3 rounded-xl border bg-[#252526] px-3 py-2.5 transition hover:border-white/15 ${accentMap[team.color]?.replace('bg-', 'border-l-2 border-l-').split(' border ')[0]} border-white/[0.06]`}>
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border text-[10px] font-black ${accentMap[team.color]}`}>
                    {team.name.charAt(0)}
                  </div>
                  <div className='min-w-0 flex-1'>
                    <p className='truncate text-sm font-semibold text-slate-100'>{team.name}</p>
                    <p className='text-[11px] text-slate-500'>{team.members} members · {team.forumPosts} threads</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Forum Hot Topics */}
          <section className='rounded-2xl border border-white/[0.08] bg-[#1e1e1e] p-4'>
            <div className='mb-3 flex items-center justify-between'>
              <h3 className='text-base font-bold text-white'>Hot Topics</h3>
              <span className='text-[10px] font-bold uppercase tracking-wide text-rose-400'>Forum</span>
            </div>
            <div className='space-y-2'>
              {forums.map((thread) => (
                <div key={thread.id} className='group cursor-pointer rounded-xl border border-white/[0.06] bg-[#252526] px-3 py-2.5 transition hover:border-white/12'>
                  <div className='flex items-start justify-between gap-2'>
                    <p className='text-sm text-slate-200 leading-snug group-hover:text-white transition'>{thread.title}</p>
                    <div className='flex shrink-0 flex-col items-end gap-1'>
                      <span className='rounded-full bg-[#2d2d30] px-2 py-0.5 text-[10px] font-semibold text-slate-400'>{thread.replies}</span>
                      {thread.hot && <span className='text-[9px] font-bold text-rose-400'>🔥 Hot</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

export default SocialSection
