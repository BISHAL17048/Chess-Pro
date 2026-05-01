import { useMemo, useState } from 'react'

const feedEntries = [
  { id: 'f1', user: 'Nadia', text: 'Won a 3+2 game with a clean bishop sacrifice.', time: '2m' },
  { id: 'f2', user: 'Ari', text: 'Started a study: Practical rook endgames.', time: '11m' },
  { id: 'f3', user: 'Dani', text: 'Joined Weekend Arena.', time: '28m' }
]

const teams = [
  { id: 'tm1', name: 'CHESS Core Club', members: 324, forumPosts: 12 },
  { id: 'tm2', name: 'Rapid Warriors', members: 188, forumPosts: 8 },
  { id: 'tm3', name: 'Tactics Daily', members: 561, forumPosts: 19 }
]

const forums = [
  { id: 'fr1', title: 'Best anti-Sicilian lines for club players?', replies: 47 },
  { id: 'fr2', title: 'How to convert equal rook endgames?', replies: 23 },
  { id: 'fr3', title: 'Post your favorite attacking game this week', replies: 64 }
]

function SocialSection() {
  const [postText, setPostText] = useState('')
  const [posts, setPosts] = useState(feedEntries)

  const onlineFriends = useMemo(() => 14, [])

  const publishPost = () => {
    const text = postText.trim()
    if (!text) return

    setPosts((current) => [
      { id: `new-${Date.now()}`, user: 'You', text, time: 'now' },
      ...current
    ])
    setPostText('')
  }

  return (
    <div className='grid grid-cols-1 gap-4 xl:grid-cols-12'>
      <section className='space-y-4 xl:col-span-8'>
        <div className='rounded-2xl border border-white/10 bg-[#252526]/85 p-5 backdrop-blur'>
          <div className='mb-3 flex items-center justify-between'>
            <div>
              <h2 className='text-xl font-semibold text-white'>Social</h2>
              <p className='text-sm text-slate-400'>Friends, clubs, and discussion in one place.</p>
            </div>
            <span className='rounded bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300'>
              {onlineFriends} online
            </span>
          </div>

          <div className='flex gap-2'>
            <input
              value={postText}
              onChange={(e) => setPostText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && publishPost()}
              placeholder='Share an update with your chess circle...'
              className='h-10 flex-1 rounded-lg border border-white/10 bg-[#2d2d30] px-3 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none'
            />
            <button
              onClick={publishPost}
              className='rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-4 text-sm font-semibold text-white transition hover:brightness-110'
            >
              Post
            </button>
          </div>
        </div>

        <div className='rounded-2xl border border-white/10 bg-[#252526]/85 p-5 backdrop-blur'>
          <h3 className='mb-3 text-lg font-semibold text-white'>Activity Feed</h3>
          <div className='space-y-2'>
            {posts.map((entry) => (
              <div key={entry.id} className='rounded-lg bg-[#2d2d30] px-3 py-2'>
                <p className='text-sm text-slate-100'>
                  <span className='font-semibold text-white'>{entry.user}</span>: {entry.text}
                </p>
                <p className='text-[11px] text-slate-500'>{entry.time}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <aside className='space-y-4 xl:col-span-4'>
        <section className='rounded-2xl border border-white/10 bg-[#252526]/85 p-5 backdrop-blur'>
          <h3 className='mb-3 text-lg font-semibold text-white'>Teams</h3>
          <div className='space-y-2'>
            {teams.map((team) => (
              <div key={team.id} className='rounded-lg bg-[#2d2d30] px-3 py-2'>
                <p className='text-sm font-semibold text-slate-100'>{team.name}</p>
                <p className='text-xs text-slate-400'>{team.members} members • {team.forumPosts} active threads</p>
              </div>
            ))}
          </div>
        </section>

        <section className='rounded-2xl border border-white/10 bg-[#252526]/85 p-5 backdrop-blur'>
          <h3 className='mb-3 text-lg font-semibold text-white'>Forum Hot Topics</h3>
          <div className='space-y-2'>
            {forums.map((thread) => (
              <div key={thread.id} className='rounded-lg bg-[#2d2d30] px-3 py-2'>
                <p className='text-sm text-slate-100'>{thread.title}</p>
                <p className='text-xs text-slate-400'>{thread.replies} replies</p>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  )
}

export default SocialSection
