import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function PresentationView() {
  const [images, setImages] = useState<any[]>([])
  const [currentSlide, setCurrentSlide] = useState(0)

  useEffect(() => {
    if (!window.electronAPI) return
    const cleanup = window.electronAPI.onPresentationEvent((_event, cmd, data) => {
      if (cmd === 'load-images') {
        setImages(data)
        setCurrentSlide(0)
      } else if (cmd === 'next') {
        setCurrentSlide(s => Math.min(s + 1, data.max))
      } else if (cmd === 'prev') {
        setCurrentSlide(s => Math.max(s - 1, 0))
      }
    })
    return cleanup
  }, [])

  // Keyboard navigation for presentation
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        setCurrentSlide(s => Math.min(s + 1, images.length - 1));
      }
      if (e.key === 'ArrowLeft') {
        setCurrentSlide(s => Math.max(s - 1, 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [images.length]);

  const currentImg = images[currentSlide]

  return (
    <div className="fixed inset-0 bg-black flex flex-col items-center justify-center select-none">
      {currentImg ? (
        <img 
          src={currentImg.localUrl || currentImg.url} 
          className="max-w-full max-h-[90vh] object-contain" 
          alt="Slide"
          draggable={false}
        />
      ) : (
        <div className="text-white text-xl">Waiting for dashboard...</div>
      )}
      
      {/* Navigation Overlays */}
      <button 
        onClick={() => setCurrentSlide(s => Math.max(s - 1, 0))}
        disabled={currentSlide === 0}
        className="absolute left-4 top-1/2 -translate-y-1/2 p-4 text-white/50 hover:text-white disabled:opacity-0 transition-colors"
      >
        <ChevronLeft className="w-12 h-12" />
      </button>
      <button 
        onClick={() => setCurrentSlide(s => Math.min(s + 1, images.length - 1))}
        disabled={currentSlide === images.length - 1}
        className="absolute right-4 top-1/2 -translate-y-1/2 p-4 text-white/50 hover:text-white disabled:opacity-0 transition-colors"
      >
        <ChevronRight className="w-12 h-12" />
      </button>
      
      {/* Top Controls */}
      <div className="absolute top-4 right-4 flex gap-4">
        {images.length > 0 && (
          <div className="bg-black/50 text-white px-4 py-2 rounded-full backdrop-blur-md">
            {currentSlide + 1} / {images.length}
          </div>
        )}
      </div>
    </div>
  )
}
