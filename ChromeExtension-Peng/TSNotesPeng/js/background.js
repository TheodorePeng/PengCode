/**
 * TSNotesPeng - Background Script
 * 负责处理扩展的后台逻辑
 */

// =============== 全局变量 ===============
// 主窗口ID
let tsNotesWindowId = null;
// 窗口创建状态标志
let isCreatingWindow = false;
// 窗口检查定时器
let windowCheckInterval = null;
// 待处理请求队列
let pendingRequests = [];
// 自动粘贴设置（默认开启）
let autoPaste = true;
// 窗口分割比例（0-1之间，表示TSNotes窗口占据屏幕宽度的比例）
let screenSplitRatio = 0.5;

// =============== 初始化和事件监听器 ===============

// 初始化设置和菜单
async function initialize() {
  console.log('TSNotesPeng: 初始化扩展程序...');
  
  // 从存储中加载设置
  try {
    const data = await chrome.storage.local.get(['autoPaste', 'screenSplitRatio', 'tsNotesWindowId']);
    if (data.autoPaste !== undefined) {
      autoPaste = data.autoPaste;
      console.log('TSNotesPeng: 已加载自动粘贴设置:', autoPaste);
    }
    
    if (data.screenSplitRatio !== undefined) {
      screenSplitRatio = data.screenSplitRatio;
      console.log('TSNotesPeng: 已加载窗口分割比例:', screenSplitRatio);
    }
    
    // 检查保存的窗口ID是否仍然有效
    if (data.tsNotesWindowId !== undefined) {
      try {
        const window = await chrome.windows.get(data.tsNotesWindowId);
        if (window) {
          tsNotesWindowId = data.tsNotesWindowId;
          console.log('TSNotesPeng: 已恢复保存的窗口ID:', tsNotesWindowId);
        }
      } catch (e) {
        // 窗口不存在，重置ID
        console.log('TSNotesPeng: 保存的窗口ID无效，已重置');
        chrome.storage.local.remove('tsNotesWindowId');
      }
    }
  } catch (e) {
    console.error('TSNotesPeng: 加载设置失败', e);
  }
  
  // 创建右键菜单
  createContextMenu();
}

// 监听窗口关闭事件，如果关闭的是TSNotes窗口，则重置窗口ID
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === tsNotesWindowId) {
    console.log('TSNotesPeng: TSNotes窗口已关闭');
    tsNotesWindowId = null;
    chrome.storage.local.remove('tsNotesWindowId');
  }
});

// 在扩展安装或更新时运行初始化
chrome.runtime.onInstalled.addListener((details) => {
  console.log('TSNotesPeng: 扩展已', details.reason);
  initialize();
});

// 在浏览器启动时运行初始化
chrome.runtime.onStartup.addListener(() => {
  console.log('TSNotesPeng: 浏览器已启动');
  initialize();
});

// 立即运行初始化
initialize();

// =============== 全局变量 ===============

// =============== 初始化与事件监听 ===============
// 初始化扩展
async function initExtension() {
  console.log('TSNotesPeng: 初始化扩展...');
  
  // 重置窗口创建状态
  isCreatingWindow = false;
  
  // 清除可能存在的队列
  pendingRequests = [];
  
  // 从存储中恢复窗口ID、自动粘贴设置和窗口分割比例
  const result = await chrome.storage.local.get(['tsNotesWindowId', 'autoPaste', 'screenSplitRatio']);
  
  // 恢复窗口ID
  if (result.tsNotesWindowId) {
    try {
      // 验证窗口是否仍然存在
      await chrome.windows.get(result.tsNotesWindowId);
      tsNotesWindowId = result.tsNotesWindowId;
      console.log('TSNotesPeng: 恢复已存在的窗口 ID:', tsNotesWindowId);
    } catch (error) {
      // 窗口不存在，重置ID
      console.log('TSNotesPeng: 存储的窗口不存在，重置ID');
      tsNotesWindowId = null;
      await chrome.storage.local.remove('tsNotesWindowId');
    }
  } else {
    // 确保窗口ID为空
    tsNotesWindowId = null;
  }
  
  // 恢复自动粘贴设置
  if (result.autoPaste !== undefined) {
    autoPaste = result.autoPaste;
    console.log('TSNotesPeng: 恢复自动粘贴设置:', autoPaste);
  }
  
  // 恢复窗口分割比例设置
  if (result.screenSplitRatio !== undefined) {
    screenSplitRatio = result.screenSplitRatio;
    console.log('TSNotesPeng: 恢复窗口分割比例设置:', screenSplitRatio);
  }
  
  // 创建右键菜单
  createContextMenu();
  
  // 启动定期检查
  startWindowCheck();
}

// 启动定期检查窗口状态
function startWindowCheck() {
  if (windowCheckInterval) {
    clearInterval(windowCheckInterval);
  }
  
  windowCheckInterval = setInterval(async () => {
    if (tsNotesWindowId !== null) {
      try {
        await chrome.windows.get(tsNotesWindowId);
        // 窗口存在，不做任何操作
      } catch (error) {
        // 窗口不存在，重置ID
        console.log('TSNotesPeng: 窗口已关闭，重置ID');
        tsNotesWindowId = null;
        await chrome.storage.local.remove('tsNotesWindowId');
      }
    }
  }, 10000); // 每10秒检查一次
}

// 监听扩展安装或更新事件
chrome.runtime.onInstalled.addListener(() => {
  initExtension();
});

// 监听浏览器启动事件
chrome.runtime.onStartup.addListener(() => {
  initExtension();
});

// 确保扩展激活时初始化
initExtension();

