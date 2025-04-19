// 监听来自后台脚本的消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "showSettingsDialog") {
    showSettingsDialog();
  } else if (message.action === "showSaveDialog") {
    showSaveDialog(message.databaseId);
  }
});

// 显示设置对话框
function showSettingsDialog() {
  // 先获取已保存的设置
  chrome.storage.local.get(["notionToken", "notionDatabaseId", "notificationTimeout"], (result) => {
    // 创建对话框
    createDialog({
      title: "设置Notion API",
      content: `
        <div class="savepage-form">
          <div class="savepage-form-group">
            <label for="notion-token">Notion API令牌</label>
            <input type="text" id="notion-token" placeholder="secret_xxxx" value="${result.notionToken || ''}">
            <small>请在Notion <a href="https://www.notion.so/my-integrations" target="_blank">我的集成</a> 页面创建并获取令牌</small>
          </div>
          <div class="savepage-form-group">
            <label for="notion-database">默认Notion数据库ID (可选)</label>
            <input type="text" id="notion-database" placeholder="数据库ID" value="${result.notionDatabaseId || ''}">
            <small>例如：https://www.notion.so/xxx/<strong>abcdef1234567890abcdef1234567890</strong>?v=...</small>
          </div>
          <div class="savepage-form-group">
            <label for="notification-timeout">通知显示时间 (毫秒)</label>
            <input type="number" id="notification-timeout" min="1000" max="30000" step="1000" value="${result.notificationTimeout || 5000}">
            <small>设置通知消息的显示时间，默认为5000毫秒(5秒)</small>
          </div>
          <div id="settings-status" class="savepage-status ${result.notionToken ? 'success' : ''}">
            ${result.notionToken ? '✓ 已配置Notion API令牌' : '⚠️ 未配置Notion API令牌'}
          </div>
        </div>
      `,
      buttons: [
        {
          text: "保存",
          primary: true,
          onClick: () => {
            const token = document.getElementById("notion-token").value.trim();
            const databaseId = document.getElementById("notion-database").value.trim();
            const timeout = document.getElementById("notification-timeout").value;
            
            if (!token) {
              showNotification("请输入Notion API令牌", "error");
              return;
            }
            
            // 验证通知显示时间
            const notificationTimeout = parseInt(timeout, 10);
            if (isNaN(notificationTimeout) || notificationTimeout < 1000) {
              showNotification("通知显示时间必须大于等于1000毫秒", "error");
              return;
            }
            
            // 保存所有设置
            chrome.storage.local.set({
              notionToken: token,
              notionDatabaseId: databaseId || "",
              notificationTimeout: notificationTimeout
            }, () => {
              console.log("所有设置已保存");
              
              // 更新状态显示
              const statusElement = document.getElementById("settings-status");
              if (statusElement) {
                statusElement.className = "savepage-status success";
                statusElement.textContent = "✓ 设置已保存";
              }
              
              showNotification("设置已保存");
              
              // 如果设置了数据库ID，则关闭设置对话框并立即显示保存对话框
              if (databaseId) {
                closeDialog();
                setTimeout(() => {
                  showSaveDialog(databaseId);
                }, 500);
              }
            });
          }
        },
        {
          text: "取消",
          onClick: () => {
            closeDialog();
          }
        }
      ]
    });
  });
}

// 显示保存对话框
async function showSaveDialog(defaultDatabaseId) {
  try {
    // 获取当前页面信息
    const pageInfo = getPageInfo();
    
    // 创建对话框
    const dialog = createDialog({
      title: "保存到Notion",
      content: `
        <div class="savepage-form">
          <div id="property-mapping" class="savepage-loading">
            <div class="savepage-spinner"></div>
            <span>加载数据库属性...</span>
          </div>
          
          <div class="savepage-cover-preview ${pageInfo.cover ? '' : 'hidden'}">
            <div class="savepage-cover-image">
              <img src="${pageInfo.cover}" onerror="this.style.display='none'">
            </div>
            <div class="savepage-checkbox">
              <input type="checkbox" id="use-as-cover" checked>
              <label for="use-as-cover">设置为Notion页面封面</label>
            </div>
          </div>
        </div>
      `,
      buttons: [
        {
          text: "保存",
          primary: true,
          onClick: () => {
            const databaseId = defaultDatabaseId;
            
            if (!databaseId) {
              showNotification("请先在设置中配置Notion数据库ID", "error");
              closeDialog();
              setTimeout(() => {
                showSettingsDialog();
              }, 300);
              return;
            }

            console.log("开始处理保存请求");
            
            // 获取映射数据
            const mappingData = {};
            const mappingInputs = document.querySelectorAll("[data-property-mapping]:not([data-hidden='true'])");
            
            console.log("找到可用的映射输入元素:", mappingInputs.length);
            
            // 保存用户属性显示/隐藏状态及映射关系
            const propertyVisibility = {};
            const propertyMappings = {};
            
            document.querySelectorAll(".property-visibility-toggle").forEach(toggle => {
              const propertyName = toggle.getAttribute("data-property-name");
              propertyVisibility[propertyName] = toggle.checked;
            });
            
            document.querySelectorAll(".property-data-source").forEach(select => {
              const propertyName = select.getAttribute("data-property-name");
              propertyMappings[propertyName] = select.value;
            });
            
            // 保存用户配置
            chrome.runtime.sendMessage({
              action: "saveUserPreferences",
              propertyVisibility,
              propertyMappings
            });
            
            // 确保至少有一个标题属性
            let hasTitleProperty = false;
            let titlePropertyValue = "";
            
            // 查找标题属性名称
            let titlePropertyName = null;
            
            // 首先收集所有输入数据
            mappingInputs.forEach(input => {
              const propertyName = input.getAttribute("data-property-mapping");
              const propertyType = input.getAttribute("data-property-type");
              
              if (!propertyName || !propertyType) {
                console.warn("发现无效的映射输入:", input);
                return;
              }
              
              console.log(`处理映射输入: ${propertyName} (${propertyType})`);
              
              let value = null;
              
              // 根据属性类型获取值
              if (propertyType === "title" || propertyType === "rich_text" || propertyType === "url") {
                value = input.value.trim();
                if (propertyType === "title") {
                  hasTitleProperty = true;
                  titlePropertyName = propertyName;
                  titlePropertyValue = value;
                }
              } else if (propertyType === "select") {
                value = input.value.trim();
              } else if (propertyType === "multi_select") {
                value = input.value.split(",").map(tag => tag.trim()).filter(tag => tag);
              } else if (propertyType === "checkbox") {
                value = input.checked;
              }
              
              if (value !== null || propertyType === "checkbox") {
                mappingData[propertyName] = {
                  type: propertyType,
                  value: value
                };
                console.log(`已添加映射数据: ${propertyName} = ${JSON.stringify(value)}`);
              }
            });
            
            console.log("收集到的原始映射数据:", mappingData);
            
            // 如果没有标题属性或标题为空，使用页面标题
            if (!hasTitleProperty || !titlePropertyValue) {
              if (titlePropertyName) {
                // 使用已有的标题属性但设置默认值
                console.log(`设置默认标题值: ${titlePropertyName} = ${pageInfo.title || "无标题页面"}`);
                mappingData[titlePropertyName] = {
                  type: "title",
                  value: pageInfo.title || "无标题页面"
                };
              } else {
                // 尝试创建一个名为"Name"的标题属性
                console.log("创建默认的标题属性");
                mappingData["Name"] = {
                  type: "title",
                  value: pageInfo.title || "无标题页面"
                };
                // 移除警告通知，只在控制台输出日志
                console.log("未找到标题属性，已使用默认标题");
              }
            }
            
            // 确保有一个URL属性包含当前页面URL
            let hasUrlProperty = false;
            for (const [propertyName, property] of Object.entries(mappingData)) {
              if (property.type === "url" && property.value) {
                hasUrlProperty = true;
                break;
              }
            }
            
            if (!hasUrlProperty) {
              // 尝试找到一个URL类型的属性
              const urlInput = document.querySelector("[data-property-type='url']");
              if (urlInput) {
                const urlPropertyName = urlInput.getAttribute("data-property-mapping");
                console.log(`找到URL属性: ${urlPropertyName}`);
                mappingData[urlPropertyName] = {
                  type: "url",
                  value: pageInfo.url
                };
              } else {
                // 添加一个名为URL的属性
                console.log("添加默认URL属性");
                mappingData["URL"] = {
                  type: "url",
                  value: pageInfo.url
                };
              }
            }
            
            // 构建页面数据
            console.log("开始构建页面数据");
            const pageData = buildPageData(mappingData);
            
            // 验证页面数据
            if (!pageData || Object.keys(pageData).length === 0) {
              console.error("构建的页面数据为空");
              showNotification("无法构建有效的页面数据，请检查表单输入", "error");
              return;
            }
            
            console.log("成功构建的页面数据:", pageData);
            
            // 获取是否使用封面
            const useCover = pageInfo.cover && document.getElementById("use-as-cover") && document.getElementById("use-as-cover").checked;
            const coverUrl = useCover ? pageInfo.cover : null;
            
            if (coverUrl) {
              console.log("使用封面URL:", coverUrl);
            }
            
            // 显示保存中状态
            showNotification("正在保存到Notion...", "info");
            
            // 超时处理
            let hasResponse = false;
            const timeoutId = setTimeout(() => {
              if (!hasResponse) {
                console.warn("保存到Notion请求超时");
                showNotification("没有收到响应，保存可能失败", "error");
              }
            }, 10000); // 10秒超时
            
            // 保存到Notion
            chrome.runtime.sendMessage({
              action: "saveToNotion",
              databaseId: databaseId,
              url: pageInfo.url,
              pageData: pageData,
              coverUrl: coverUrl
            }, (response) => {
              hasResponse = true;
              clearTimeout(timeoutId);
              
              console.log("保存到Notion的响应:", response);
              
              if (!response) {
                showNotification("没有收到响应，保存可能失败", "error");
                return;
              }
              
              if (response.success) {
                closeDialog();
                
                // 判断是否有警告信息
                if (response.warning) {
                  // 不再显示警告通知，直接显示成功消息
                  showNotification("页面已保存到Notion", "success", {
                    pageId: response.pageId
                  });
                } else {
                  showNotification("页面已保存到Notion", "success", {
                    pageId: response.pageId
                  });
                }
              } else if (response.duplicate) {
                // 不显示警告通知，直接显示"查看已有页面"对话框
                showDuplicateDialog(response.pageId);
              } else {
                showNotification(response.error || "保存失败", "error");
              }
            });
          }
        },
        {
          text: "取消",
          onClick: () => {
            closeDialog();
          }
        },
        {
          text: "设置",
          onClick: () => {
            closeDialog();
            setTimeout(() => {
              showSettingsDialog();
            }, 300);
          }
        }
      ],
      onOpen: () => {
        // 不再需要监听数据库ID输入变化
        
        // 移动封面和属性映射到表单底部
        const form = document.querySelector(".savepage-form");
        const propertyMapping = document.getElementById("property-mapping");
        const coverPreview = document.querySelector(".savepage-cover-preview");
        
        // 如果两个元素都存在，则移动它们
        if (form && propertyMapping && coverPreview) {
          // 暂时移除它们
          propertyMapping.parentNode.removeChild(propertyMapping);
          coverPreview.parentNode.removeChild(coverPreview);
          
          // 重新添加到表单的末尾
          form.appendChild(propertyMapping);
          form.appendChild(coverPreview);
        }
        
        // 如果有默认数据库ID，则加载其属性
        if (defaultDatabaseId) {
          loadDatabaseProperties(defaultDatabaseId);
        } else {
          // 如果没有默认数据库ID，显示提示并关闭对话框
          showNotification("请先在设置中配置Notion数据库ID", "error");
          closeDialog();
          setTimeout(() => {
            showSettingsDialog();
          }, 300);
        }
      }
    });
  } catch (error) {
    console.error("显示保存对话框时出错:", error);
    showNotification("显示保存对话框时出错", "error");
  }
}

