import os
import re
import urllib.parse
from datetime import datetime

def process_md_file():
    # 定义文件路径
    desktop_path = os.path.join(os.path.expanduser("~"), "Desktop")
    input_file_path = os.path.join(desktop_path, "1.md")
    
    # 读取输入文件内容
    with open(input_file_path, "r", encoding="utf-8") as file:
        content = file.read()
    
    # 定义查找替换的正则表达式和替换逻辑
    url_pattern = re.compile(r'(kmtrigger://macro=[A-Z0-9-]+&value=[\d.]+)')
    replacement_prefix = "http://127.0.0.1:10114/v1?l="
    
    def replace_url(match):
        original_url = match.group(0)
        encoded_url = urllib.parse.quote(original_url, safe='')
        return replacement_prefix + encoded_url
    
    # 替换内容
    new_content = url_pattern.sub(replace_url, content)
    
    # 定义输出文件路径
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    output_file_path = os.path.join(desktop_path, f"{timestamp}.md")
    
    # 保存处理后的内容到新文件
    with open(output_file_path, "w", encoding="utf-8") as file:
        file.write(new_content)
    
    print(f"处理完成，结果保存在: {output_file_path}")

# 执行脚本
process_md_file()