// 监听来自content.js的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'openTSNotesLink') {
    // 如果正在创建窗口，将请求加入队列
    if (isCreatingWindow) {
      console.log('TSNotesPeng: 窗口正在创建中，请求加入队列');
      pendingRequests.push({
        url: message.url,
        timestamp: message.timestamp,
        sendResponse: sendResponse
      });
      return true;
    }
    
    handleTSNotesLink(message.url, message.timestamp)
      .then(() => sendResponse({ success: true }))
      .catch(error => {
        console.error('TSNotesPeng: 处理链接失败', error);
        sendResponse({ success: false, error: error.message });
      });
    return true; // 异步响应
  }
  return true;
});

// 监听扩展图标点击事件
chrome.action.onClicked.addListener(async (tab) => {
  console.log('TSNotesPeng: 扩展图标被点击');
  // 确保使用与快捷键完全相同的处理方式
  await openBlankTSNotesWindowIfNotExist();
});

// 监听快捷键事件
chrome.commands.onCommand.addListener((command) => {
  if (command === "copy-tsnotes-link") {
    copyCurrentTSNotesLink();
  } else if (command === "open-tsnotes-window") {
    openBlankTSNotesWindowIfNotExist();
  } else if (command === "change-tsnotes-link") {
    changeTSNotesLink();
  } else if (command === "open-page-in-tsnotes") {
    openCurrentPageInTSNotes();
  }
});

// =============== TSNotes链接处理 ===============
// 处理TSNotes链接
async function handleTSNotesLink(url, timestamp) {
  console.log('TSNotesPeng: 处理链接', url, timestamp);
  
  // 设置创建窗口标志位，防止重复处理
  isCreatingWindow = true;
  
  try {
    // 移除&type=TSNotes后缀，获取原始视频URL
    const cleanUrl = url.replace(/&type=TSNotes/g, '');
    
    // 获取当前窗口作为源窗口
    const currentWindow = await getCurrentWindow();
    const sourceWindowId = currentWindow.id;
    
    // 先检查存储中的窗口ID
    const result = await chrome.storage.local.get(['tsNotesWindowId']);
    if (result.tsNotesWindowId && result.tsNotesWindowId !== tsNotesWindowId) {
      tsNotesWindowId = result.tsNotesWindowId;
    }
    
    // 检查TSNotes Window是否存在
    if (tsNotesWindowId !== null) {
      try {
        // 尝试获取窗口信息
        const window = await chrome.windows.get(tsNotesWindowId);
        
        // 窗口存在，激活窗口
        await chrome.windows.update(tsNotesWindowId, { focused: true });
        
        // 获取窗口中的所有标签页
        const tabs = await chrome.tabs.query({ windowId: tsNotesWindowId });
        
        if (tabs.length > 0) {
          // 向标签页发送跳转消息
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'jumpToTimestamp',
            timestamp: timestamp
          }).catch(e => {
            console.error('TSNotesPeng: 发送跳转消息失败', e);
          });
        }
      } catch (error) {
        // 窗口不存在，重置ID并创建新窗口
        console.log('TSNotesPeng: 窗口不存在，创建新窗口');
        tsNotesWindowId = null;
        await chrome.storage.local.remove('tsNotesWindowId');
        await createTSNotesWindow(cleanUrl, timestamp, sourceWindowId);
      }
    } else {
      // TSNotes Window不存在，创建新窗口
      console.log('TSNotesPeng: 窗口不存在，创建新窗口');
      await createTSNotesWindow(cleanUrl, timestamp, sourceWindowId);
    }
  } finally {
    // 重置创建窗口标志位
    isCreatingWindow = false;
    
    // 处理队列中的下一个请求
    if (pendingRequests.length > 0) {
      const nextRequest = pendingRequests.shift();
      console.log('TSNotesPeng: 处理队列中的下一个请求');
      handleTSNotesLink(nextRequest.url, nextRequest.timestamp)
        .then(() => nextRequest.sendResponse({ success: true }))
        .catch(error => {
          console.error('TSNotesPeng: 处理队列请求失败', error);
          nextRequest.sendResponse({ success: false, error: error.message });
        });
    }
  }
}

