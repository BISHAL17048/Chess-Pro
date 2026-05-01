import { useEffect, useState } from 'react'
import { fetchLichessVideos } from '../utils/lichessApi'

function WatchVideos() {
  const [videos, setVideos] = useState([])
  const [videosLoading, setVideosLoading] = useState(false)
  const [videosError, setVideosError] = useState('')
  const [selectedVideo, setSelectedVideo] = useState(null)

  const loadVideoLibrary = async () => {
    setVideosLoading(true)
    setVideosError('')

    try {
      const payload = await fetchLichessVideos({ max: 180, pages: 5 })
      const rows = Array.isArray(payload?.videos) ? payload.videos : []
      setVideos(rows)
      setSelectedVideo((prev) => {
        if (prev?.id && rows.some((row) => row.id === prev.id)) return prev
        return rows[0] || null
      })
    } catch (error) {
      setVideos([])
      setSelectedVideo(null)
      setVideosError(error?.message || 'Failed to load chess videos')
    } finally {
      setVideosLoading(false)
    }
  }

  useEffect(() => {
    loadVideoLibrary()
  }, [])

  return (
    <section className='space-y-4 rounded-2xl border border-white/10 bg-[#252526] p-4 text-slate-200 shadow-[0_20px_50px_rgba(0,0,0,.35)]'>
      <div className='flex flex-wrap items-center justify-between gap-2'>
        <div>
          <h2 className='text-lg font-semibold text-white'>Chess Videos</h2>
          <p className='text-xs text-slate-400'>Imported from a curated external video library for on-platform study.</p>
        </div>
        <button
          onClick={loadVideoLibrary}
          disabled={videosLoading}
          className='rounded border border-white/15 px-3 py-1.5 text-xs text-slate-200 transition hover:border-cyan-300/60 hover:bg-cyan-400/10 disabled:cursor-not-allowed disabled:opacity-50'
        >
          {videosLoading ? 'Importing...' : 'Refresh Library'}
        </button>
      </div>

      {videosError ? <p className='rounded bg-red-500/10 px-3 py-2 text-xs text-red-300'>{videosError}</p> : null}

      {selectedVideo?.embedUrl ? (
        <div className='overflow-hidden rounded-lg border border-white/10 bg-[#151515]'>
          <iframe
            title={`Video ${selectedVideo.id}`}
            src={selectedVideo.embedUrl}
            className='h-[280px] w-full sm:h-[360px]'
            allow='autoplay; encrypted-media; picture-in-picture; fullscreen'
            loading='lazy'
          />
          <div className='border-t border-white/10 bg-[#1a1a1a] px-3 py-2'>
            <p className='text-sm font-semibold text-white'>{selectedVideo.title}</p>
            <p className='text-xs text-slate-400'>
              {selectedVideo.level || 'All Levels'}
              <a
                href={selectedVideo.lichessUrl}
                target='_blank'
                rel='noreferrer'
                className='ml-3 text-cyan-300 underline decoration-dotted'
              >
                Open Source Page
              </a>
            </p>
          </div>
        </div>
      ) : (
        <p className='rounded bg-[#1f1f1f] px-3 py-2 text-xs text-slate-400'>
          {videosLoading ? 'Importing videos from external source...' : 'No video selected yet.'}
        </p>
      )}

      <div className='max-h-[420px] space-y-2 overflow-auto pr-1 text-xs text-slate-300'>
        {!videosLoading && videos.length === 0 && (
          <p className='text-slate-400'>No videos imported yet. Use Refresh Library.</p>
        )}

        {videos.map((video) => (
          <button
            key={video.id}
            onClick={() => setSelectedVideo(video)}
            className={`w-full rounded-lg border px-3 py-2 text-left transition ${selectedVideo?.id === video.id ? 'border-cyan-300/70 bg-cyan-500/15' : 'border-white/10 bg-[#2d2d30] hover:border-white/25'}`}
          >
            <p className='font-semibold text-white'>{video.title}</p>
            <p className='text-slate-400'>Level: {video.level || 'All Levels'} • ID: {video.id}</p>
          </button>
        ))}
      </div>
    </section>
  )
}

export default WatchVideos