// 加载数据库属性
function loadDatabaseProperties(databaseId) {
  const mappingContainer = document.getElementById("property-mapping");
  mappingContainer.className = "savepage-loading";
  mappingContainer.innerHTML = `
    <div class="savepage-spinner"></div>
    <span>加载数据库属性...</span>
  `;
  
  // 获取数据库属性
  chrome.runtime.sendMessage({
    action: "getDatabaseProperties",
    databaseId: databaseId
  }, (response) => {
    if (response.success) {
      // 获取用户偏好设置
      chrome.runtime.sendMessage({
        action: "getUserPreferences"
      }, (prefsResponse) => {
        if (prefsResponse.success) {
          renderPropertyMapping(
            mappingContainer, 
            response.properties, 
            prefsResponse.propertyVisibility || {},
            prefsResponse.propertyMappings || {}
          );
        } else {
          // 如果获取用户偏好失败，使用空对象
          renderPropertyMapping(mappingContainer, response.properties, {}, {});
        }
      });
    } else {
      mappingContainer.className = "savepage-error";
      mappingContainer.innerHTML = `
        <span>获取数据库属性失败: ${response.error || "未知错误"}</span>
      `;
    }
  });
}

// 根据属性类型创建对应输入框
function createPropertyInput(propertyType, propertyName, sourceSelect, pageInfo, isVisible, firstTitleProperty, property) {
  let input;
  let containerElement;
  
  // 根据属性类型创建对应输入框
  if (propertyType === "title" || propertyType === "rich_text") {
    // 标题属性或富文本属性使用textarea
    input = document.createElement("textarea");
    input.className = "savepage-textarea";
    input.rows = 1; // 初始行数
    input.value = propertyType === "title" && sourceSelect.value === "title" ? pageInfo.title : 
                  propertyType === "rich_text" && sourceSelect.value === "description" ? pageInfo.description : "";
    input.setAttribute("data-property-mapping", propertyName);
    input.setAttribute("data-property-type", propertyType);
    
    // 添加自动调整高度的事件
    input.addEventListener("input", function() {
      autoResizeTextarea(this);
    });
    
    // 初始化时自动调整高度
    setTimeout(() => autoResizeTextarea(input), 0);
    
    // 如果不可见则标记
    if (!isVisible && !(propertyType === "title" && propertyName === firstTitleProperty)) {
      input.setAttribute("data-hidden", "true");
    }
    containerElement = input; // Textarea is the main element
  } else if (propertyType === "url") {
    // URL属性
    input = document.createElement("input");
    input.type = "text";
    input.value = sourceSelect.value === "url" ? pageInfo.url : "";
    input.setAttribute("data-property-mapping", propertyName);
    input.setAttribute("data-property-type", propertyType);
    
    // 如果不可见则标记
    if (!isVisible) {
      input.setAttribute("data-hidden", "true");
    }
    containerElement = input; // Input is the main element
  } else if (propertyType === "select") {
    // --- Select 类型改造 --- 
    containerElement = document.createElement("div");
    containerElement.className = "savepage-custom-select-container";
    
    // 隐藏的实际值 input
    const hiddenInput = document.createElement("input");
    hiddenInput.type = "hidden";
    hiddenInput.setAttribute("data-property-mapping", propertyName);
    hiddenInput.setAttribute("data-property-type", propertyType);
    if (!isVisible) {
      hiddenInput.setAttribute("data-hidden", "true");
    }
    containerElement.appendChild(hiddenInput);
    
    // 显示当前值的区域
    const displayArea = document.createElement("div");
    displayArea.className = "savepage-select-display";
    displayArea.tabIndex = 0; // Make it focusable
    displayArea.innerHTML = `<span class="savepage-select-placeholder">-- 选择 --</span><span class="savepage-select-arrow">▼</span>`;
    containerElement.appendChild(displayArea);
    
    // 下拉选项面板
    const optionsPanel = document.createElement("div");
    optionsPanel.className = "savepage-select-options-panel";
    optionsPanel.style.display = "none";
    
    // 搜索框
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "搜索选项...";
    searchInput.className = "savepage-select-search";
    searchInput.addEventListener('input', () => {
      const searchTerm = searchInput.value.toLowerCase();
      const options = optionsPanel.querySelectorAll(".savepage-select-option");
      options.forEach(option => {
        const text = option.textContent.toLowerCase();
        option.style.display = text.includes(searchTerm) ? "" : "none";
      });
    });
    optionsPanel.appendChild(searchInput);
    
    // 选项列表容器
    const optionsList = document.createElement("div");
    optionsList.className = "savepage-select-options-list";
    optionsPanel.appendChild(optionsList);
    
    // 添加选项
    if (property.select && property.select.options) {
      // 添加一个 "-- 无 --" 选项
      const noneOption = document.createElement("div");
      noneOption.className = "savepage-select-option savepage-select-option-none";
      noneOption.textContent = "-- 无 --";
      noneOption.dataset.value = ""; // 空值
      optionsList.appendChild(noneOption);
      
      // 添加数据库中的选项
      property.select.options.forEach(option => {
        const optionEl = document.createElement("div");
        optionEl.className = "savepage-select-option";
        optionEl.textContent = option.name;
        optionEl.dataset.value = option.name;
        if (option.color && option.color !== 'default') {
           const colorDot = document.createElement("span");
           colorDot.className = "savepage-color-dot";
           colorDot.style.backgroundColor = getNotionColor(option.color);
           optionEl.prepend(colorDot);
        }
        optionsList.appendChild(optionEl);
      });
    }
    
    // 统一处理选项点击事件
    optionsList.addEventListener('click', (e) => {
      if (e.target.classList.contains('savepage-select-option')) {
        const selectedValue = e.target.dataset.value;
        const selectedText = e.target.textContent;
        hiddenInput.value = selectedValue;
        // 更新显示区域
        const displaySpan = displayArea.querySelector("span:first-child");
        if (selectedValue === "") {
           displaySpan.textContent = "-- 无 --";
           displaySpan.classList.add('savepage-select-placeholder');
        } else {
           displaySpan.textContent = selectedText;
           displaySpan.classList.remove('savepage-select-placeholder');
           // 移除旧颜色点，添加新颜色点
           const oldDot = displaySpan.querySelector('.savepage-color-dot');
           if (oldDot) oldDot.remove();
           const colorDot = e.target.querySelector('.savepage-color-dot');
           if (colorDot) {
             displaySpan.prepend(colorDot.cloneNode(true));
           }
        }
        optionsPanel.style.display = "none"; // 关闭面板
      }
    });
    
    containerElement.appendChild(optionsPanel);
    
    // --- 事件处理 ---
    // 点击显示区域展开/收起
    displayArea.addEventListener('click', (e) => {
       e.stopPropagation();
       const isVisible = optionsPanel.style.display === 'block';
       optionsPanel.style.display = isVisible ? 'none' : 'block';
       if (!isVisible) {
          searchInput.value = ''; // 清空搜索
          const options = optionsPanel.querySelectorAll(".savepage-select-option");
          options.forEach(option => option.style.display = ""); // 显示所有选项
          searchInput.focus(); // 聚焦搜索框
       }
    });
    
    // 点击搜索框阻止事件冒泡关闭面板
    searchInput.addEventListener('click', (e) => {
        e.stopPropagation();
    });
    
    // 点击页面其他地方关闭
    document.addEventListener('click', (e) => {
      if (!containerElement.contains(e.target)) {
        optionsPanel.style.display = 'none';
      }
    });
    
    // 初始设置值 (如果需要)
    // TBD: Handle initial value setting if necessary

  } else if (propertyType === "multi_select") {
    // 多选属性 - 使用标签选择器
    const multiSelectContainer = document.createElement("div");
    multiSelectContainer.className = "savepage-multi-select-container";
    
    // 创建一个隐藏的input来存储实际值
    const hiddenInput = document.createElement("input");
    hiddenInput.type = "hidden";
    hiddenInput.setAttribute("data-property-mapping", propertyName);
    hiddenInput.setAttribute("data-property-type", propertyType);
    if (!isVisible) {
      hiddenInput.setAttribute("data-hidden", "true");
    }
    multiSelectContainer.appendChild(hiddenInput);
    
    // 创建标签显示区域
    const tagsContainer = document.createElement("div");
    tagsContainer.className = "savepage-tags-container";
    multiSelectContainer.appendChild(tagsContainer);
    
    // 创建输入和选项区域
    const inputContainer = document.createElement("div");
    inputContainer.className = "savepage-input-container";
    
    // 创建文本输入框
    const textInput = document.createElement("input");
    textInput.type = "text";
    textInput.className = "savepage-tag-input";
    textInput.placeholder = "输入或选择选项";
    
    // 创建选项下拉列表 (初始隐藏)
    const optionsList = document.createElement("div");
    optionsList.className = "savepage-options-list";
    optionsList.style.display = "none"; // 确保初始是隐藏的
    
    let activeOptionIndex = -1; // 用于键盘导航
    
    // 函数：更新活动选项的高亮
    const updateActiveOption = () => {
      const optionItems = optionsList.querySelectorAll(".savepage-option-item");
      optionItems.forEach((item, index) => {
        if (index === activeOptionIndex) {
          item.classList.add("active");
          item.scrollIntoView({ block: 'nearest' }); // 滚动到视图
        } else {
          item.classList.remove("active");
        }
      });
    };

    // 函数：构建选项列表内容 (修改: 不再控制显示/隐藏)
    const buildOptionsList = (filter = "") => {
        optionsList.innerHTML = ""; // 清空现有选项
        activeOptionIndex = -1; // 重置键盘导航索引
        let hasOptionsToShow = false; // 标记是否有选项可显示
        if (property.multi_select && property.multi_select.options) {
            const lowerFilter = filter.trim().toLowerCase();
            const filteredOptions = property.multi_select.options.filter(opt => 
                opt.name.toLowerCase().includes(lowerFilter)
            );

            if (filteredOptions.length > 0) {
                hasOptionsToShow = true; // 有选项
                filteredOptions.forEach(option => {
                    const optionItem = document.createElement("div");
                    optionItem.className = "savepage-option-item";
                    optionItem.textContent = option.name;
                    optionItem.dataset.value = option.name; // 添加data-value
                    if (option.color) {
                        optionItem.dataset.color = option.color;
                        const colorDot = document.createElement("span");
                        colorDot.className = "savepage-color-dot";
                        colorDot.style.backgroundColor = getNotionColor(option.color);
                        optionItem.prepend(colorDot);
                    }
                    
                    // 点击选项添加标签 (用 mousedown 替代 click 解决 blur 先触发的问题)
                    optionItem.addEventListener("mousedown", (e) => {
                         e.preventDefault(); // 阻止输入框失去焦点
                         addTag(option.name, tagsContainer, hiddenInput, option.color);
                         textInput.value = "";
                         optionsList.style.display = "none"; // 选择后隐藏
                         textInput.focus();
                    });
                    
                    optionsList.appendChild(optionItem);
                });
            } 
        } 
        return hasOptionsToShow; // 返回是否有选项
    };

    // 仅构建列表，不显示
    buildOptionsList(); 
    
    // 输入框获取焦点时显示选项
    textInput.addEventListener("focus", () => {
      // 构建列表并根据结果决定是否显示
      const hasOptions = buildOptionsList(textInput.value);
      if (hasOptions) {
        optionsList.style.display = "block"; 
      } else {
        optionsList.style.display = "none";
      }
    });
    
    // 输入框失去焦点时隐藏选项
    textInput.addEventListener("blur", (e) => {
      // 延迟隐藏，允许mousedown事件触发
      setTimeout(() => {
         if (!optionsList.matches(':hover')) { // 如果鼠标不在选项列表上
            optionsList.style.display = "none";
            const value = textInput.value.trim();
            if (value) { // 如果失去焦点时仍有未确认输入，则添加为新标签
               addTag(value, tagsContainer, hiddenInput);
               textInput.value = "";
            }
         }
      }, 150);
    });
    
    // 监听键盘事件 (修改: build后判断是否显示)
    textInput.addEventListener("keydown", (e) => {
      const optionItems = optionsList.querySelectorAll(".savepage-option-item");
      const isOptionsVisible = optionsList.style.display === 'block';

      if (isOptionsVisible) {
         if (e.key === "ArrowDown") {
           e.preventDefault();
           activeOptionIndex = (activeOptionIndex + 1) % optionItems.length;
           updateActiveOption();
         } else if (e.key === "ArrowUp") {
           e.preventDefault();
           activeOptionIndex = (activeOptionIndex - 1 + optionItems.length) % optionItems.length;
           updateActiveOption();
         } else if (e.key === "Enter") {
           e.preventDefault();
           if (activeOptionIndex >= 0 && activeOptionIndex < optionItems.length) {
             // 添加高亮选中的选项
             const selectedOption = optionItems[activeOptionIndex];
             addTag(selectedOption.dataset.value, tagsContainer, hiddenInput, selectedOption.dataset.color);
           } else {
             // 如果没有高亮选项，且输入框有值，则添加输入框的值
             const value = textInput.value.trim();
             if (value) {
                 let matchingOption = null;
                 if (property.multi_select && property.multi_select.options) {
                    matchingOption = property.multi_select.options.find(opt => opt.name.toLowerCase() === value.toLowerCase());
                 }
                 if (matchingOption) {
                    addTag(matchingOption.name, tagsContainer, hiddenInput, matchingOption.color);
                 } else {
                    addTag(value, tagsContainer, hiddenInput);
                 }
             }
           }
           textInput.value = "";
           buildOptionsList(); // 重置并隐藏选项列表
           optionsList.style.display = 'none';
         } else if (e.key === "Escape") {
             optionsList.style.display = 'none';
         }
      } else if (e.key === "Enter") {
          // 如果选项列表不可见，回车键直接添加输入内容
          e.preventDefault();
          const value = textInput.value.trim();
          if (value) {
             addTag(value, tagsContainer, hiddenInput);
             textInput.value = "";
          }
      }

      // 处理退格键删除标签
      if (e.key === "Backspace" && textInput.value === "") {
        const lastTag = tagsContainer.querySelector(".savepage-tag:last-child");
        if (lastTag) {
          tagsContainer.removeChild(lastTag);
          updateHiddenInput(tagsContainer, hiddenInput);
        }
      }
    });
    
    // 输入时过滤选项 (修改: build后判断是否显示)
    textInput.addEventListener("input", () => {
       const hasOptions = buildOptionsList(textInput.value);
       if (hasOptions) {
         optionsList.style.display = "block";
       } else {
         optionsList.style.display = "none";
       }
    });
    
    inputContainer.appendChild(textInput);
    inputContainer.appendChild(optionsList);
    multiSelectContainer.appendChild(inputContainer);
    
    containerElement = multiSelectContainer;
  
  } else if (propertyType === "checkbox") {
    // 复选框属性
    const checkboxWrapper = document.createElement("div");
    checkboxWrapper.className = "savepage-checkbox";
    
    input = document.createElement("input");
    input.type = "checkbox";
    input.id = `checkbox-${propertyName}`;
    input.setAttribute("data-property-mapping", propertyName);
    input.setAttribute("data-property-type", propertyType);
    
    // 如果不可见则标记
    if (!isVisible) {
      input.setAttribute("data-hidden", "true");
    }
    
    const checkboxLabel = document.createElement("label");
    checkboxLabel.htmlFor = `checkbox-${propertyName}`;
    checkboxLabel.textContent = "是";
    
    checkboxWrapper.appendChild(input);
    checkboxWrapper.appendChild(checkboxLabel);
    
    containerElement = checkboxWrapper; // The wrapper div is the main element
  } else {
    // 其他类型，使用普通输入框
    input = document.createElement("input");
    input.type = "text";
    input.setAttribute("data-property-mapping", propertyName);
    input.setAttribute("data-property-type", propertyType);
    
    // 如果不可见则标记
    if (!isVisible) {
      input.setAttribute("data-hidden", "true");
    }
    containerElement = input; // Input is the main element
  }
  
  return containerElement;
}