// 创建TSNotes Window
async function createTSNotesWindow(url, timestamp, sourceWindowId) {
  console.log('TSNotesPeng: 开始创建窗口');
  
  try {
    // 先关闭可能存在的所有TSNotes窗口
    const allWindows = await chrome.windows.getAll();
    for (const window of allWindows) {
      try {
        const tabs = await chrome.tabs.query({ windowId: window.id });
        for (const tab of tabs) {
          if (tab.url && tab.url.includes('&type=TSNotes')) {
            await chrome.windows.remove(window.id);
            break;
          }
        }
      } catch (e) {
        // 忽略错误
      }
    }
    
    // 如果没有传入源窗口ID，尝试获取当前窗口
    if (!sourceWindowId) {
      try {
        const currentWindow = await getCurrentWindow();
        sourceWindowId = currentWindow.id;
      } catch (e) {
        console.error('TSNotesPeng: 获取当前窗口失败', e);
        sourceWindowId = null;
      }
    }
    
    // 检测浏览器类型
    const browserInfo = await detectBrowser();
    
    // 创建窗口选项
    let windowOptions = {
      url: url,
      type: 'popup'
    };
    
    // 根据浏览器类型设置窗口属性
    if (browserInfo.isArc) {
      // Arc浏览器使用最简单的窗口设置，不指定位置和大小
      console.log('TSNotesPeng: 检测到Arc浏览器，使用简化窗口设置');
    } else if (browserInfo.isEdge) {
      // Edge浏览器特殊处理
      console.log('TSNotesPeng: 检测到Edge浏览器，使用特殊设置');
      // 获取屏幕信息
      try {
        const screenInfo = await getScreenInfo();
        
        // 使用自定义分割比例参数
        const tsNotesRatio = screenSplitRatio; // TSNotes窗口占屏幕宽度的比例
        
        // 计算窗口尺寸和位置
        const tsNotesWidth = Math.floor(screenInfo.width * tsNotesRatio);
        const tsNotesHeight = screenInfo.height;
        
        // 添加窗口位置和大小设置 - TSNotes窗口放在左侧
        windowOptions = {
          ...windowOptions,
          width: tsNotesWidth,
          height: tsNotesHeight,
          left: 0,
          top: 0
        };
      } catch (e) {
        console.error('TSNotesPeng: 计算窗口尺寸失败，使用默认设置', e);
      }
    } else {
      // 其他浏览器，尝试设置窗口位置和大小
      try {
        // 获取屏幕信息
        const screenInfo = await getScreenInfo();
        
        // 使用自定义分割比例参数
        const tsNotesRatio = screenSplitRatio; // TSNotes窗口占屏幕宽度的比例
        
        // 计算窗口尺寸和位置
        const tsNotesWidth = Math.floor(screenInfo.width * tsNotesRatio);
        const tsNotesHeight = screenInfo.height;
        
        // 添加窗口位置和大小设置 - TSNotes窗口放在左侧
        windowOptions = {
          ...windowOptions,
          width: tsNotesWidth,
          height: tsNotesHeight,
          left: 0,
          top: 0
        };
      } catch (e) {
        console.error('TSNotesPeng: 计算窗口尺寸失败，使用默认设置', e);
      }
    }
    
    // 创建一个新的弹出窗口
    // 在Edge浏览器中，添加一个延迟再创建窗口
    if (browserInfo.isEdge) {
      // Edge浏览器特殊处理，增加延迟
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    const newWindow = await chrome.windows.create(windowOptions);
    
    // 保存窗口ID
    tsNotesWindowId = newWindow.id;
    console.log('TSNotesPeng: 窗口创建成功，ID:', tsNotesWindowId);
    
    // 将窗口ID保存到存储中
    await chrome.storage.local.set({ tsNotesWindowId: tsNotesWindowId });
    
    // 等待窗口创建完成
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // 仅在非Arc浏览器中尝试调整原始窗口
    if (!browserInfo.isArc && sourceWindowId) {
      try {
        // 获取屏幕信息
        const screenInfo = await getScreenInfo();
        
        // 使用自定义分割比例参数
        const tsNotesRatio = screenSplitRatio;
        
        // 计算原始窗口尺寸和位置 - 原始窗口放在右侧
        const sourceWidth = Math.floor(screenInfo.width * (1 - tsNotesRatio));
        const tsNotesWidth = Math.floor(screenInfo.width * tsNotesRatio);
        
        // 调整原始窗口（点击TSNotes Link的窗口）位置和大小
        await chrome.windows.update(sourceWindowId, {
          width: sourceWidth,
          height: screenInfo.height,
          left: tsNotesWidth,
          top: 0
        });
      } catch (e) {
        console.error('TSNotesPeng: 调整原始窗口失败', e);
        // 失败时不中断流程
      }
    }
    
    // 监听窗口关闭事件
    const windowRemovedListener = (windowId) => {
      if (windowId === tsNotesWindowId) {
        console.log('TSNotesPeng: 窗口已关闭');
        tsNotesWindowId = null;
        chrome.storage.local.remove('tsNotesWindowId');
        chrome.windows.onRemoved.removeListener(windowRemovedListener);
      }
    };
    
    chrome.windows.onRemoved.addListener(windowRemovedListener);
    
    // 等待页面加载完成后跳转到指定时间点
    if (timestamp) {
      const tabs = await chrome.tabs.query({ windowId: tsNotesWindowId });
      if (tabs.length > 0) {
        const tabId = tabs[0].id;
        
        // 设置监听器来等待页面加载完成
        const tabUpdatedListener = (tabId, changeInfo, tab) => {
          if (tab.windowId === tsNotesWindowId && changeInfo.status === 'complete') {
            console.log('TSNotesPeng: 页面加载完成，准备跳转到时间点');
            
            // 延迟发送跳转消息，确保页面完全加载
            setTimeout(() => {
              chrome.tabs.sendMessage(tabId, {
                type: 'jumpToTimestamp',
                timestamp: timestamp
              }).catch(e => {
                console.error('TSNotesPeng: 发送跳转消息失败', e);
              });
            }, 2000);
            
            // 移除监听器
            chrome.tabs.onUpdated.removeListener(tabUpdatedListener);
          }
        };
        
        chrome.tabs.onUpdated.addListener(tabUpdatedListener);
      }
    }
  } catch (error) {
    console.error('TSNotesPeng: 创建窗口失败', error);
    throw error; // 向上传递错误
  }
}

// =============== 用户交互与空白窗口创建 ===============
// 在TSNotes窗口中打开当前网页并关闭源页面
async function openCurrentPageInTSNotes() {
  console.log('TSNotesPeng: 尝试在TSNotes窗口中打开当前网页');
  
  try {
    // 获取当前活动标签页
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab || !activeTab.id || !activeTab.url) {
      console.error('TSNotesPeng: 无法获取当前活动标签页');
      showNotificationInActiveTab('无法获取当前活动标签页信息');
      return;
    }
    
    const currentUrl = activeTab.url;
    const currentWindowId = activeTab.windowId;
    const currentTabId = activeTab.id;
    
    // 检查TSNotes窗口是否存在
    if (tsNotesWindowId) {
      try {
        // 尝试获取窗口信息
        const window = await chrome.windows.get(tsNotesWindowId);
        
        // 窗口存在，获取窗口中的所有标签页
        const tabs = await chrome.tabs.query({ windowId: tsNotesWindowId });
        
        if (tabs.length > 0) {
          // 在第一个标签页中加载当前URL
          await chrome.tabs.update(tabs[0].id, { url: currentUrl });
          console.log('TSNotesPeng: 已在现有TSNotes窗口中加载当前URL');
        } else {
          // 如果窗口中没有标签页（不太可能），创建一个新标签页
          await chrome.tabs.create({ windowId: tsNotesWindowId, url: currentUrl });
          console.log('TSNotesPeng: 已在TSNotes窗口中创建新标签页加载当前URL');
        }
        
        // 激活TSNotes窗口
        await chrome.windows.update(tsNotesWindowId, { focused: true });
      } catch (error) {
        // 窗口不存在，重置ID并创建新窗口
        console.log('TSNotesPeng: TSNotes窗口不存在，创建新窗口');
        tsNotesWindowId = null;
        await chrome.storage.local.remove('tsNotesWindowId');
        
        // 创建新的TSNotes窗口
        await createTSNotesWindow(currentUrl, 0, currentWindowId);
      }
    } else {
      // TSNotes窗口不存在，创建新窗口
      console.log('TSNotesPeng: 创建新的TSNotes窗口');
      await createTSNotesWindow(currentUrl, 0, currentWindowId);
    }
    
    // 关闭源标签页
    await chrome.tabs.remove(currentTabId);
    console.log('TSNotesPeng: 已关闭源标签页');
    
    return true;
  } catch (error) {
    console.error('TSNotesPeng: 在TSNotes窗口中打开当前页面失败', error);
    showNotificationInActiveTab('操作失败: ' + error.message);
    return false;
  }
}

