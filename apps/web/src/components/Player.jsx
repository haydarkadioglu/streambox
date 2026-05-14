import { useEffect, useRef } from "react";
import Hls from "hls.js";

export function Player({ url }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !url) return undefined;
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      return undefined;
    }
    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(url);
      hls.attachMedia(video);
      return () => hls.destroy();
    }
    return undefined;
  }, [url]);

  return <video ref={videoRef} controls className="player" />;
}