// 获取Notion颜色对应的CSS颜色
function getNotionColor(colorName) {
  const colorMap = {
    "default": "#cccccc", // 给 default 一个可见的灰色
    "gray": "#9b9a97",
    "brown": "#64473a",
    "orange": "#d9730d",
    "yellow": "#dfab01",
    "green": "#0f7b6c",
    "blue": "#0b6e99",
    "purple": "#6940a5",
    "pink": "#ad1a72",
    "red": "#e03e3e"
  };
  
  return colorMap[colorName] || "#cccccc"; // 默认返回灰色
}

// 添加标签
function addTag(tagName, container, hiddenInput, color) {
  // 防止重复添加相同标签
  const existingTags = container.querySelectorAll(".savepage-tag");
  for (const tag of existingTags) {
    if (tag.dataset.value.toLowerCase() === tagName.toLowerCase()) {
      return; // 已经存在相同标签，不再添加
    }
  }
  
  const tag = document.createElement("div");
  tag.className = "savepage-tag";
  tag.dataset.value = tagName;
  
  if (color) {
    tag.dataset.color = color;
    tag.style.backgroundColor = `${getNotionColor(color)}22`; // 添加透明度
    tag.style.color = getNotionColor(color);
    tag.style.borderColor = `${getNotionColor(color)}66`; // 添加透明度
  }
  
  const tagText = document.createElement("span");
  tagText.textContent = tagName;
  tag.appendChild(tagText);
  
  const removeBtn = document.createElement("span");
  removeBtn.className = "savepage-tag-remove";
  removeBtn.innerHTML = "&times;";
  removeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    container.removeChild(tag);
    updateHiddenInput(container, hiddenInput);
  });
  
  tag.appendChild(removeBtn);
  container.appendChild(tag);
  updateHiddenInput(container, hiddenInput);
}

// 更新隐藏输入框的值
function updateHiddenInput(container, hiddenInput) {
  const tags = Array.from(container.querySelectorAll(".savepage-tag"));
  const values = tags.map(tag => tag.dataset.value);
  hiddenInput.value = values.join(",");
}