// 快捷键触发创建空白TSNotes Window
async function openBlankTSNotesWindowIfNotExist() {
  if (tsNotesWindowId) {
    // 已有窗口则不重复创建
    try {
      await chrome.windows.get(tsNotesWindowId);
      return;
    } catch (e) {
      // 窗口不存在，继续创建
      tsNotesWindowId = null;
      await chrome.storage.local.remove('tsNotesWindowId');
    }
  }
  
  try {
    // 获取当前活动标签页
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab || !activeTab.id) {
      console.error('TSNotesPeng: 无法获取当前活动标签页');
      // 如果无法获取活动标签页，直接创建默认空白窗口
      await createDefaultEmptyWindow();
      return;
    }
    
    // 获取首次创建标记
    const firstCreateResult = await chrome.storage.local.get(['firstCreateDone']);
    const isFirstCreate = !firstCreateResult.firstCreateDone;
    
    // 首次创建时总是请求用户输入链接
    // 每次通过扩展图标或快捷键创建窗口时，总是请求用户输入
    let shouldPrompt = true;
    
    if (shouldPrompt) {
      // 使用浏览器内置的prompt方法直接获取用户输入
      try {
        // 直接在当前活动标签页上执行脚本，弹出一个简单的prompt
        const results = await chrome.scripting.executeScript({
          target: { tabId: activeTab.id },
          func: () => {
            return prompt('请输入要在TSNotesPeng窗口中打开的链接 (留空则创建空白窗口):', '');
          }
        });
        
        let userInput = '';
        if (results && results[0] && results[0].result !== null) {
          userInput = results[0].result;
        }
        
        // 如果prompt返回null，表示用户取消了操作
        if (userInput === null) {
          console.log('TSNotesPeng: 用户取消了操作');
          return;
        }
        
        // 处理用户输入
        await handlePromptResult(userInput, activeTab.windowId);
        
        // 如果是首次创建，标记为已完成首次创建
        if (isFirstCreate) {
          await chrome.storage.local.set({ firstCreateDone: true });
          console.log('TSNotesPeng: 已完成首次创建，不再自动请求输入链接');
        }
      } catch (error) {
        console.error('TSNotesPeng: 获取用户输入失败', error);
        // 如果获取用户输入失败，创建默认空白窗口
        await createDefaultEmptyWindow();
      }
    } else {
      // 非首次创建，直接创建空白窗口
      await createDefaultEmptyWindow();
    }
  } catch (error) {
    console.error('TSNotesPeng: 用户交互失败', error);
    // 如果用户交互整体失败，创建默认空白窗口
    await createDefaultEmptyWindow();
  }
}

// 处理用户输入结果
async function handlePromptResult(userInput, sourceWindowId) {
  let url = 'about:blank';
  if (userInput && userInput.trim() !== '') {
    url = userInput.trim();
    // 如果用户输入的不是完整URL，尝试添加https://前缀
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      url = 'https://' + url;
    }
  }
  
  // 如果没有传入源窗口ID，尝试获取当前窗口
  if (!sourceWindowId) {
    try {
      const currentWindow = await getCurrentWindow();
      sourceWindowId = currentWindow.id;
    } catch (e) {
      console.error('TSNotesPeng: 获取当前窗口失败', e);
      sourceWindowId = null;
    }
  }
  
  // 使用通用窗口创建函数，确保完成布局
  await createTSNotesWindow(url, 0, sourceWindowId);
}

// 创建默认空白窗口
async function createDefaultEmptyWindow() {
  try {
    // 获取当前窗口作为源窗口
    let sourceWindowId = null;
    try {
      const currentWindow = await getCurrentWindow();
      sourceWindowId = currentWindow.id;
    } catch (e) {
      console.error('TSNotesPeng: 获取当前窗口失败', e);
    }
    
    // 使用通用窗口创建函数，确保完成布局
    await createTSNotesWindow('about:blank', 0, sourceWindowId);
    return true;
  } catch (e) {
    console.error('TSNotesPeng: 创建默认窗口失败', e);
    return false;
  }
}

