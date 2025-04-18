/**
 * TSNotesPeng - Injected Script
 * 用于处理不同视频平台的时间戳跳转，此脚本被注入到页面的DOM中
 */

// 初始化并自执行
(function() {
  // 视频平台处理器
  const platformHandlers = {
    // YouTube处理器
    youtube: {
      detect: () => window.location.hostname.includes('youtube.com'),
      jump: (timestamp) => {
        try {
          // 尝试使用YouTube Player API
          if (window.ytplayer && window.ytplayer.getPlayer) {
            const player = window.ytplayer.getPlayer();
            player.seekTo(timestamp);
            player.playVideo();
            return true;
          }
          
          // 尝试使用新版YouTube Player
          if (document.querySelector('ytd-app') && window.yt && window.yt.player) {
            const players = document.querySelectorAll('video');
            for (const player of players) {
              if (player && !isHidden(player)) {
                player.currentTime = timestamp;
                if (player.paused) player.play();
                return true;
              }
            }
          }
          
          return false;
        } catch (e) {
          console.error('TSNotesPeng: YouTube 播放器跳转失败', e);
          return false;
        }
      }
    },
    
    // Bilibili处理器
    bilibili: {
      detect: () => window.location.hostname.includes('bilibili.com'),
      jump: (timestamp) => {
        try {
          // 尝试使用Bilibili播放器API
          if (window.player && window.player.seek) {
            window.player.seek(timestamp);
            window.player.play();
            return true;
          }
          
          if (window.bilibiliPlayer && window.bilibiliPlayer.seek) {
            window.bilibiliPlayer.seek(timestamp);
            window.bilibiliPlayer.play();
            return true;
          }
          
          // 尝试获取video元素
          const video = document.querySelector('.bilibili-player-video video');
          if (video) {
            video.currentTime = timestamp;
            if (video.paused) video.play();
            return true;
          }
          
          return false;
        } catch (e) {
          console.error('TSNotesPeng: Bilibili 播放器跳转失败', e);
          return false;
        }
      }
    },
    
    // 腾讯视频处理器
    qq: {
      detect: () => window.location.hostname.includes('v.qq.com'),
      jump: (timestamp) => {
        try {
          // 尝试使用腾讯视频播放器API
          if (window.PLAYER && window.PLAYER.seekTo) {
            window.PLAYER.seekTo(timestamp);
            return true;
          }
          
          // 尝试使用video元素
          const video = document.querySelector('video');
          if (video) {
            video.currentTime = timestamp;
            if (video.paused) video.play();
            return true;
          }
          
          return false;
        } catch (e) {
          console.error('TSNotesPeng: 腾讯视频播放器跳转失败', e);
          return false;
        }
      }
    },
    
    // 爱奇艺处理器
    iqiyi: {
      detect: () => window.location.hostname.includes('iqiyi.com'),
      jump: (timestamp) => {
        try {
          // 尝试使用爱奇艺播放器API
          if (window.playerObject && window.playerObject.currentTime) {
            window.playerObject.currentTime = timestamp;
            window.playerObject.play();
            return true;
          }
          
          // 尝试使用video元素
          const video = document.querySelector('video');
          if (video) {
            video.currentTime = timestamp;
            if (video.paused) video.play();
            return true;
          }
          
          return false;
        } catch (e) {
          console.error('TSNotesPeng: 爱奇艺播放器跳转失败', e);
          return false;
        }
      }
    },
    
    // 优酷处理器
    youku: {
      detect: () => window.location.hostname.includes('youku.com'),
      jump: (timestamp) => {
        try {
          // 尝试使用优酷播放器API
          if (window.playerObject && window.playerObject.seek) {
            window.playerObject.seek(timestamp);
            return true;
          }
          
          // 尝试使用video元素
          const video = document.querySelector('video');
          if (video) {
            video.currentTime = timestamp;
            if (video.paused) video.play();
            return true;
          }
          
          return false;
        } catch (e) {
          console.error('TSNotesPeng: 优酷播放器跳转失败', e);
          return false;
        }
      }
    },
    
    // 通用HTML5视频处理器 - 最后尝试
    html5: {
      detect: () => true, // 始终匹配作为最后手段
      jump: (timestamp) => {
        try {
          // 找到所有视频元素
          const videos = document.querySelectorAll('video');
          if (videos.length === 0) return false;
          
          // 尝试跳转每个视频
          let success = false;
          videos.forEach(video => {
            if (!isHidden(video)) {
              video.currentTime = timestamp;
              if (video.paused) {
                try {
                  video.play();
                } catch (e) {
                  // 忽略自动播放错误，这可能由于浏览器策略限制
                }
              }
              success = true;
            }
          });
          
          return success;
        } catch (e) {
          console.error('TSNotesPeng: HTML5 视频跳转失败', e);
          return false;
        }
      }
    }
  };
  
  // 检查元素是否隐藏
  function isHidden(element) {
    return (
      element.offsetParent === null ||
      window.getComputedStyle(element).display === 'none' ||
      window.getComputedStyle(element).visibility === 'hidden' ||
      element.style.display === 'none'
    );
  }
  
  // 时间戳跳转处理函数
  function handleTimestampJump(event) {
    const timestamp = event.detail.timestamp;
    console.log('TSNotesPeng: 收到时间戳跳转请求，跳转到', timestamp, '秒');
    
    // 尝试每个平台处理器，顺序很重要
    for (const platform in platformHandlers) {
      const handler = platformHandlers[platform];
      if (handler.detect()) {
        console.log('TSNotesPeng: 检测到平台:', platform);
        if (handler.jump(timestamp)) {
          console.log('TSNotesPeng: 使用', platform, '处理器成功跳转到', timestamp, '秒');
          return;
        }
      }
    }
    
    console.log('TSNotesPeng: 所有处理器都无法跳转到指定时间点');
  }
  
  // 监听自定义时间戳跳转事件
  document.addEventListener('TSNotesJumpToTimestamp', handleTimestampJump);
  
  console.log('TSNotesPeng: 注入脚本初始化完成，已添加时间戳跳转事件监听器');
})(); 