// 添加拖拽排序功能
function initializeDragSort(container) {
  const rows = container.querySelectorAll('.savepage-property-row');
  let draggedElement = null;
  let placeholder = null;
  let initialY = 0;
  let offsetY = 0;

  // 为每个属性行添加拖拽功能
  rows.forEach(row => {
    // 添加拖动手柄
    const dragHandle = document.createElement('div');
    dragHandle.className = 'savepage-drag-handle';
    dragHandle.innerHTML = '⋮⋮';
    dragHandle.title = '拖动调整顺序';
    
    // 插入到标签组之前
    const labelGroup = row.querySelector('.savepage-label-group');
    if (labelGroup) {
      row.insertBefore(dragHandle, labelGroup);
    }
    
    // 设置为可拖动
    row.setAttribute('draggable', 'true');
    
    // 添加拖动事件监听器
    row.addEventListener('dragstart', (e) => {
      draggedElement = row;
      initialY = e.clientY;
      
      // 创建占位符
      placeholder = document.createElement('div');
      placeholder.className = 'savepage-placeholder';
      placeholder.style.height = `${row.offsetHeight}px`;
      
      // 设置拖动效果
      setTimeout(() => {
        row.classList.add('savepage-dragging');
      }, 0);
      
      // 设置拖动数据
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', ''); // 必须设置一些数据以启用拖动
    });
    
    row.addEventListener('dragend', () => {
      if (draggedElement) {
        draggedElement.classList.remove('savepage-dragging');
        draggedElement = null;
      }
      
      if (placeholder && placeholder.parentNode) {
        placeholder.parentNode.removeChild(placeholder);
      }
      
      placeholder = null;
      
      // 保存当前顺序（可以扩展功能）
      savePropertyOrder(container);
    });
    
    // 拖动经过其他元素
    row.addEventListener('dragover', (e) => {
      e.preventDefault(); // 允许放置
      
      if (!draggedElement || draggedElement === row) {
        return;
      }
      
      // 获取当前行的位置
      const rect = row.getBoundingClientRect();
      const middleY = rect.top + rect.height / 2;
      
      // 根据鼠标位置确定是放在目标元素之前还是之后
      if (e.clientY < middleY) {
        // 放在目标元素之前
        if (placeholder && placeholder.parentNode) {
          placeholder.parentNode.removeChild(placeholder);
        }
        row.parentNode.insertBefore(placeholder, row);
      } else {
        // 放在目标元素之后
        if (placeholder && placeholder.parentNode) {
          placeholder.parentNode.removeChild(placeholder);
        }
        row.parentNode.insertBefore(placeholder, row.nextSibling);
      }
    });
    
    // 处理放置事件
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      
      if (!draggedElement || draggedElement === row) {
        return;
      }
      
      // 获取放置位置
      let insertBefore = null;
      if (placeholder) {
        insertBefore = placeholder.nextSibling;
        placeholder.parentNode.removeChild(placeholder);
      }
      
      // 移动被拖拽的元素到新位置
      draggedElement.parentNode.removeChild(draggedElement);
      
      if (insertBefore) {
        row.parentNode.insertBefore(draggedElement, insertBefore);
      } else {
        row.parentNode.appendChild(draggedElement);
      }
      
      draggedElement.classList.remove('savepage-dragging');
      draggedElement = null;
    });
  });
}

// 保存属性顺序
function savePropertyOrder(container) {
  // 获取当前顺序
  const rows = container.querySelectorAll('.savepage-property-row');
  const orderData = {};
  
  rows.forEach((row, index) => {
    const propertyName = row.getAttribute('data-property-name');
    if (propertyName) {
      orderData[propertyName] = index;
    }
  });
  
  // 保存到本地存储
  chrome.storage.local.get(['propertyOrder'], (result) => {
    const newPropertyOrder = result.propertyOrder || {};
    chrome.storage.local.set({
      propertyOrder: {
        ...newPropertyOrder,
        ...orderData
      }
    });
  });
}

// 渲染属性映射界面
function renderPropertyMapping(container, properties, propertyVisibility, propertyMappings) {
  const pageInfo = getPageInfo();
  
  // 清空容器内容，移除加载状态
  container.innerHTML = "";
  container.className = "";
  
  // 找到标题属性以确保至少有一个标题属性被填充
  let hasTitleProperty = false;
  let firstTitleProperty = null;
  
  // 首先预处理找到标题属性
  for (const [propertyName, property] of Object.entries(properties)) {
    if (property.type === "title") {
      hasTitleProperty = true;
      if (!firstTitleProperty) {
        firstTitleProperty = propertyName;
      }
      break;
    }
  }
  
  // 如果没有找到标题属性，显示警告
  if (!hasTitleProperty) {
    const warningDiv = document.createElement("div");
    warningDiv.className = "savepage-warning";
    warningDiv.textContent = "提示：Notion数据库需要至少一个标题属性，系统将自动创建标题属性。";
    container.appendChild(warningDiv);
  }
  
  // 创建属性映射表单
  const mappingForm = document.createElement("div");
  mappingForm.className = "savepage-mapping-form";
  
  // 获取可用的数据来源
  const dataSources = {
    title: "网页标题",
    url: "网页URL",
    description: "网页描述",
    domain: "网站域名",
    time: "当前时间"
  };
  
  // 获取已保存的属性顺序
  chrome.storage.local.get(['propertyOrder'], (result) => {
    let propertyOrder = result.propertyOrder || {};
    
    // 准备属性列表，包括顺序信息
    let propertyItems = Object.entries(properties).map(([propertyName, property]) => {
      return {
        name: propertyName,
        property: property,
        order: propertyOrder[propertyName] !== undefined ? propertyOrder[propertyName] : 999
      };
    });
    
    // 按顺序排序，未设置顺序的放在最后
    propertyItems.sort((a, b) => a.order - b.order);
    
    // 遍历排序后的属性
    propertyItems.forEach(({ name: propertyName, property }) => {
      const propertyType = property.type;
      
      // 创建属性映射行
      const row = document.createElement("div");
      row.className = "savepage-property-row";
      row.setAttribute("data-property-name", propertyName);
      
      // 根据保存的可见性设置初始状态
      const isVisible = propertyVisibility[propertyName] !== undefined 
        ? propertyVisibility[propertyName] 
        : true;
      
      // 如果是标题属性且是第一个标题属性，强制显示
      if (propertyType === "title" && propertyName === firstTitleProperty) {
        row.classList.remove("hidden");
      } else if (!isVisible) {
        row.classList.add("hidden");
      }
      
      // 创建属性名称和数据源选择器部分
      const labelGroup = document.createElement("div");
      labelGroup.className = "savepage-label-group";
      
      const label = document.createElement("label");
      label.textContent = propertyName;
      labelGroup.appendChild(label);
      
      // 添加数据源选择器
      const sourceSelect = document.createElement("select");
      sourceSelect.className = "property-data-source";
      sourceSelect.setAttribute("data-property-name", propertyName);
      
      // 添加空选项
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = "-- 手动输入 --";
      sourceSelect.appendChild(emptyOption);
      
      // 根据属性类型决定可用的数据源
      for (const [sourceKey, sourceLabel] of Object.entries(dataSources)) {
        // 过滤掉不兼容的数据源
        if (
          (propertyType === "url" && sourceKey !== "url") ||
          (propertyType === "checkbox" && ![].includes(sourceKey))
        ) {
          continue;
        }
        
        const option = document.createElement("option");
        option.value = sourceKey;
        option.textContent = sourceLabel;
        sourceSelect.appendChild(option);
      }
      
      // 设置默认选中的数据源
      if (propertyMappings[propertyName]) {
        sourceSelect.value = propertyMappings[propertyName];
      } else {
        // 根据属性类型设置默认数据源
        if (propertyType === "title") {
          sourceSelect.value = "title";
        } else if (propertyType === "url") {
          sourceSelect.value = "url";
        } else if (propertyType === "rich_text" && propertyName.toLowerCase().includes("description")) {
          sourceSelect.value = "description";
        }
      }
      
      // 监听数据源选择变化
      sourceSelect.addEventListener("change", () => {
        const input = row.querySelector("[data-property-mapping]");
        if (!input) return;
        
        const selectedSource = sourceSelect.value;
        if (selectedSource) {
          // 使用选定的数据源填充
          if (selectedSource === "title") {
            input.value = pageInfo.title;
          } else if (selectedSource === "url") {
            input.value = pageInfo.url;
          } else if (selectedSource === "description") {
            input.value = pageInfo.description;
          } else if (selectedSource === "domain") {
            input.value = pageInfo.domain;
          } else if (selectedSource === "time") {
            const now = new Date();
            input.value = now.toLocaleString();
          }
          
          // 如果是textarea，自动调整高度
          if (input.tagName.toLowerCase() === 'textarea') {
            setTimeout(() => autoResizeTextarea(input), 0);
          }
          
          // 处理multi-select类型
          if (propertyType === "multi_select") {
            const multiSelectContainer = row.querySelector(".savepage-multi-select-container");
            if (multiSelectContainer && input.value) {
              const tagsContainer = multiSelectContainer.querySelector(".savepage-tags-container");
              const tags = input.value.split(",").map(tag => tag.trim()).filter(tag => tag);
              
              // 清空现有标签
              tagsContainer.innerHTML = "";
              
              // 添加新标签
              tags.forEach(tag => {
                // 检查是否是预定义选项
                let matchingOption = null;
                if (property.multi_select && property.multi_select.options) {
                  matchingOption = property.multi_select.options.find(opt => 
                    opt.name.toLowerCase() === tag.toLowerCase()
                  );
                }
                
                if (matchingOption) {
                  addTag(matchingOption.name, tagsContainer, input, matchingOption.color);
                } else {
                  addTag(tag, tagsContainer, input);
                }
              });
            }
          }
        }
      });
      
      labelGroup.appendChild(sourceSelect);
      row.appendChild(labelGroup);
      
      // 使用新的创建输入框函数
      const inputElement = createPropertyInput(propertyType, propertyName, sourceSelect, pageInfo, isVisible, firstTitleProperty, property);
      
      // 添加输入元素到行
      if (inputElement) {
        row.appendChild(inputElement);
      }
      
      // 添加行到映射表单
      mappingForm.appendChild(row);
      
      // 初始触发数据源变更事件
      if (sourceSelect.value) {
        const event = new Event("change");
        sourceSelect.dispatchEvent(event);
      }
    });
    
    container.appendChild(mappingForm);
    
    // 初始化拖拽排序
    initializeDragSort(mappingForm);
    
    // 创建控制按钮
    const showAllButton = document.createElement("button");
    showAllButton.className = "savepage-control-button";
    showAllButton.textContent = "全部显示";
    
    const hideAllButton = document.createElement("button");
    hideAllButton.className = "savepage-control-button";
    hideAllButton.textContent = "全部隐藏";
    
    // 添加按钮事件处理
    showAllButton.addEventListener("click", () => {
      document.querySelectorAll(".property-visibility-toggle").forEach(toggle => {
        toggle.checked = true;
        const propertyRow = document.querySelector(`.savepage-property-row[data-property-name="${toggle.getAttribute("data-property-name")}"]`);
        if (propertyRow) {
          propertyRow.classList.remove("hidden");
          const input = propertyRow.querySelector("[data-property-mapping]");
          if (input) {
            input.removeAttribute("data-hidden");
          }
        }
      });
      
      // 保存属性可见性状态
      savePropertyVisibility();
    });
    
    hideAllButton.addEventListener("click", () => {
      document.querySelectorAll(".property-visibility-toggle").forEach(toggle => {
        // 如果是标题类型，确保至少有一个被选中
        const propertyType = toggle.getAttribute("data-property-type");
        if (propertyType === "title") {
          // 不隐藏标题属性
          return;
        }
        
        toggle.checked = false;
        const propertyRow = document.querySelector(`.savepage-property-row[data-property-name="${toggle.getAttribute("data-property-name")}"]`);
        if (propertyRow) {
          propertyRow.classList.add("hidden");
          const input = propertyRow.querySelector("[data-property-mapping]");
          if (input) {
            input.setAttribute("data-hidden", "true");
          }
        }
      });
      
      // 保存属性可见性状态
      savePropertyVisibility();
    });
    
    const buttonGroup = document.createElement("div");
    buttonGroup.className = "savepage-control-buttons";
    buttonGroup.appendChild(showAllButton);
    buttonGroup.appendChild(hideAllButton);
    
    // 创建属性列表控制面板
    const controlPanel = document.createElement("div");
    controlPanel.className = "savepage-control-panel";
    
    // 创建折叠/展开的标题区域
    const controlHeader = document.createElement("div");
    controlHeader.className = "savepage-control-header";
    
    // 修改标题元素，添加折叠/展开功能
    const controlPanelTitle = document.createElement("div");
    controlPanelTitle.className = "savepage-control-title";
    controlPanelTitle.innerHTML = '<span class="savepage-expand-icon">▶</span> 属性映射设置';
    controlPanelTitle.style.cursor = "pointer";
    
    controlHeader.appendChild(controlPanelTitle);
    controlHeader.appendChild(buttonGroup);
    controlPanel.appendChild(controlHeader);
    
    // 创建可折叠的内容容器
    const collapsibleContent = document.createElement("div");
    collapsibleContent.className = "savepage-collapsible-content";
    collapsibleContent.style.display = "none"; // 默认隐藏
    
    const propertyToggles = document.createElement("div");
    propertyToggles.className = "savepage-property-toggles";
    
    // 创建属性可见性切换开关
    for (const [propertyName, property] of Object.entries(properties)) {
      const propertyType = property.type;
      
      const toggleWrapper = document.createElement("div");
      toggleWrapper.className = "savepage-property-toggle-item";
      
      const toggle = document.createElement("input");
      toggle.type = "checkbox";
      toggle.className = "property-visibility-toggle";
      toggle.id = `toggle-${propertyName}`;
      toggle.setAttribute("data-property-name", propertyName);
      toggle.setAttribute("data-property-type", propertyType);
      
      // 设置默认值，如果有保存的配置则使用，否则默认勾选
      const isVisible = propertyVisibility[propertyName] !== undefined 
        ? propertyVisibility[propertyName] 
        : true;
      
      // 如果是标题属性且是第一个标题属性，强制显示并禁用切换
      if (propertyType === "title" && propertyName === firstTitleProperty) {
        toggle.checked = true;
        toggle.disabled = true;
        toggleWrapper.classList.add("disabled");
      } else {
        toggle.checked = isVisible;
      }
      
      const toggleLabel = document.createElement("label");
      toggleLabel.htmlFor = `toggle-${propertyName}`;
      toggleLabel.textContent = propertyName;
      
      // 添加属性类型标签
      const typeLabel = document.createElement("span");
      typeLabel.className = "savepage-property-type";
      typeLabel.textContent = getPropertyTypeLabel(propertyType);
      
      toggle.addEventListener("change", () => {
        const isChecked = toggle.checked;
        const propertyRow = document.querySelector(`.savepage-property-row[data-property-name="${propertyName}"]`);
        if (propertyRow) {
          if (isChecked) {
            propertyRow.classList.remove("hidden");
            const input = propertyRow.querySelector("[data-property-mapping]");
            if (input) {
              input.removeAttribute("data-hidden");
            }
          } else {
            propertyRow.classList.add("hidden");
            const input = propertyRow.querySelector("[data-property-mapping]");
            if (input) {
              input.setAttribute("data-hidden", "true");
            }
          }
        }
      });
      
      toggleWrapper.appendChild(toggle);
      toggleWrapper.appendChild(toggleLabel);
      toggleWrapper.appendChild(typeLabel);
      propertyToggles.appendChild(toggleWrapper);
    }
    
    // 将属性切换列表添加到可折叠内容中
    collapsibleContent.appendChild(propertyToggles);
    
    // 将可折叠内容添加到控制面板
    controlPanel.appendChild(collapsibleContent);
    
    // 添加折叠/展开功能
    controlHeader.addEventListener("click", () => {
      const expandIcon = controlHeader.querySelector(".savepage-expand-icon"); // 从 header 获取 icon
      const isCollapsed = collapsibleContent.style.maxHeight === "0px" || collapsibleContent.style.display === 'none';

      if (isCollapsed) {
        // 展开
        collapsibleContent.style.display = "block"; // 先设为 block 以便计算高度
        // collapsibleContent.style.maxHeight = collapsibleContent.scrollHeight + "px"; // 可以添加动画效果
        collapsibleContent.style.opacity = "1";
        if(expandIcon) expandIcon.textContent = "▼";
        
        // 展开后初始化属性可见性切换功能
        setTimeout(() => {
          fixPropertyVisibilityToggle();
        }, 100); // 稍作延迟确保元素渲染完成
      } else {
        // 收起
        // collapsibleContent.style.maxHeight = "0px"; // 可以添加动画效果
        collapsibleContent.style.opacity = "0";
        if(expandIcon) expandIcon.textContent = "▶";
        // 使用 setTimeout 延迟隐藏，以便动画完成
        setTimeout(() => {
           collapsibleContent.style.display = "none";
        }, 300); // 延迟时间应与 CSS transition 时间匹配
      }
    });
    
    container.appendChild(controlPanel);
  });

  // 初始化折叠状态的样式 (确保动画效果初始正确)
  collapsibleContent.style.maxHeight = "0px";
  collapsibleContent.style.opacity = "0";
  collapsibleContent.style.transition = 'max-height 0.3s ease, opacity 0.2s ease'; // 添加CSS过渡
  collapsibleContent.style.overflow = 'hidden';
}