// =============== 复制和修改链接 ===============
// 获取并复制当前TSNotes链接
async function copyCurrentTSNotesLink(forcePaste = false) {
  console.log('TSNotesPeng: 尝试获取当前时间点链接');
  
  try {
    // 检查TSNotes Window是否存在
    if (!tsNotesWindowId) {
      console.log('TSNotesPeng: 没有活动的TSNotes窗口');
      showNotificationInActiveTab('没有活动的TSNotes窗口');
      return;
    }
    
    // 获取TSNotes Window中的标签页
    const tabs = await chrome.tabs.query({ windowId: tsNotesWindowId });
    if (tabs.length === 0) {
      console.log('TSNotesPeng: TSNotes窗口中没有标签页');
      showNotificationInActiveTab('TSNotes窗口中没有标签页');
      return;
    }
    
    // 获取当前标签页的URL和当前播放时间
    const tabId = tabs[0].id;
    const tabUrl = tabs[0].url;
    
    // 执行脚本获取当前视频播放时间
    const results = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => {
        const videoElements = Array.from(document.querySelectorAll('video'))
          .filter(video => video.duration > 0 && 
                  video.offsetParent !== null && 
                  window.getComputedStyle(video).display !== 'none');
        
        if (videoElements.length === 0) {
          return { success: false, error: '未找到视频元素' };
        }
        
        const video = videoElements[0];
        const currentTime = Math.floor(video.currentTime);
        
        const formatTime = (seconds) => {
          const hours = Math.floor(seconds / 3600);
          const minutes = Math.floor((seconds % 3600) / 60);
          const secs = seconds % 60;
          
          return [
            hours > 0 ? hours.toString().padStart(2, '0') : null,
            minutes.toString().padStart(2, '0'),
            secs.toString().padStart(2, '0')
          ].filter(Boolean).join(':');
        };
        
        return {
          success: true,
          currentTime: currentTime,
          formattedTime: formatTime(currentTime)
        };
      }
    });
    
    if (!results || !results[0] || !results[0].result || !results[0].result.success) {
      console.error('TSNotesPeng: 获取视频时间失败', results);
      showNotificationInActiveTab('获取视频时间失败，请确保页面中有可见的视频');
      return;
    }
    
    const { currentTime, formattedTime } = results[0].result;
    
    // 清理URL，移除现有的时间戳和TSNotes标记
    let cleanUrl = tabUrl.replace(/[?&]t=\d+(\.\d+)?s?/g, '')
                         .replace(/[?&]start=\d+/g, '')
                         .replace(/[?&]time_continue=\d+/g, '')
                         .replace(/&type=TSNotes/g, '');
    
    // 添加时间戳参数
    const separator = cleanUrl.includes('?') ? '&' : '?';
    const tsNotesLink = `${cleanUrl}${separator}t=${currentTime}s&type=TSNotes`;
    
    // 创建Markdown格式的链接，并在末尾加一个空格
    const markdownLink = `[${formattedTime}](${tsNotesLink}) `;
    
    // 复制到剪贴板
    await copyToClipboard(markdownLink);
    console.log('TSNotesPeng: 已复制链接到剪贴板', markdownLink);
    
    // 根据自动粘贴设置或强制粘贴参数决定是否粘贴
    if (autoPaste || forcePaste) {
      await pasteClipboardContentToActiveTab();
    } else {
      // 仅显示通知，不粘贴
      showNotificationInActiveTab('已复制TSNotes链接到剪贴板');
    }
  } catch (error) {
    console.error('TSNotesPeng: 获取链接失败', error);
    showNotificationInActiveTab('获取链接失败: ' + error.message);
  }
}

// 修改当前TSNotes窗口中的链接
async function changeTSNotesLink() {
  console.log('TSNotesPeng: 尝试修改当前TSNotes窗口链接');
  
  // 检查TSNotes窗口是否存在
  if (!tsNotesWindowId) {
    console.log('TSNotesPeng: 没有活动的TSNotes窗口');
    showNotificationInActiveTab('没有活动的TSNotes窗口，请先创建或打开一个TSNotes窗口');
    return;
  }
  
  try {
    // 获取当前活动标签页
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab || !activeTab.id) {
      console.error('TSNotesPeng: 无法获取当前活动标签页');
      return;
    }
    
    // 获取当前TSNotes窗口中的标签页
    const tsTabs = await chrome.tabs.query({ windowId: tsNotesWindowId });
    let currentUrl = 'about:blank';
    
    if (tsTabs.length > 0) {
      currentUrl = tsTabs[0].url;
      // 清除url中的时间戳和TSNotes标记
      currentUrl = currentUrl.replace(/[?&]t=\d+(\.\d+)?s?/g, '')
                     .replace(/[?&]start=\d+/g, '')
                     .replace(/[?&]time_continue=\d+/g, '')
                     .replace(/&type=TSNotes/g, '');
    }
    
    // 直接在当前活动标签页上执行脚本，弹出一个简单的prompt
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: (currentUrl) => {
          return prompt('请输入新的链接，以替换当前TSNotes窗口中的链接：', currentUrl);
        },
        args: [currentUrl]
      });
      
      // 处理用户输入
      if (results && results[0] && results[0].result !== null) {
        const userInput = results[0].result;
        
        // 用户取消操作
        if (userInput === null) {
          console.log('TSNotesPeng: 用户取消了修改链接');
          return;
        }
        
        // 处理用户输入，更新TSNotes窗口中的链接
        if (userInput && userInput.trim() !== '') {
          let newUrl = userInput.trim();
          // 如果用户输入的不是完整URL，尝试添加https://前缀
          if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
            newUrl = 'https://' + newUrl;
          }
          
          // 更新窗口中的标签页
          if (tsTabs.length > 0) {
            await chrome.tabs.update(tsTabs[0].id, { url: newUrl });
            console.log('TSNotesPeng: 已更新链接为:', newUrl);
            
            // 通知用户链接已修改
            showNotificationInActiveTab('TSNotes窗口链接已更新');
          }
        }
      }
    } catch (error) {
      console.error('TSNotesPeng: 获取用户输入失败', error);
      showNotificationInActiveTab('获取用户输入失败: ' + error.message);
    }
  } catch (error) {
    console.error('TSNotesPeng: 修改链接失败', error);
    showNotificationInActiveTab('修改链接失败: ' + error.message);
  }
}

