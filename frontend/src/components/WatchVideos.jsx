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
    <div className='grid grid-cols-1 gap-4 lg:grid-cols-12'>
      {/* Video Player Section */}
      <section className='rounded-2xl border border-white/[0.08] bg-[#1e1e1e] p-4 md:p-5 lg:col-span-8'>
        <div className='mb-4 flex flex-wrap items-center justify-between gap-2'>
          <div>
            <h2 className='text-lg font-bold text-white'>Featured Video</h2>
            <p className='text-[11px] text-slate-500'>Curated from external libraries</p>
          </div>
          <button
            onClick={loadVideoLibrary}
            disabled={videosLoading}
            className='flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] font-bold text-amber-300 transition hover:bg-amber-500/20 disabled:opacity-50'
          >
            {videosLoading ? 'Refreshing...' : 'Refresh Library'}
          </button>
        </div>

        {videosError ? <p className='mb-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs text-red-300'>{videosError}</p> : null}

        {selectedVideo?.embedUrl ? (
          <div className='overflow-hidden rounded-xl border border-white/[0.08] bg-black'>
            <iframe
              title={`Video ${selectedVideo.id}`}
              src={selectedVideo.embedUrl}
              className='h-[280px] w-full sm:h-[400px] lg:h-[450px]'
              allow='autoplay; encrypted-media; picture-in-picture; fullscreen'
              loading='lazy'
            />
            <div className='border-t border-white/[0.08] bg-[#252526] px-5 py-4'>
              <div className='flex items-start justify-between gap-4'>
                <div>
                  <p className='text-base font-bold text-white'>{selectedVideo.title}</p>
                  <p className='mt-1 flex items-center gap-2 text-[11px] text-slate-400'>
                    <span className='rounded border border-white/5 bg-[#1e1e1e] px-2 py-0.5'>{selectedVideo.level || 'All Levels'}</span>
                    <span>ID: {selectedVideo.id}</span>
                  </p>
                </div>
                <a
                  href={selectedVideo.lichessUrl}
                  target='_blank'
                  rel='noreferrer'
                  className='shrink-0 rounded-lg border border-white/10 bg-[#1e1e1e] px-3 py-1.5 text-[11px] font-semibold text-slate-300 transition hover:border-white/20 hover:text-white'
                >
                  Watch on Lichess ↗
                </a>
              </div>
            </div>
          </div>
        ) : (
          <div className='flex h-[360px] items-center justify-center rounded-xl border border-dashed border-white/[0.08] bg-[#252526]/50'>
            <p className='text-sm text-slate-500'>
              {videosLoading ? 'Loading video library...' : 'No video selected'}
            </p>
          </div>
        )}
      </section>

      {/* Playlist Section */}
      <section className='flex max-h-[600px] flex-col rounded-2xl border border-white/[0.08] bg-[#1e1e1e] p-4 md:p-5 lg:col-span-4'>
        <div className='mb-4'>
          <h2 className='text-base font-bold text-white'>Video Library</h2>
          <p className='text-[11px] text-slate-500'>{videos.length} videos available</p>
        </div>

        <div className='flex-1 space-y-2 overflow-y-auto pr-2'>
          {!videosLoading && videos.length === 0 && (
            <p className='py-8 text-center text-sm text-slate-500'>Library is empty.</p>
          )}

          {videos.map((video) => (
            <button
              key={video.id}
              onClick={() => setSelectedVideo(video)}
              className={`flex w-full flex-col items-start gap-1.5 rounded-xl border px-4 py-3 text-left transition-all ${
                selectedVideo?.id === video.id
                  ? 'border-amber-500/40 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.05)]'
                  : 'border-white/[0.06] bg-[#252526] hover:-translate-y-0.5 hover:border-white/15'
              }`}
            >
              <p className={`text-sm font-semibold leading-tight ${selectedVideo?.id === video.id ? 'text-amber-300' : 'text-slate-200'}`}>
                {video.title}
              </p>
              <div className='flex items-center gap-2'>
                <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${
                  selectedVideo?.id === video.id ? 'border-amber-500/30 bg-amber-500/20 text-amber-200' : 'border-white/10 bg-[#1e1e1e] text-slate-400'
                }`}>
                  {video.level || 'All Levels'}
                </span>
                {selectedVideo?.id === video.id && (
                  <span className='relative flex h-2 w-2'>
                    <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75'></span>
                    <span className='relative inline-flex h-2 w-2 rounded-full bg-amber-500'></span>
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

export default WatchVideos