// 添加对话框样式
function addDialogStyles() {
  if (document.getElementById("savepage-styles")) {
    // 如果样式已存在，可以选择移除并重新添加，或者直接返回
    // 这里选择移除并重新添加，确保总是应用最新样式
    document.getElementById("savepage-styles").remove();
  }
  
  const styleEl = document.createElement("style");
  styleEl.id = "savepage-styles";
  styleEl.textContent = `
    :root {
      --savepage-primary-color: #2196f3;
      --savepage-primary-color-dark: #1976d2;
      --savepage-text-color: #333;
      --savepage-text-color-secondary: #666;
      --savepage-border-color: #e0e0e0;
      --savepage-background-color: #f9f9f9;
      --savepage-highlight-bg: #e3f2fd;
      --savepage-highlight-border: #90caf9;
      --savepage-error-color: #f44336;
      --savepage-warning-color: #ff9800;
      --savepage-success-color: #4caf50;
      --savepage-dialog-width: 360px; /* 稍微减小宽度 */
      --savepage-border-radius: 4px;
    }

    /* 对话框容器 - 保持不变 */
    .savepage-dialog-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: transparent; /* Or rgba(0,0,0,0.1) for subtle overlay */
      display: flex;
      justify-content: flex-end;
      align-items: flex-start;
      z-index: 9999999;
      padding-top: 8px; /* 增加顶部间距 */
      padding-right: 8px;
      pointer-events: none;
    }
    
    /* 对话框主体 */
    .savepage-dialog {
      background-color: white;
      border-radius: var(--savepage-border-radius);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      width: var(--savepage-dialog-width);
      max-width: 95%;
      max-height: calc(100vh - 16px); /* 考虑上下 padding */
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: slideIn 0.25s ease-out;
      pointer-events: auto;
    }
    
    @keyframes slideIn { /* 动画保持不变 */
      from { opacity: 0; transform: translateX(15px); }
      to { opacity: 1; transform: translateX(0); }
    }
    
    /* 对话框头部 */
    .savepage-dialog-header {
      padding: 8px 10px;
      background-color: var(--savepage-primary-color);
      color: white;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    }
    
    .savepage-dialog-header h2 {
      margin: 0;
      font-size: 14px;
      font-weight: 500;
      color: white;
    }
    
    .savepage-close-button {
      background: none;
      border: none;
      cursor: pointer;
      font-size: 18px;
      color: white;
      opacity: 0.8;
      padding: 0 4px;
      line-height: 1;
    }
    .savepage-close-button:hover { opacity: 1; }
    
    /* 对话框内容区域 */
    .savepage-dialog-content {
      padding: 10px;
      overflow-y: auto;
      flex-grow: 1; /* 占据剩余空间 */
      font-size: 13px;
      background-color: #fff; /* 内容区背景 */
    }
    
    /* 对话框底部 */
    .savepage-dialog-footer {
      padding: 8px 10px;
      border-top: 1px solid var(--savepage-border-color);
      display: flex;
      justify-content: flex-end;
      gap: 6px;
      background-color: var(--savepage-background-color);
      flex-shrink: 0;
    }

    /* --- 表单通用样式 --- */
    .savepage-form {
      display: flex;
      flex-direction: column;
      gap: 12px; /* 表单内主间距 */
    }

    .savepage-form-group {
      display: flex;
      flex-direction: column;
      gap: 4px; /* 组内标签和输入框间距 */
    }
    
    .savepage-form-group label,
    .savepage-property-row .savepage-label-group label {
      font-weight: 500;
      font-size: 12px;
      color: var(--savepage-text-color);
      margin-bottom: 2px; /* 标签和输入框的细微间距 */
    }
    
    .savepage-form-group input[type="text"],
    .savepage-form-group input[type="number"],
    .savepage-form-group select,
    .savepage-textarea,
    .savepage-tag-input {
      padding: 5px 8px; /* 统一内边距 */
      border: 1px solid var(--savepage-border-color);
      border-radius: var(--savepage-border-radius);
      font-size: 12px;
      transition: border-color 0.2s, box-shadow 0.2s;
      width: 100%;
      box-sizing: border-box;
    }
    
    .savepage-form-group input:focus,
    .savepage-form-group select:focus,
    .savepage-textarea:focus,
    .savepage-tag-input:focus,
    .savepage-custom-select-container .savepage-select-display:focus,
    .savepage-multi-select-container:focus-within {
      border-color: var(--savepage-primary-color);
      outline: none;
      box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.2);
    }
    
    .savepage-form-group small {
      font-size: 10px;
      color: var(--savepage-text-color-secondary);
      margin-top: 2px;
    }
    
    .savepage-checkbox {
      display: flex;
      align-items: center;
      gap: 5px;
      margin-top: 3px;
      cursor: pointer;
      font-size: 12px;
      color: var(--savepage-text-color);
    }
    
    .savepage-checkbox input {
      accent-color: var(--savepage-primary-color);
      margin: 0;
      width: 13px;
      height: 13px;
    }
    .savepage-checkbox label {
       margin: 0;
       font-weight: normal;
       font-size: 12px;
       color: var(--savepage-text-color);
    }

    /* --- 按钮样式 --- */
    .savepage-button,
    .savepage-control-button {
      padding: 4px 10px; /* 调整按钮内边距 */
      border: 1px solid var(--savepage-border-color);
      border-radius: var(--savepage-border-radius);
      background-color: white;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      transition: all 0.2s;
      color: var(--savepage-text-color);
      line-height: 1.4;
    }
    
    .savepage-button.primary {
      background-color: var(--savepage-primary-color);
      color: white;
      border-color: var(--savepage-primary-color);
    }
    
    .savepage-button.primary:hover {
      background-color: var(--savepage-primary-color-dark);
      border-color: var(--savepage-primary-color-dark);
    }
    
    .savepage-button:not(.primary):hover,
    .savepage-control-button:hover {
      background-color: #f5f5f5;
      border-color: #ccc;
    }

    .savepage-control-button {
        padding: 3px 8px;
        font-size: 11px;
    }

    /* --- 封面预览 --- */
    .savepage-cover-preview {
      border: 1px solid var(--savepage-border-color);
      border-radius: var(--savepage-border-radius);
      overflow: hidden;
      margin-top: 8px; /* 与上方间距 */
    }
    .savepage-cover-preview.hidden { display: none; }
    
    .savepage-cover-image {
      width: 100%;
      height: 100px; /* 减小高度 */
      overflow: hidden;
      background-color: #eee;
    }
    .savepage-cover-image img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block; /* 修复图片下方空隙 */
    }
    .savepage-cover-preview .savepage-checkbox {
      padding: 6px 8px;
      background-color: var(--savepage-background-color);
    }

    /* --- 属性映射区域 --- */
    #property-mapping {
      margin-top: 8px; /* 与上方间距 */
    }
    .savepage-mapping-form {
      display: flex;
      flex-direction: column;
      gap: 6px; /* 属性行之间的间距 */
    }

    /* 单个属性行 */
    .savepage-property-row {
      display: flex;
      flex-direction: column;
      gap: 5px;
      padding: 8px; /* 内边距 */
      border: 1px solid var(--savepage-border-color);
      border-radius: var(--savepage-border-radius);
      background-color: #fff;
      transition: box-shadow 0.2s;
      font-size: 12px;
      position: relative;
    }
    .savepage-property-row:hover {
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
    }
    .savepage-property-row.hidden { display: none !important; }
    
    /* 拖动手柄 */
    .savepage-drag-handle {
      position: absolute;
      left: -2px; /* 调整位置 */
      top: 0;
      bottom: 0;
      width: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: move;
      color: #ccc;
      font-size: 14px;
      line-height: 1;
      user-select: none;
      transition: color 0.2s;
    }
    .savepage-property-row:hover .savepage-drag-handle { color: #999; }
    .savepage-drag-handle:hover { color: var(--savepage-primary-color); }
    
    /* 属性标签和数据源选择 */
    .savepage-label-group {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      padding-left: 14px; /* 为拖动手柄留出空间 */
    }
    .property-data-source {
      padding: 2px 5px;
      border-radius: 3px;
      border: 1px solid var(--savepage-border-color);
      font-size: 10px;
      color: var(--savepage-text-color-secondary);
      background-color: #fff;
    }
    
    /* 拖动占位符 */
    .savepage-dragging { opacity: 0.6; border-style: dashed; }
    .savepage-placeholder {
      border: 1px dashed var(--savepage-highlight-border);
      background-color: var(--savepage-highlight-bg);
      border-radius: var(--savepage-border-radius);
      margin: 6px 0; /* 与其他行保持一致间距 */
      box-sizing: border-box;
    }

    /* Textarea 自适应高度 */
    .savepage-textarea {
      resize: none;
      overflow: hidden;
      min-height: 29px; /* 与 input 大致对齐 */
      line-height: 1.4;
      font-family: inherit;
    }

    /* --- 自定义 Select --- */
    .savepage-custom-select-container {
      position: relative;
      width: 100%;
      font-size: 12px;
    }
    .savepage-select-display {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 5px 8px; /* 与 input 统一 */
      border: 1px solid var(--savepage-border-color);
      border-radius: var(--savepage-border-radius);
      cursor: pointer;
      background-color: white;
      transition: border-color 0.2s, box-shadow 0.2s;
      min-height: 29px; 
    }
    .savepage-select-placeholder { color: #999; }
    .savepage-select-display span:first-child { /* For value display */
      flex-grow: 1;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      display: flex; 
      align-items: center;
    }
    .savepage-select-arrow { font-size: 9px; color: #999; margin-left: 5px; }
    .savepage-select-options-panel {
      position: absolute;
      top: calc(100% + 2px);
      left: 0;
      width: 100%;
      background-color: white;
      border: 1px solid #ccc; /* 稍微加深边框 */
      border-radius: var(--savepage-border-radius);
      box-shadow: 0 3px 8px rgba(0,0,0,0.12);
      z-index: 1001; 
      max-height: 180px; /* 调整最大高度 */
      display: flex; 
      flex-direction: column; 
    }
    .savepage-select-search {
      padding: 5px 8px;
      border: none;
      border-bottom: 1px solid var(--savepage-border-color);
      font-size: 12px;
      outline: none;
      flex-shrink: 0; 
    }
    .savepage-select-options-list { overflow-y: auto; flex-grow: 1; }
    .savepage-select-option {
      padding: 5px 10px; /* 调整内边距 */
      cursor: pointer;
      font-size: 11px;
      display: flex;
      align-items: center;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      transition: background-color 0.1s ease;
    }
    .savepage-select-option:hover { background-color: var(--savepage-highlight-bg); }
    .savepage-select-option.selected { /* 可以添加选中项样式 */
       font-weight: 500; 
       background-color: #e3f2fd;
    }
    .savepage-select-option-none { color: #999; font-style: italic; }
    .savepage-color-dot { /* 颜色点样式保持不变 */
      width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; display: inline-block; flex-shrink: 0;
    }

    /* --- Multi-select 标签选择器 --- */
    .savepage-multi-select-container {
      border: 1px solid var(--savepage-border-color);
      border-radius: var(--savepage-border-radius);
      padding: 3px 4px; /* 调整内边距 */
      background-color: white;
      transition: border-color 0.2s, box-shadow 0.2s;
      cursor: text; /* 提示可输入 */
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      min-height: 29px;
      box-sizing: border-box;
      align-items: center;
    }
    .savepage-tags-container { /* 不再需要独立容器，合并到主容器 */
      display: contents; /* 让标签直接成为flex子项 */
    }
    .savepage-tag {
      display: inline-flex;
      align-items: center;
      border-radius: 3px;
      padding: 1px 5px; /* 调整标签内边距 */
      font-size: 11px;
      margin: 1px;
      max-width: calc(100% - 10px);
      cursor: default;
      /* 默认样式调整 */
      background-color: #f0f0f0;
      border: 1px solid #d9d9d9;
      color: rgba(0, 0, 0, 0.85);
    }
    .savepage-tag span:first-child { /* Text content */
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-right: 4px;
    }
    .savepage-tag-remove {
      font-size: 13px; /* 调整大小 */
      font-weight: bold;
      cursor: pointer;
      line-height: 1;
      padding: 0 1px;
      color: inherit;
      opacity: 0.5;
      transition: opacity 0.2s;
    }
    .savepage-tag-remove:hover { opacity: 1; }
    .savepage-input-container {
      position: relative; /* 保持相对定位 */
      flex-grow: 1; /* 占据剩余空间 */
      min-width: 80px; /* 保证最小输入宽度 */
    }
    .savepage-tag-input {
      width: 100%;
      padding: 2px 0px; /* 调整内边距 */
      border: none;
      border-radius: 0;
      font-size: 12px;
      outline: none;
      background-color: transparent;
      box-shadow: none;
    }
    .savepage-options-list { /* 与 Select 的 options-panel 类似 */
      position: absolute;
      top: calc(100% + 2px);
      left: 0;
      width: 100%; 
      max-height: 150px;
      overflow-y: auto;
      background-color: white;
      border: 1px solid #ccc;
      border-radius: var(--savepage-border-radius);
      box-shadow: 0 3px 8px rgba(0,0,0,0.12);
      z-index: 1000;
    }
    .savepage-option-item { /* 与 Select 的 option 类似 */
      padding: 5px 10px;
      cursor: pointer;
      font-size: 11px;
      display: flex;
      align-items: center;
      transition: background-color 0.1s ease;
    }
    .savepage-option-item:hover { background-color: var(--savepage-highlight-bg); }
    .savepage-option-item.active { background-color: #d4edff; } /* 键盘选中高亮 */

    /* --- 属性映射设置面板 --- */
    .savepage-control-panel {
      background-color: var(--savepage-background-color);
      border-radius: var(--savepage-border-radius);
      padding: 8px 10px;
      margin-top: 12px; /* 与上方属性列表间距 */
      border: 1px solid var(--savepage-border-color);
      font-size: 12px;
    }
    
    .savepage-control-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px; /* 减小标题和内容间距 */
      cursor: pointer; /* 整个头部都可点击展开 */
    }
    
    .savepage-control-title {
      display: flex;
      align-items: center;
      font-size: 12px;
      font-weight: 500;
      color: var(--savepage-text-color);
    }
    
    .savepage-expand-icon {
      font-size: 9px;
      margin-right: 5px;
      color: var(--savepage-text-color-secondary);
      transition: transform 0.2s ease;
      width: 10px; /* 固定宽度防止文字跳动 */
      display: inline-block;
      text-align: center;
    }
    .savepage-collapsible-content {
      transition: max-height 0.3s ease, opacity 0.3s ease;
      overflow: hidden;
      max-height: 500px; /* 预设足够大高度 */
      opacity: 1;
    }
     .savepage-collapsible-content[style*="display: none"] {
       max-height: 0;
       opacity: 0;
       padding-top: 0;
       padding-bottom: 0;
       margin-top: 0;
     }

    .savepage-control-buttons { display: flex; gap: 6px; }
    
    .savepage-property-toggles {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); /* 调整最小宽度 */
      gap: 4px 8px; /* 行间距和列间距 */
      font-size: 11px;
      padding-top: 6px; /* 与标题间距 */
    }
    
    .savepage-property-toggle-item {
      display: flex;
      align-items: center;
      gap: 4px;
      overflow: hidden; /* 防止内容溢出 */
    }
    .savepage-property-toggle-item.disabled { opacity: 0.6; pointer-events: none; }
    .savepage-property-toggle-item input[type="checkbox"] {
       width: 12px;
       height: 12px;
       margin: 0;
       flex-shrink: 0;
    }
    .savepage-property-toggle-item label {
      font-size: 11px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      cursor: pointer;
      flex-grow: 1;
      color: var(--savepage-text-color);
      margin: 0;
      font-weight: normal;
    }
    .savepage-property-type {
      font-size: 9px;
      color: var(--savepage-text-color-secondary);
      background-color: #eee;
      padding: 1px 3px;
      border-radius: 2px;
      margin-left: 2px;
      flex-shrink: 0;
    }
    
    /* 加载和错误状态 */
    .savepage-loading,
    .savepage-error {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 8px;
      margin-bottom: 8px;
      font-size: 12px;
      border-radius: var(--savepage-border-radius);
    }
    .savepage-loading {
      background-color: var(--savepage-highlight-bg);
      border: 1px solid var(--savepage-highlight-border);
      color: var(--savepage-primary-color-dark);
    }
    .savepage-error {
      background-color: #fff0f0;
      border: 1px solid #ffd6d6;
      color: var(--savepage-error-color);
    }
    .savepage-spinner {
      width: 14px;
      height: 14px;
      border: 2px solid rgba(0,0,0,0.1);
      border-top-color: var(--savepage-primary-color);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      flex-shrink: 0;
    }
    
    /* 警告样式 */
    .savepage-warning {
      background-color: #fffbe6;
      border: 1px solid #ffe58f;
      color: #d46b08;
      padding: 6px 8px;
      margin-bottom: 10px;
      border-radius: var(--savepage-border-radius);
      font-size: 11px;
    }
    
    /* --- 通知样式 --- */
    .savepage-notification {
      position: fixed;
      bottom: 10px;
      right: 10px;
      padding: 8px 12px; /* 调整内边距 */
      border-radius: var(--savepage-border-radius);
      box-shadow: 0 3px 8px rgba(0, 0, 0, 0.1);
      z-index: 9999999;
      font-size: 13px;
      max-width: 320px;
      word-break: break-word;
      animation: fadeIn 0.2s ease-out;
      background-color: #333; /* 默认深色背景 */
      color: white;
      border-left: 4px solid var(--savepage-primary-color);
    }
    .savepage-notification.success { border-left-color: var(--savepage-success-color); background-color: #4caf50; }
    .savepage-notification.error { border-left-color: var(--savepage-error-color); background-color: #f44336; }
    .savepage-notification.warning { border-left-color: var(--savepage-warning-color); background-color: #ff9800; }
    .savepage-notification.info { border-left-color: var(--savepage-primary-color); background-color: #2196f3; }

    .notification-content { display: flex; flex-direction: column; gap: 5px; }
    .notification-message { font-weight: 500; }
    .notification-actions { display: flex; justify-content: flex-end; gap: 6px; margin-top: 5px; }
    .notification-action-button {
      background-color: rgba(255, 255, 255, 0.15);
      border: 1px solid rgba(255, 255, 255, 0.3);
      color: white;
      padding: 3px 8px; /* 调整按钮大小 */
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 500;
      transition: all 0.2s ease;
    }
    .notification-action-button:hover { background-color: rgba(255, 255, 255, 0.3); }
    .notification-details-error { font-size: 11px; opacity: 0.9; white-space: pre-wrap; }

    /* 辅助类 */
    .hidden { display: none !important; }

  `;
  
  document.head.appendChild(styleEl);
}