// =============== 实用工具函数 ===============
// 在活动标签页中显示通知
async function showNotificationInActiveTab(message) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, {
        type: 'showNotification',
        message: message
      }).catch(() => {
        console.error('TSNotesPeng: 发送通知失败');
      });
    }
  } catch (e) {
    console.error('TSNotesPeng: 显示通知失败', e);
  }
}

// 检测浏览器类型
async function detectBrowser() {
  const browserInfo = {
    isArc: false,
    isChrome: false,
    isEdge: false,
    name: 'unknown'
  };
  
  try {
    // 获取当前活动标签页
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab && activeTab.id) {
      const results = await chrome.scripting.executeScript({
        target: { tabId: activeTab.id },
        func: () => {
          const ua = navigator.userAgent;
          return {
            userAgent: ua,
            isArc: ua.includes('Arc'),
            isEdge: ua.includes('Edg/') || ua.includes('Edge/'),
            isChrome: ua.includes('Chrome') && !ua.includes('Arc') && !ua.includes('Edg/') && !ua.includes('Edge/')
          };
        }
      });
      
      if (results && results[0] && results[0].result) {
        const result = results[0].result;
        browserInfo.isArc = result.isArc;
        browserInfo.isEdge = result.isEdge;
        browserInfo.isChrome = result.isChrome;
        
        // 确定浏览器名称
        if (result.isArc) {
          browserInfo.name = 'Arc';
        } else if (result.isEdge) {
          browserInfo.name = 'Edge';
        } else if (result.isChrome) {
          browserInfo.name = 'Chrome';
        } else {
          browserInfo.name = 'unknown';
        }
        
        console.log('TSNotesPeng: 检测到浏览器类型:', browserInfo.name);
      }
    } else {
      // 如果没有活动标签页，使用 navigator.userAgent 猜测浏览器类型
      const ua = navigator.userAgent;
      browserInfo.isArc = ua.includes('Arc');
      browserInfo.isEdge = ua.includes('Edg/') || ua.includes('Edge/');
      browserInfo.isChrome = ua.includes('Chrome') && !ua.includes('Arc') && !ua.includes('Edg/') && !ua.includes('Edge/');
      
      if (browserInfo.isArc) {
        browserInfo.name = 'Arc';
      } else if (browserInfo.isEdge) {
        browserInfo.name = 'Edge';
      } else if (browserInfo.isChrome) {
        browserInfo.name = 'Chrome';
      }
      
      console.log('TSNotesPeng: 使用UA猜测浏览器类型:', browserInfo.name);
    }
    
    return browserInfo;
  } catch (e) {
    console.error('TSNotesPeng: 检测浏览器类型失败', e);
    
    // 如果脚本执行失败，尝试使用 navigator.userAgent
    try {
      const ua = navigator.userAgent;
      browserInfo.isArc = ua.includes('Arc');
      browserInfo.isEdge = ua.includes('Edg/') || ua.includes('Edge/');
      browserInfo.isChrome = ua.includes('Chrome') && !ua.includes('Arc') && !ua.includes('Edg/') && !ua.includes('Edge/');
      
      if (browserInfo.isArc) {
        browserInfo.name = 'Arc';
      } else if (browserInfo.isEdge) {
        browserInfo.name = 'Edge';
      } else if (browserInfo.isChrome) {
        browserInfo.name = 'Chrome';
      }
      
      console.log('TSNotesPeng: 使用UA猜测浏览器类型:', browserInfo.name);
    } catch (err) {
      // 忽略错误
    }
    
    return browserInfo; // 返回默认值或尝试猜测的值
  }
}

// 获取屏幕信息
async function getScreenInfo() {
  // 默认屏幕尺寸
  const defaultScreenInfo = {
    width: 1920,
    height: 1080
  };
  
  try {
    // 获取所有窗口信息
    const windows = await chrome.windows.getAll();
    if (windows.length === 0) {
      return defaultScreenInfo;
    }
    
    // 找出最大的窗口尺寸作为屏幕尺寸的参考
    let maxWidth = 0;
    let maxHeight = 0;
    
    for (const win of windows) {
      if (win.width > maxWidth) maxWidth = win.width;
      if (win.height > maxHeight) maxHeight = win.height;
    }
    
    // 如果获取到的尺寸太小，使用默认值
    if (maxWidth < 800 || maxHeight < 600) {
      return defaultScreenInfo;
    }
    
    // 估计屏幕尺寸（考虑到窗口通常不会占满整个屏幕）
    return {
      width: Math.max(maxWidth * 1.1, 1920),  // 增加10%作为估计
      height: Math.max(maxHeight * 1.1, 1080) // 增加10%作为估计
    };
  } catch (error) {
    console.error('TSNotesPeng: 获取屏幕信息失败', error);
    return defaultScreenInfo;
  }
}

