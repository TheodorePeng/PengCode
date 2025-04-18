// 监听页面点击事件
document.addEventListener('click', function(event) {
  // 检查是否点击了链接
  let target = event.target;
  while (target && target.tagName !== 'A') {
    target = target.parentElement;
  }
  
  // 如果点击的是链接
  if (target && target.tagName === 'A') {
    const href = target.href;
    
    // 检查链接是否包含 &type=TSNotes
    if (href && href.includes('&type=TSNotes')) {
      // 阻止默认行为
      event.preventDefault();
      
      // 提取时间戳
      const timestamp = extractTimestamp(href);
      
      // 发送消息给 background.js
      chrome.runtime.sendMessage({
        type: 'openTSNotesLink',
        url: href,
        timestamp: timestamp
      });
    }
  }
});

// 添加到 content.js 中的消息监听部分

// 处理来自 background.js 的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'jumpToTimestamp') {
    jumpToTimestamp(message.timestamp);
    sendResponse({ success: true });
  } else if (message.type === 'pasteText') {
    pasteText(message.text);
    sendResponse({ success: true });
  } else if (message.type === 'showNotification') {
    showNotification(message.message);
    sendResponse({ success: true });
  } else if (message.type === 'copyToClipboard') {
    navigator.clipboard.writeText(message.text)
      .then(() => sendResponse({ success: true }))
      .catch(() => sendResponse({ success: false }));
    return true; // 异步
  } else if (message.type === 'pasteFromClipboard') {
    navigator.clipboard.readText().then(text => {
      pasteText(text);
    });
    sendResponse({ success: true });
    return true;
  } else if (message.type === 'promptForLink') {
    // 提示用户输入链接
    const userInput = prompt(message.message, '');
    sendResponse({ url: userInput });
    return true;
  } else if (message.type === 'ping') {
    // 添加对ping消息的响应，用于检测content脚本是否已加载
    sendResponse({ pong: true });
    return true;
  }
  return true;
});

// 粘贴文本到当前活动元素
function pasteText(text) {
  const activeElement = document.activeElement;
  if (
    activeElement &&
    (activeElement.tagName === 'INPUT' ||
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.isContentEditable)
  ) {
    if (activeElement.isContentEditable) {
      document.execCommand('insertText', false, text);
    } else {
      const start = activeElement.selectionStart || 0;
      const end = activeElement.selectionEnd || 0;
      const value = activeElement.value || '';
      activeElement.value = value.substring(0, start) + text + value.substring(end);
      activeElement.selectionStart = activeElement.selectionEnd = start + text.length;
      const event = new Event('input', { bubbles: true });
      activeElement.dispatchEvent(event);
    }
  }
}

// 显示通知
function showNotification(message) {
  // 创建通知元素
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background-color: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 10px 20px;
    border-radius: 5px;
    z-index: 9999;
    font-family: Arial, sans-serif;
    font-size: 14px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
  `;
  notification.textContent = message;
  
  document.body.appendChild(notification);
  
  // 3秒后移除通知
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transition = 'opacity 0.5s';
    setTimeout(() => {
      if (notification.parentNode) {
        document.body.removeChild(notification);
      }
    }, 500);
  }, 3000);
}

// 提取时间戳并转换为秒数
function extractTimestamp(url) {
  // 尝试匹配 t=XXs 或 t=XXm 格式
  let match = url.match(/[?&]t=([^&]+)/);
  if (!match) return 0;
  
  const timeStr = match[1];
  
  // 处理不同格式的时间戳
  if (timeStr.includes('m') && timeStr.includes('s')) {
    // 7m30s 格式
    const minuteMatch = timeStr.match(/(\d+)m/);
    const secondMatch = timeStr.match(/(\d+)s/);
    const minutes = minuteMatch ? parseInt(minuteMatch[1]) : 0;
    const seconds = secondMatch ? parseInt(secondMatch[1]) : 0;
    return minutes * 60 + seconds;
  } else if (timeStr.includes('m')) {
    // 7m 格式
    const minutes = parseInt(timeStr);
    return minutes * 60;
  } else if (timeStr.includes('s')) {
    // 30s 格式
    return parseInt(timeStr);
  } else if (timeStr.includes(':')) {
    // 7:30 格式
    const parts = timeStr.split(':');
    const minutes = parseInt(parts[0]);
    const seconds = parseInt(parts[1]);
    return minutes * 60 + seconds;
  } else {
    // 纯数字格式，如 450
    return parseInt(timeStr);
  }
}

// 跳转到指定时间点
function jumpToTimestamp(timestamp) {
  // 尝试查找视频元素
  const videoElements = document.querySelectorAll('video');
  
  if (videoElements.length > 0) {
    // 找到视频元素，设置时间并播放
    videoElements.forEach(video => {
      video.currentTime = timestamp;
      video.play();
    });
  } else {
    // YouTube 和 Bilibili 可能使用特殊的播放器
    // 注入脚本来处理这些特殊情况
    injectScript();
    
    // 创建自定义事件，传递时间戳
    const event = new CustomEvent('TSNotesJumpToTimestamp', {
      detail: { timestamp: timestamp }
    });
    document.dispatchEvent(event);
    
    console.log('TSNotes: 尝试跳转到时间点 ' + timestamp + ' 秒');
  }
}

// 注入脚本到页面
function injectScript() {
  const script = document.createElement('script');
  script.textContent = `
    // 监听自定义事件
    document.addEventListener('TSNotesJumpToTimestamp', function(event) {
      const timestamp = event.detail.timestamp;
      
      // 处理 YouTube
      if (window.location.hostname.includes('youtube.com') && window.ytplayer && window.ytplayer.getPlayer) {
        try {
          const player = window.ytplayer.getPlayer();
          player.seekTo(timestamp);
          player.playVideo();
        } catch (e) {
          console.error('TSNotes: YouTube 播放器跳转失败', e);
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
          }
        } catch (e) {
          console.error('TSNotes: Bilibili 播放器跳转失败', e);
        }
      }
    });
  `;
  document.head.appendChild(script);
}