function clearNotifications() {
  // 移除所有已有的通知
  document.querySelectorAll(".savepage-notification").forEach(notification => {
    notification.remove();
  });
}

// 获取属性类型的友好标签
function getPropertyTypeLabel(type) {
  const typeLabels = {
    "title": "标题",
    "rich_text": "文本",
    "url": "链接",
    "select": "选择",
    "multi_select": "多选",
    "checkbox": "复选框",
    "number": "数字",
    "date": "日期",
    "created_time": "创建时间",
    "last_edited_time": "修改时间"
  };
  
  return typeLabels[type] || type;
}

// 自动调整textarea高度的函数
function autoResizeTextarea(textarea) {
  // 保存当前滚动位置
  const scrollPos = window.pageYOffset || document.documentElement.scrollTop;
  
  // 重置高度以获取准确的scrollHeight
  textarea.style.height = 'auto';
  
  // 计算新高度 (加2px作为缓冲)
  const newHeight = textarea.scrollHeight + 2;
  
  // 设置新高度
  textarea.style.height = `${newHeight}px`;
  
  // 恢复滚动位置
  window.scrollTo(0, scrollPos);
}

// 构建页面数据
function buildPageData(mappingData) {
  // 处理multi-select类型，将逗号分隔的值转换为数组
  for (const [propertyName, property] of Object.entries(mappingData)) {
    if (property.type === "multi_select" && typeof property.value === "string") {
      property.value = property.value.split(",")
        .map(item => item.trim())
        .filter(item => item.length > 0);
    }
  }
  
  // 直接将映射数据作为originalData字段返回
  console.log("将原始映射数据传递给后台处理:", mappingData);
  return {
    originalData: mappingData
  };
}