// 获取当前窗口信息
async function getCurrentWindow() {
  return new Promise((resolve) => {
    chrome.windows.getCurrent((window) => {
      // 默认窗口尺寸
      const defaultWindow = {
        width: 1280,
        height: 800,
        id: null
      };
      
      if (chrome.runtime.lastError) {
        console.error('TSNotesPeng: 获取当前窗口信息失败', chrome.runtime.lastError);
        resolve(defaultWindow);
      } else {
        resolve(window);
      }
    });
  });
}

// 复制文本到剪贴板
async function copyToClipboard(text) {
  // 优先尝试让content script写入剪贴板
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      const result = await chrome.tabs.sendMessage(tab.id, {
        type: 'copyToClipboard',
        text
      });
      
      if (result && result.success) {
        return true;
      }
    }
  } catch (e) {
    // 忽略，继续备用方案
  }

  // 备用方法：创建一个临时标签页来执行复制操作
  try {
    const tab = await chrome.tabs.create({ url: 'about:blank', active: false });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (textToCopy) => {
        const textarea = document.createElement('textarea');
        textarea.value = textToCopy;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      },
      args: [text]
    });
    
    await chrome.tabs.remove(tab.id);
    return true;
  } catch (err) {
    console.error('TSNotesPeng: 备用复制方法也失败', err);
    return false;
  }
}

// 读取剪贴板内容并粘贴到活动标签页
async function pasteClipboardContentToActiveTab() {
  try {
    // 通过content script读取剪贴板内容并粘贴
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.id) {
      chrome.tabs.sendMessage(tab.id, { type: 'pasteFromClipboard' });
      
      // 通知
      chrome.tabs.sendMessage(tab.id, {
        type: 'showNotification',
        message: '已复制TSNotes链接到剪贴板并粘贴'
      }).catch(() => {});
    }
  } catch (error) {
    console.error('TSNotesPeng: 粘贴剪贴板内容失败', error);
  }
}

// =============== 上下文菜单功能 ===============
// 创建右键菜单
function createContextMenu() {
  // 先清除所有现有菜单
  chrome.contextMenus.removeAll(() => {
    // 创建菜单项 - 插件图标上的菜单
    // 直接添加到插件图标右键菜单，不使用TSNotesPeng父菜单
    
    // 创建自动粘贴选项
    chrome.contextMenus.create({
      id: 'auto-paste',
      title: '自动粘贴链接',
      type: 'checkbox',
      checked: autoPaste,
      contexts: ['action']
    });
    
    // 创建获取链接菜单项
    chrome.contextMenus.create({
      id: 'get-tsnotes-link',
      title: '获取 TSNotes 链接',
      contexts: ['action']
    });
    
    // 创建空白窗口菜单项
    chrome.contextMenus.create({
      id: 'open-tsnotes-window',
      title: '创建/打开 TSNotes 窗口',
      contexts: ['action']
    });
    
    // 创建修改链接菜单项
    chrome.contextMenus.create({
      id: 'change-tsnotes-link',
      title: '修改 TSNotes 窗口链接',
      contexts: ['action']
    });
    
    // 创建在TSNotes窗口中打开当前页面的菜单项
    chrome.contextMenus.create({
      id: 'open-page-in-tsnotes',
      title: '在TSNotes窗口中打开当前页面',
      contexts: ['action']
    });
    
    // 创建窗口分割比例设置子菜单
    chrome.contextMenus.create({
      id: 'split-ratio',
      title: '窗口分割比例',
      contexts: ['action']
    });
    
    // 创建几个预设的分割比例选项
    const ratios = [
      { id: 'ratio-0.3', value: 0.3, title: '30% : 70%' },
      { id: 'ratio-0.5', value: 0.5, title: '50% : 50%' },
      { id: 'ratio-0.7', value: 0.7, title: '70% : 30%' }
    ];
    
    // 为插件图标菜单添加分割比例选项
    for (const ratio of ratios) {
      chrome.contextMenus.create({
        id: ratio.id,
        parentId: 'split-ratio',
        title: ratio.title,
        type: 'radio',
        checked: Math.abs(screenSplitRatio - ratio.value) < 0.01,
        contexts: ['action']
      });
    }
    
    // =============== 页面上的右键菜单 ===============
    // 直接创建功能选项作为二级菜单，不再使用TSNotesPeng父菜单
    
    // 自动粘贴选项
    chrome.contextMenus.create({
      id: 'auto-paste-page',
      title: '自动粘贴链接',
      type: 'checkbox',
      checked: autoPaste,
      contexts: ['all']
    });
    
    // 获取链接菜单项
    chrome.contextMenus.create({
      id: 'get-tsnotes-link-page',
      title: '获取 TSNotes 链接',
      contexts: ['all']
    });
    
    // 创建空白窗口菜单项
    chrome.contextMenus.create({
      id: 'open-tsnotes-window-page',
      title: '创建/打开 TSNotes 窗口',
      contexts: ['all']
    });
    
    // 修改链接菜单项
    chrome.contextMenus.create({
      id: 'change-tsnotes-link-page',
      title: '修改 TSNotes 窗口链接',
      contexts: ['all']
    });
    
    // 页面右键菜单中添加"在TSNotes窗口中打开当前页面"选项
    chrome.contextMenus.create({
      id: 'open-page-in-tsnotes-page',
      title: '在TSNotes窗口中打开当前页面',
      contexts: ['all']
    });
    
    // 添加窗口分割比例设置到页面右键菜单
    chrome.contextMenus.create({
      id: 'split-ratio-page',
      title: '窗口分割比例',
      contexts: ['all']
    });
    
    // 为页面右键菜单添加分割比例选项
    for (const ratio of ratios) {
      chrome.contextMenus.create({
        id: ratio.id + '-page',
        parentId: 'split-ratio-page',
        title: ratio.title,
        type: 'radio',
        checked: Math.abs(screenSplitRatio - ratio.value) < 0.01,
        contexts: ['all']
      });
    }
  });
}

