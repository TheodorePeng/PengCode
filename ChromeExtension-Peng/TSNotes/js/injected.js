// 这个脚本会被注入到页面中，用于处理特定网站的视频播放器

// 监听自定义事件
document.addEventListener('TSNotesJumpToTimestamp', function(event) {
  const timestamp = event.detail.timestamp;
  
  // 处理 YouTube
  if (window.location.hostname.includes('youtube.com')) {
    if (window.ytplayer && window.ytplayer.getPlayer) {
      try {
        const player = window.ytplayer.getPlayer();
        player.seekTo(timestamp);
        player.playVideo();
      } catch (e) {
        console.error('TSNotes: YouTube 播放器跳转失败', e);
      }
    } else {
      // 尝试使用 HTML5 播放器 API
      const videoElement = document.querySelector('video');
      if (videoElement) {
        videoElement.currentTime = timestamp;
        videoElement.play();
      }
    }
  }
  
  // 处理 Bilibili
  if (window.location.hostname.includes('bilibili.com')) {
    try {
      if (window.player && window.player.seek) {
        window.player.seek(timestamp);
        window.player.play();
      } else if (window.bilibiliPlayer && window.bilibiliPlayer.seek) {
        window.bilibiliPlayer.seek(timestamp);
        window.bilibiliPlayer.play();
      } else {
        // 尝试使用 HTML5 播放器 API
        const videoElement = document.querySelector('video');
        if (videoElement) {
          videoElement.currentTime = timestamp;
          videoElement.play();
        }
      }
    } catch (e) {
      console.error('TSNotes: Bilibili 播放器跳转失败', e);
    }
  }
});