// 显示URL已存在对话框
function showDuplicateDialog(pageId) {
  createDialog({
    title: "页面已存在",
    content: `
      <p>此页面已存在于您的Notion数据库中。</p>
    `,
    buttons: [
      {
        text: "查看已有页面",
        primary: true,
        onClick: () => {
          window.open(`https://notion.so/${pageId.replace(/-/g, "")}`);
          closeDialog();
        }
      },
      {
        text: "关闭",
        onClick: () => {
          closeDialog();
        }
      }
    ]
  });
}

// 创建对话框
function createDialog({ title, content, buttons, onOpen }) {
  // 移除已有的对话框
  removeExistingDialog();
  
  // 创建对话框容器
  const dialogContainer = document.createElement("div");
  dialogContainer.className = "savepage-dialog-container";
  dialogContainer.id = "savepage-dialog-container";
  
  // 重要：阻止点击事件传播到下层页面，但不阻止页面交互
  dialogContainer.addEventListener("click", (e) => {
    // 只有当点击的是容器本身时才关闭对话框
    if (e.target === dialogContainer && e.currentTarget === dialogContainer) {
      // 不自动关闭对话框
      e.stopPropagation();
    }
  });
  
  // 创建对话框
  const dialog = document.createElement("div");
  dialog.className = "savepage-dialog";
  
  // 创建对话框标题
  const dialogHeader = document.createElement("div");
  dialogHeader.className = "savepage-dialog-header";
  
  const dialogTitle = document.createElement("h2");
  dialogTitle.textContent = title;
  dialogHeader.appendChild(dialogTitle);
  
  const closeButton = document.createElement("button");
  closeButton.className = "savepage-close-button";
  closeButton.innerHTML = "×";
  closeButton.addEventListener("click", closeDialog);
  dialogHeader.appendChild(closeButton);
  
  dialog.appendChild(dialogHeader);
  
  // 创建对话框内容
  const dialogContent = document.createElement("div");
  dialogContent.className = "savepage-dialog-content";
  dialogContent.innerHTML = content;
  dialog.appendChild(dialogContent);
  
  // 创建对话框按钮
  if (buttons && buttons.length > 0) {
    const dialogFooter = document.createElement("div");
    dialogFooter.className = "savepage-dialog-footer";
    
    buttons.forEach(button => {
      const btn = document.createElement("button");
      btn.textContent = button.text;
      btn.className = button.primary ? "savepage-button primary" : "savepage-button";
      btn.addEventListener("click", button.onClick);
      dialogFooter.appendChild(btn);
    });
    
    dialog.appendChild(dialogFooter);
  }
  
  // 添加对话框到容器
  dialogContainer.appendChild(dialog);
  
  // 添加容器到页面
  document.body.appendChild(dialogContainer);
  
  // 添加对话框样式
  addDialogStyles();
  
  // 重要：防止键盘事件冒泡
  dialog.addEventListener("keydown", (e) => {
    e.stopPropagation();
  });
  
  // 添加键盘事件，但仅在对话框内的元素处理
  document.addEventListener("keydown", handleKeyDown);
  
  // 执行打开回调
  if (typeof onOpen === "function") {
    setTimeout(onOpen, 100);
  }
  
  return dialog;
}

// 关闭对话框
function closeDialog() {
  removeExistingDialog();
  document.removeEventListener("keydown", handleKeyDown);
}

// 移除已有对话框
function removeExistingDialog() {
  const existingDialog = document.getElementById("savepage-dialog-container");
  if (existingDialog) {
    existingDialog.remove();
  }
  
  const existingNotification = document.getElementById("savepage-notification");
  if (existingNotification) {
    existingNotification.remove();
  }
}

// 处理键盘事件
function handleKeyDown(e) {
  if (e.key === "Escape") {
    closeDialog();
  }
}

// 显示通知
function showNotification(message, type = "success", options = {}) {
  // 如果是warning类型，直接返回不显示
  if (type === "warning") {
    return;
  }
  
  clearNotifications();

  // 获取通知显示时间设置
  chrome.storage.local.get(["notificationTimeout"], (result) => {
    const timeout = result.notificationTimeout || 5000;
    
    const notification = document.createElement("div");
    notification.className = `savepage-notification ${type}`;
    notification.id = "savepage-notification";
    
    let notificationContent = `
      <div class="notification-content">
        <div class="notification-message">${message}</div>
    `;
    
    if (type === "error" && options.details) {
      notificationContent += `
        <div class="notification-details-error">${options.details}</div>
      `;
    }
    
    // 添加操作按钮，对于成功保存的通知添加"在Notion中查看"按钮
    let actions = [];
    if (type === "success" && options.pageId) {
      actions.push({
        id: "open-notion",
        text: "在Notion中查看",
        callback: () => {
          window.open(`https://notion.so/${options.pageId.replace(/-/g, "")}`);
        }
      });
    }
    
    if (actions.length > 0 || (options.actions && options.actions.length > 0)) {
      notificationContent += `<div class="notification-actions">`;
      
      // 添加自定义操作按钮
      if (options.actions && options.actions.length > 0) {
        options.actions.forEach(action => {
          notificationContent += `
            <button class="notification-action-button" data-action="${action.id}">${action.text}</button>
          `;
        });
      }
      
      // 添加预定义操作按钮
      actions.forEach(action => {
        notificationContent += `
          <button class="notification-action-button" data-action="${action.id}">${action.text}</button>
        `;
      });
      
      notificationContent += `</div>`;
    }
    
    notificationContent += `</div>`;
    notification.innerHTML = notificationContent;
    
    document.body.appendChild(notification);
    
    // 处理动作按钮点击
    notification.querySelectorAll(".notification-action-button").forEach(button => {
      button.addEventListener("click", () => {
        const actionId = button.getAttribute("data-action");
        
        // 处理预定义操作
        const predefinedAction = actions.find(a => a.id === actionId);
        if (predefinedAction && predefinedAction.callback) {
          predefinedAction.callback();
        }
        
        // 处理自定义操作
        if (options.actions) {
          const customAction = options.actions.find(a => a.id === actionId);
          if (customAction && customAction.callback) {
            customAction.callback();
          }
        }
        
        // 点击按钮后不会自动关闭通知，除非设置了closeOnAction
        if (options.closeOnAction) {
          clearNotifications();
        }
      });
    });
    
    // 如果设置了自动关闭，则添加定时器
    if (!options.persistent) {
      setTimeout(() => {
        if (document.body.contains(notification)) {
          notification.remove();
        }
      }, options.duration || timeout);
    }
  });
}