// 修改右键菜单点击事件处理
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'auto-paste' || info.menuItemId === 'auto-paste-page') {
    // 切换自动粘贴设置
    autoPaste = info.checked;
    // 保存设置
    chrome.storage.local.set({ autoPaste: autoPaste });
    console.log('TSNotesPeng: 自动粘贴设置已更改为', autoPaste);
  } else if (info.menuItemId === 'get-tsnotes-link' || info.menuItemId === 'get-tsnotes-link-page') {
    // 执行获取链接功能
    copyCurrentTSNotesLink(false); // 修改为false，表示不强制粘贴，而是遵循autoPaste设置
  } else if (info.menuItemId === 'open-tsnotes-window' || info.menuItemId === 'open-tsnotes-window-page') {
    // 执行创建空白窗口功能
    openBlankTSNotesWindowIfNotExist();
  } else if (info.menuItemId === 'change-tsnotes-link' || info.menuItemId === 'change-tsnotes-link-page') {
    // 执行修改链接功能
    changeTSNotesLink();
  } else if (info.menuItemId === 'open-page-in-tsnotes' || info.menuItemId === 'open-page-in-tsnotes-page') {
    // 执行在TSNotes窗口中打开当前页面功能
    openCurrentPageInTSNotes();
  } else if (info.menuItemId.startsWith('ratio-') && !info.menuItemId.endsWith('-page')) {
    // 设置窗口分割比例 - 插件图标菜单
    const ratio = parseFloat(info.menuItemId.replace('ratio-', ''));
    if (!isNaN(ratio) && ratio > 0 && ratio < 1) {
      screenSplitRatio = ratio;
      chrome.storage.local.set({ screenSplitRatio: ratio });
      console.log('TSNotesPeng: 窗口分割比例已设置为', ratio);
      
      // 如果有活动的TSNotes窗口，立即应用新的分割比例
      applyScreenSplitRatio();
    }
  } else if (info.menuItemId.endsWith('-page') && info.menuItemId.startsWith('ratio-')) {
    // 设置窗口分割比例 - 页面右键菜单
    const ratio = parseFloat(info.menuItemId.replace('ratio-', '').replace('-page', ''));
    if (!isNaN(ratio) && ratio > 0 && ratio < 1) {
      screenSplitRatio = ratio;
      chrome.storage.local.set({ screenSplitRatio: ratio });
      console.log('TSNotesPeng: 窗口分割比例已设置为', ratio);
      
      // 如果有活动的TSNotes窗口，立即应用新的分割比例
      applyScreenSplitRatio();
    }
  }
});

// 应用屏幕分割比例到当前窗口
async function applyScreenSplitRatio() {
  if (!tsNotesWindowId) return;
  
  try {
    // 获取屏幕信息
    const screenInfo = await getScreenInfo();
    
    // 使用新的分割比例
    const tsNotesWidth = Math.floor(screenInfo.width * screenSplitRatio);
    const tsNotesHeight = screenInfo.height;
    
    // 调整TSNotes窗口
    await chrome.windows.update(tsNotesWindowId, {
      width: tsNotesWidth,
      height: tsNotesHeight,
      left: 0,
      top: 0
    });
    
    // 获取当前活动窗口
    const currentWindow = await getCurrentWindow();
    if (currentWindow.id !== tsNotesWindowId) {
      // 调整当前窗口
      const sourceWidth = Math.floor(screenInfo.width * (1 - screenSplitRatio));
      await chrome.windows.update(currentWindow.id, {
        width: sourceWidth,
        height: screenInfo.height,
        left: tsNotesWidth,
        top: 0
      });
    }
    
    console.log('TSNotesPeng: 已应用新的窗口分割比例');
  } catch (e) {
    console.error('TSNotesPeng: 应用窗口分割比例失败', e);
  }
}

// 添加一个通用的窗口布局函数
async function applyWindowLayout(tsNotesWindowId, sourceWindowId) {
  if (!tsNotesWindowId) return false;
  
  try {
    // 获取屏幕信息
    const screenInfo = await getScreenInfo();
    
    // 使用自定义分割比例参数
    const tsNotesRatio = screenSplitRatio;
    
    // 计算TSNotes窗口尺寸和位置
    const tsNotesWidth = Math.floor(screenInfo.width * tsNotesRatio);
    const tsNotesHeight = screenInfo.height;
    
    // 调整TSNotes窗口 - 左侧
    await chrome.windows.update(tsNotesWindowId, {
      width: tsNotesWidth,
      height: tsNotesHeight,
      left: 0,
      top: 0
    });
    
    console.log('TSNotesPeng: TSNotes窗口布局已调整');
    
    // 如果有源窗口ID，调整源窗口 - 右侧
    if (sourceWindowId) {
      // 检测浏览器类型
      const browserInfo = await detectBrowser();
      
      // 根据浏览器类型决定是否调整源窗口
      if (!browserInfo.isArc) { // Arc浏览器不调整
        const sourceWidth = Math.floor(screenInfo.width * (1 - tsNotesRatio));
        await chrome.windows.update(sourceWindowId, {
          width: sourceWidth,
          height: screenInfo.height,
          left: tsNotesWidth,
          top: 0
        });
        console.log('TSNotesPeng: 源窗口布局已调整');
      }
    }
    
    return true;
  } catch (error) {
    console.error('TSNotesPeng: 调整窗口布局失败', error);
    return false;
  }
} 