// 获取页面描述
function getPageDescription() {
  const metaDescription = document.querySelector('meta[name="description"]');
  if (metaDescription) {
    return metaDescription.getAttribute("content");
  }
  
  const ogDescription = document.querySelector('meta[property="og:description"]');
  if (ogDescription) {
    return ogDescription.getAttribute("content");
  }
  
  // 尝试从段落中获取
  const paragraphs = document.querySelectorAll("p");
  for (let i = 0; i < paragraphs.length; i++) {
    const text = paragraphs[i].textContent.trim();
    if (text.length > 20) {
      return text.substring(0, 200);
    }
  }
  
  return "";
}

// 获取网站图标
function getFavicon() {
  try {
    const links = Array.from(document.querySelectorAll('link[rel*="icon"]'));
    
    // 按优先级排序
    const icons = links.sort((a, b) => {
      const relA = (a.getAttribute("rel") || "").toLowerCase();
      const relB = (b.getAttribute("rel") || "").toLowerCase();
      
      // 优先使用 "icon" 或 "shortcut icon"
      if (relA === "icon" || relA === "shortcut icon") return -1;
      if (relB === "icon" || relB === "shortcut icon") return 1;
      
      return 0;
    });
    
    if (icons.length > 0 && icons[0].href) {
      return icons[0].href;
    }
    
    // 使用默认的 /favicon.ico
    return `${window.location.origin}/favicon.ico`;
  } catch (error) {
    console.error("获取网站图标时出错:", error);
    return chrome.runtime.getURL('icons/save-16.png');
  }
}

// 获取网页封面图片
function getPageCover() {
  try {
    console.log("开始获取页面封面图片");
    
    // 检查是否是YouTube视频页面
    if (window.location.hostname.includes("youtube.com") && window.location.pathname.includes("/watch")) {
      // 从URL中获取视频ID
      const urlParams = new URLSearchParams(window.location.search);
      const videoId = urlParams.get('v');
      
      if (videoId) {
        console.log("检测到YouTube视频, 视频ID:", videoId);
        // 使用高质量的视频缩略图URL
        // YouTube提供多种尺寸的缩略图，maxresdefault是最高质量的
        return `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
      }
    }
    
    // 检查是否是Bilibili视频页面
    if (window.location.hostname.includes("bilibili.com") && window.location.pathname.includes("/video/")) {
      console.log("检测到Bilibili视频页面");
      
      // 方法1: 尝试从页面元数据中获取封面
      const metaImages = document.querySelectorAll('meta[property="og:image"], meta[itemprop="image"], meta[name="og:image"]');
      for (const meta of metaImages) {
        const content = meta.getAttribute("content");
        if (content && content.includes("@")) {
          // Bilibili的图片URL通常包含@符号和尺寸信息，我们尝试获取原始尺寸
          const originalUrl = content.split('@')[0];
          console.log("从Bilibili元数据找到封面图:", originalUrl);
          return originalUrl;
        } else if (content) {
          console.log("从Bilibili元数据找到封面图:", content);
          return content;
        }
      }
      
      // 方法2: 尝试从视频播放器获取封面图
      const videoElements = document.querySelectorAll('.bpx-player-container img, .bpx-player video, .player-container img');
      for (const el of videoElements) {
        if (el.nodeName.toLowerCase() === 'img' && el.src) {
          // 对于图片元素，直接获取src
          // 移除Bilibili图片URL中的尺寸信息，获取原始图片
          let src = el.src;
          if (src.includes('@')) {
            src = src.split('@')[0];
          }
          console.log("从Bilibili播放器找到封面图:", src);
          return src;
        } else if (el.nodeName.toLowerCase() === 'video' && el.poster) {
          // 对于视频元素，获取poster属性
          let poster = el.poster;
          if (poster.includes('@')) {
            poster = poster.split('@')[0];
          }
          console.log("从Bilibili视频海报找到封面图:", poster);
          return poster;
        }
      }
      
      // 方法3: 获取页面中最大的图片，排除通用的UI元素
      const allImages = Array.from(document.querySelectorAll('img'));
      const filteredImages = allImages.filter(img => {
        const src = img.src || '';
        const rect = img.getBoundingClientRect();
        // 排除小图标、头像和通用UI元素
        return rect.width > 300 && rect.height > 150 &&
               !src.includes('avatar') && 
               !src.includes('icon') && 
               !src.includes('logo') &&
               !src.includes('header');
      });
      
      // 按尺寸排序，获取最大的图片
      if (filteredImages.length > 0) {
        filteredImages.sort((a, b) => {
          const areaA = a.getBoundingClientRect().width * a.getBoundingClientRect().height;
          const areaB = b.getBoundingClientRect().width * b.getBoundingClientRect().height;
          return areaB - areaA; // 降序排列
        });
        
        let src = filteredImages[0].src;
        // 移除Bilibili图片URL中的尺寸信息
        if (src.includes('@')) {
          src = src.split('@')[0];
        }
        console.log("从Bilibili页面找到最大图片:", src);
        return src;
      }
    }
    
    // 尝试获取Open Graph图片
    const ogImage = document.querySelector('meta[property="og:image"]');
    if (ogImage && ogImage.getAttribute("content")) {
      const url = ogImage.getAttribute("content");
      console.log("找到og:image图片:", url);
      // 确保是绝对URL
      return new URL(url, window.location.href).href;
    }
    
    // 尝试获取Twitter卡片图片
    const twitterImage = document.querySelector('meta[name="twitter:image"]');
    if (twitterImage && twitterImage.getAttribute("content")) {
      const url = twitterImage.getAttribute("content");
      console.log("找到twitter:image图片:", url);
      // 确保是绝对URL
      return new URL(url, window.location.href).href;
    }
    
    // 尝试获取第一张大图片
    const images = Array.from(document.querySelectorAll('img'));
    const largeImages = images.filter(img => {
      const rect = img.getBoundingClientRect();
      const src = img.src || '';
      // 过滤出较大的图片且不是logo类型的图片
      return rect.width > 200 && rect.height > 100 && 
             src && src.trim() !== "" && 
             !src.includes('logo') && 
             !src.includes('icon');
    });
    
    if (largeImages.length > 0) {
      console.log("找到第一张大图:", largeImages[0].src);
      // 确保是绝对URL
      return new URL(largeImages[0].src, window.location.href).href;
    }
    
    console.log("未找到合适的封面图片");
    return "";
  } catch (error) {
    console.error("获取页面封面图片时出错:", error);
    return "";
  }
}

// 获取页面所有可提取的信息
function getPageInfo() {
  return {
    title: document.title || "",
    url: window.location.href || "",
    description: getPageDescription() || "",
    favicon: getFavicon() || "",
    cover: getPageCover() || "",
    domain: window.location.hostname || "",
    time: new Date().toISOString()
  };
}

// 修复属性可见性切换功能
function fixPropertyVisibilityToggle() {
  // 在DOM中查找所有visibility toggle
  document.querySelectorAll(".property-visibility-toggle").forEach(toggle => {
    // 检查是否已添加事件监听器
    const hasListener = toggle.getAttribute("data-has-listener") === "true";
    if (!hasListener) {
      toggle.setAttribute("data-has-listener", "true");
      
      // 获取当前可见性状态并立即应用
      const propertyName = toggle.getAttribute("data-property-name");
      if (propertyName) {
        const isChecked = toggle.checked;
        const propertyRow = document.querySelector(`.savepage-property-row[data-property-name="${propertyName}"]`);
        
        if (propertyRow) {
          // 立即应用当前状态
          if (isChecked) {
            propertyRow.classList.remove("hidden");
            const input = propertyRow.querySelector("[data-property-mapping]");
            if (input) {
              input.removeAttribute("data-hidden");
            }
          } else {
            propertyRow.classList.add("hidden");
            const input = propertyRow.querySelector("[data-property-mapping]");
            if (input) {
              input.setAttribute("data-hidden", "true");
            }
          }
        }
      }
      
      // 添加变更事件监听器
      toggle.addEventListener("change", () => {
        const propertyName = toggle.getAttribute("data-property-name");
        if (!propertyName) return;
        
        const isChecked = toggle.checked;
        const propertyRow = document.querySelector(`.savepage-property-row[data-property-name="${propertyName}"]`);
        
        if (propertyRow) {
          if (isChecked) {
            propertyRow.classList.remove("hidden");
            const input = propertyRow.querySelector("[data-property-mapping]");
            if (input) {
              input.removeAttribute("data-hidden");
            }
          } else {
            propertyRow.classList.add("hidden");
            const input = propertyRow.querySelector("[data-property-mapping]");
            if (input) {
              input.setAttribute("data-hidden", "true");
            }
          }
        }
        
        // 保存当前的可见性配置
        savePropertyVisibility();
      });
    }
  });
}

// 保存属性可见性配置
function savePropertyVisibility() {
  const propertyVisibility = {};
  
  document.querySelectorAll(".property-visibility-toggle").forEach(toggle => {
    const propertyName = toggle.getAttribute("data-property-name");
    if (propertyName) {
      propertyVisibility[propertyName] = toggle.checked;
    }
  });
  
  // 保存到本地存储
  chrome.storage.local.set({ propertyVisibility });
}